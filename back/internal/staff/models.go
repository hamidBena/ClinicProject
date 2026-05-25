package staff

import "clinic/internal/user"

type Staff struct {
    user.User
    Post            string `json:"post"`
    RecruitmentDate string `json:"recruitment_date"`
}

type ProfileUpdateRequest struct {
    user.ProfileUpdateRequest
    Post            string `json:"post"`
    RecruitmentDate string `json:"recruitment_date"`
}