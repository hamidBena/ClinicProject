package reservations

import "time"

type Reservation struct {
	ID          int64     `json:"id"`
	TimeCreated time.Time `json:"timecreated"`
	TimeDue     time.Time `json:"timedue"`
	QueueID     int64     `json:"queue_id"`
	AccountID   int64     `json:"account_id"`
	Status      string    `json:"status"`
}

type ReservationRequest struct {
	QueueID   int64     `json:"queue_id"`
	TimeDue   time.Time `json:"timedue"`
	TimeDueAt time.Time `json:"time_due"`
}

type ReservationUpdateRequest struct {
	ID      int64      `json:"id"`
	TimeDue *time.Time `json:"timedue"`
	QueueID *int64     `json:"queue_id"`
	Status  *string    `json:"status"`
}
