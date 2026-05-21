package reservations

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(reservation *Reservation) error {
	if reservation == nil {
		return errors.New("reservation is nil")
	}

	timeCreated := reservation.TimeCreated.UTC().Format(time.RFC3339Nano)
	timeDue := reservation.TimeDue.UTC().Format(time.RFC3339Nano)

	result, err := r.db.Exec(
		`INSERT INTO reservations (timeCreated, timeDue, queue_id, account_id, status)
		 VALUES (?, ?, ?, ?, ?)`,
		timeCreated,
		timeDue,
		reservation.QueueID,
		reservation.AccountID,
		reservation.Status,
	)
	if err != nil {
		return err
	}

	reservation.ID, err = result.LastInsertId()
	return err
}

func (r *Repository) Update(accountID int64, req ReservationUpdateRequest) error {
	if req.ID <= 0 {
		return errors.New("invalid reservation id")
	}
	if accountID <= 0 {
		return errors.New("invalid account id")
	}

	assignments := make([]string, 0)
	args := make([]interface{}, 0)

	if req.TimeDue != nil {
		assignments = append(assignments, "timeDue = ?")
		args = append(args, req.TimeDue.UTC().Format(time.RFC3339Nano))
	}
	if req.QueueID != nil {
		assignments = append(assignments, "queue_id = ?")
		args = append(args, *req.QueueID)
	}
	if req.Status != nil {
		assignments = append(assignments, "status = ?")
		args = append(args, *req.Status)
	}

	if len(assignments) == 0 {
		return errors.New("no reservation fields to update")
	}

	args = append(args, req.ID, accountID)
	query := "UPDATE reservations SET " + strings.Join(assignments, ", ") + " WHERE id_reservation = ? AND account_id = ?"
	result, err := r.db.Exec(query, args...)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("reservation not found")
	}

	return nil
}

func (r *Repository) GetByID(id int64) (*Reservation, error) {
	if id <= 0 {
		return nil, errors.New("invalid reservation id")
	}

	var reservation Reservation
	var timeCreated, timeDue, status string
	err := r.db.QueryRow(
		`SELECT id_reservation, timeCreated, timeDue, queue_id, account_id, status
		 FROM reservations
		 WHERE id_reservation = ?`,
		id,
	).Scan(
		&reservation.ID,
		&timeCreated,
		&timeDue,
		&reservation.QueueID,
		&reservation.AccountID,
		&status,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("reservation not found")
		}
		return nil, err
	}

	reservation.TimeCreated, _ = parseReservationTime(timeCreated)
	reservation.TimeDue, _ = parseReservationTime(timeDue)
	reservation.Status = status
	return &reservation, nil
}

func (r *Repository) ListByAccountID(accountID int64) ([]Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	rows, err := r.db.Query(
		`SELECT r.id_reservation, r.timeCreated, r.timeDue, r.queue_id, r.account_id, r.status,
		        COALESCE(s.name, ''),
		        COALESCE(a.first_name || ' ' || a.last_name, '')
		 FROM reservations r
		 LEFT JOIN queues q ON q.id_queue = r.queue_id
		 LEFT JOIN specialities s ON s.id_speciality = q.speciality_id
		 LEFT JOIN doctors d ON d.speciality_id = q.speciality_id
		 LEFT JOIN accounts a ON a.id_account = d.account_id
		 WHERE r.account_id = ?
		 ORDER BY r.timeCreated DESC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reservations := make([]Reservation, 0)
	for rows.Next() {
		var res Reservation
		var timeCreated, timeDue, status string
		var specialityName, doctorName string
		if err := rows.Scan(
			&res.ID,
			&timeCreated,
			&timeDue,
			&res.QueueID,
			&res.AccountID,
			&status,
			&specialityName,
			&doctorName,
		); err != nil {
			return nil, err
		}

		res.TimeCreated, _ = parseReservationTime(timeCreated)
		res.TimeDue, _ = parseReservationTime(timeDue)
		res.Status = status
		res.SpecialityName = specialityName
		res.DoctorName = strings.TrimSpace(doctorName)
		reservations = append(reservations, res)
	}

	return reservations, rows.Err()
}

func (r *Repository) ListByQueueID(queueID int64) ([]Reservation, error) {
	if queueID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	rows, err := r.db.Query(
		`SELECT r.id_reservation, r.timeCreated, r.timeDue, r.queue_id, r.account_id, r.status,
                a.first_name || ' ' || a.last_name AS patient_name
         FROM reservations r
         JOIN accounts a ON a.id_account = r.account_id
         WHERE r.queue_id = ?
         ORDER BY r.timeCreated ASC`,
		queueID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reservations := make([]Reservation, 0)
	for rows.Next() {
		var res Reservation
		var timeCreated, timeDue, status, patientName string
		if err := rows.Scan(
			&res.ID,
			&timeCreated,
			&timeDue,
			&res.QueueID,
			&res.AccountID,
			&status,
			&patientName,
		); err != nil {
			return nil, err
		}

		res.TimeCreated, _ = parseReservationTime(timeCreated)
		res.TimeDue, _ = parseReservationTime(timeDue)
		res.Status = status
		res.PatientName = patientName
		reservations = append(reservations, res)
	}

	return reservations, rows.Err()
}

func parseReservationTime(value string) (time.Time, error) {
	value = strings.TrimSpace(strings.Trim(value, `"`))

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, errors.New("invalid reservation timestamp")
}