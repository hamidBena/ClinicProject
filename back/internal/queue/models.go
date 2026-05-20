package queue

type Queue struct {
	ID               int64  `json:"id"`
	MaxSize          int    `json:"max_size"`
	QueueCurrentSize int    `json:"queue_current_size"`
	QueueIndex       int    `json:"queue_index"`
	SpecialityID     int64  `json:"speciality_id"`
	SpecialityName   string `json:"speciality_name,omitempty"`
}

type QueueUpdateRequest struct {
	ID               int64  `json:"id"`
	MaxSize          *int   `json:"max_size"`
	QueueCurrentSize *int   `json:"queue_current_size"`
	QueueIndex       *int   `json:"queue_index"`
	SpecialityID     *int64 `json:"speciality_id"`
}
