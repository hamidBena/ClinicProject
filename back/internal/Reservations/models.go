package reservations

import "time"

type Reservation struct {
	ID             int64     `json:"id"`
	TimeCreated    time.Time `json:"timecreated"`
	QueueID        int64     `json:"queue_id"`
	AccountID      int64     `json:"account_id"`
	Status         string    `json:"status"`
	PatientName    string    `json:"patient_name,omitempty"`
	SpecialityName string    `json:"speciality_name,omitempty"`
	DoctorName     string    `json:"doctor_name,omitempty"`
}

type ReservationRequest struct {
	QueueID int64 `json:"queue_id"`
	// Removed TimeDue fields
}

type ReservationUpdateRequest struct {
	ID      int64   `json:"id"`
	QueueID *int64  `json:"queue_id"`
	Status  *string `json:"status"`
}
