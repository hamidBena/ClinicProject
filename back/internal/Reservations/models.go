package reservations

import "time"

type Reservation struct {
	ID          int64     `json:"id"`
	TimeCreated time.Time `json:"timecreated"`
	TimeDue     time.Time `json:"timedue"`
	QueueID     int64     `json:"queue_id"`
	AccountID   int64     `json:"account_id"`
}

type ReservationUpdateRequest struct {
	ID      int64      `json:"id"`
	TimeDue *time.Time `json:"timedue"`
	QueueID *int64     `json:"queue_id"`
}
