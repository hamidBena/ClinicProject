package doctor

import "clinic/internal/user"

// Doctor represents a doctor's profile
type Doctor struct {
	user.User
	SpecialityID   int64    `json:"speciality_id"`
	Availability   string   `json:"availability"`
	WorkingDays    []string `json:"working_days"`
	CertificateURL string   `json:"certificate_url,omitempty"`
	NumAgrement    string `json:"num_agrement,omitempty"`
}

// ProfileUpdateRequest represents fields that can be updated in doctor profile
type ProfileUpdateRequest struct {
	user.ProfileUpdateRequest
	SpecialityID int64    `json:"speciality_id"`
	WorkingDays  []string `json:"working_days"`
}
