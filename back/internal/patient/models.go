package patient

import "clinic/internal/user"

type Patient struct {
	User            user.User
	InsuranceNumber string
}

type ProfileUpdateRequest struct {
	user.ProfileUpdateRequest
	InsuranceNumber string `json:"insurance_number"`
}
