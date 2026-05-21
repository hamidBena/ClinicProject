package patient

import "clinic/internal/user"

type Patient struct {
    User            user.User `json:"user"`
    InsuranceNumber string    `json:"insurance_number"`
    Address         string    `json:"address"`
    Birthday        string    `json:"birthday"`
}

type ProfileUpdateRequest struct {
    user.ProfileUpdateRequest
    InsuranceNumber string `json:"insurance_number"`
    Address         string `json:"address"`
    Birthday        string `json:"birthday"`
}
