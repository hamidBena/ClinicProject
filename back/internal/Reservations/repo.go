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
	var timeCreated string
	var timeDue string
	var status string
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

	parsedTimeCreated, err := parseReservationTime(timeCreated)
	if err != nil {
		return nil, err
	}
	parsedTimeDue, err := parseReservationTime(timeDue)
	if err != nil {
		return nil, err
	}

	reservation.TimeCreated = parsedTimeCreated
	reservation.TimeDue = parsedTimeDue
	reservation.Status = status

	return &reservation, nil
}

func (r *Repository) ListByAccountID(accountID int64) ([]Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	rows, err := r.db.Query(
		`SELECT id_reservation, timeCreated, timeDue, queue_id, account_id, status
		 FROM reservations
		 WHERE account_id = ?
		 ORDER BY timeCreated DESC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reservations := make([]Reservation, 0)
	for rows.Next() {
		var reservation Reservation
		var timeCreated string
		var timeDue string
		var status string
		if err := rows.Scan(
			&reservation.ID,
			&timeCreated,
			&timeDue,
			&reservation.QueueID,
			&reservation.AccountID,
			&status,
		); err != nil {
			return nil, err
		}

		parsedTimeCreated, err := parseReservationTime(timeCreated)
		if err != nil {
			return nil, err
		}
		parsedTimeDue, err := parseReservationTime(timeDue)
		if err != nil {
			return nil, err
		}

		reservation.TimeCreated = parsedTimeCreated
		reservation.TimeDue = parsedTimeDue
		reservation.Status = status
		reservations = append(reservations, reservation)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reservations, nil
}

func (r *Repository) ListByQueueID(queueID int64) ([]Reservation, error) {
	if queueID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	rows, err := r.db.Query(
		`SELECT id_reservation, timeCreated, timeDue, queue_id, account_id, status
		 FROM reservations
		 WHERE queue_id = ?
		 ORDER BY timeCreated DESC`,
		queueID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reservations := make([]Reservation, 0)
	for rows.Next() {
		var reservation Reservation
		var timeCreated string
		var timeDue string
		var status string
		if err := rows.Scan(
			&reservation.ID,
			&timeCreated,
			&timeDue,
			&reservation.QueueID,
			&reservation.AccountID,
			&status,
		); err != nil {
			return nil, err
		}

		parsedTimeCreated, err := parseReservationTime(timeCreated)
		if err != nil {
			return nil, err
		}
		parsedTimeDue, err := parseReservationTime(timeDue)
		if err != nil {
			return nil, err
		}

		reservation.TimeCreated = parsedTimeCreated
		reservation.TimeDue = parsedTimeDue
		reservation.Status = status
		reservations = append(reservations, reservation)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return reservations, nil
}

func parseReservationTime(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, `"`)

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999Z07:00",
		"2006-01-02 15:04:05Z07:00",
		"2006-01-02 15:04:05.999999999",
		"2006-01-02 15:04:05",
	}

	for _, layout := range layouts {
		parsed, err := time.Parse(layout, value)
		if err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, errors.New("invalid reservation timestamp")
}
