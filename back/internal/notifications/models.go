package notifications

import "time"

type Notification struct {
	ID        int64     `json:"id"`
	AccountID int64     `json:"account_id"`
	Message   string    `json:"message"`
	Date      time.Time `json:"date"`
}
