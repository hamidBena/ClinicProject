package doctor

import "clinic/internal/user"

// Doctor represents a doctor's profile
type Doctor struct {
	user.User
	Address      string `json:"address"`
	SpecialityID int64  `json:"speciality_id"`
}

// ProfileUpdateRequest represents fields that can be updated in doctor profile
type ProfileUpdateRequest struct {
	user.ProfileUpdateRequest
	Address      string `json:"address"`
	SpecialityID int64  `json:"speciality_id"`
}
