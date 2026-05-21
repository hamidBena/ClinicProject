package notifications

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

func (r *Repository) Create(n *Notification) error {
	if n == nil {
		return errors.New("notification is nil")
	}

	dateStr := n.Date.UTC().Format(time.RFC3339Nano)

	result, err := r.db.Exec(
		`INSERT INTO notifications (message, date, account_id) VALUES (?, ?, ?)`,
		n.Message,
		dateStr,
		n.AccountID,
	)
	if err != nil {
		return err
	}

	n.ID, err = result.LastInsertId()
	return err
}

func (r *Repository) GetByID(id int64) (*Notification, error) {
	if id <= 0 {
		return nil, errors.New("invalid notification id")
	}

	var n Notification
	var dateStr string
	err := r.db.QueryRow(
		`SELECT id_notification, message, date, account_id FROM notifications WHERE id_notification = ?`,
		id,
	).Scan(&n.ID, &n.Message, &dateStr, &n.AccountID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("notification not found")
		}
		return nil, err
	}

	n.Date, _ = parseNotificationTime(dateStr)
	return &n, nil
}

func (r *Repository) ListByAccountID(accountID int64) ([]Notification, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	rows, err := r.db.Query(
		`SELECT id_notification, message, date, account_id FROM notifications WHERE account_id = ? ORDER BY date DESC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Notification, 0)
	for rows.Next() {
		var n Notification
		var dateStr string
		if err := rows.Scan(&n.ID, &n.Message, &dateStr, &n.AccountID); err != nil {
			return nil, err
		}
		n.Date, _ = parseNotificationTime(dateStr)
		list = append(list, n)
	}

	return list, rows.Err()
}

func parseNotificationTime(value string) (time.Time, error) {
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

	return time.Time{}, errors.New("invalid notification timestamp")
}
