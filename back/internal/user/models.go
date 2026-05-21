package user

type User struct {
	ID          int    `json:"id"`
	AccountID   int    `json:"account_id"`
	Username    string `json:"username"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	PhoneNumber string `json:"phone_number"`
	Gender      string `json:"gender,omitempty"`
	Address     string `json:"address,omitempty"`
	Birthday    string `json:"birthday,omitempty"`
	Email       string `json:"email"`
	Role        string `json:"role"`
	AvatarURL   string `json:"avatar_url,omitempty"`
}

type ProfileUpdateRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	PhoneNumber string `json:"phone_number"`
	Address     string `json:"address"`
	Birthday    string `json:"birthday"`
}
