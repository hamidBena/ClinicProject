package patient

import "clinic/internal/user"

type Patient struct {
	User            user.User `json:"user"`
	InsuranceNumber string    `json:"insurance_number"`
	MedicalFileURL  string    `json:"medical_file_url,omitempty"`
}

type ProfileUpdateRequest struct {
	user.ProfileUpdateRequest
	InsuranceNumber string `json:"insurance_number"`
}
