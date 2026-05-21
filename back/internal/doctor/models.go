package doctor

import "clinic/internal/user"

// Doctor represents a doctor's profile
type Doctor struct {
	user.User
	Address        string `json:"address"`
	SpecialityID   int64  `json:"speciality_id"`
	Availability   string `json:"availability"`
	CertificateURL string `json:"certificate_url,omitempty"`
}

// ProfileUpdateRequest represents fields that can be updated in doctor profile
type ProfileUpdateRequest struct {
	user.ProfileUpdateRequest
	Address      string `json:"address"`
	SpecialityID int64  `json:"speciality_id"`
}
