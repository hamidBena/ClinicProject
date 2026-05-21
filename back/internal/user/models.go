package user

type User struct {
    ID          int    `json:"id"`
    AccountID   int    `json:"account_id"`
    Username    string `json:"username"`
    FirstName   string `json:"first_name"`
    LastName    string `json:"last_name"`
    PhoneNumber string `json:"phone_number"`
    Email       string `json:"email"`
    Role        string `json:"role"`
}

type ProfileUpdateRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
}
