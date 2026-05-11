package user

type User struct {
	ID          int
	AccountID   int
	Username    string
	FirstName   string
	LastName    string
	PhoneNumber string
	Email       string
	Role        string
}

type ProfileUpdateRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
}
