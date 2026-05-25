package patient

import "clinic/internal/user"

type Patient struct {
	User            user.User `json:"user"`
	InsuranceNumber string    `json:"insurance_number"`
	ChronicDiseases string    `json:"chronic_diseases,omitempty"`
	MedicalFileURL  string    `json:"medical_file_url,omitempty"`
}

type ProfileUpdateRequest struct {
    user.ProfileUpdateRequest
    InsuranceNumber string `json:"insurance_number"`
    ChronicDiseases string `json:"chronic_diseases"`
}
