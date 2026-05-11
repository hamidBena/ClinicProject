package auth

type Account struct {
	ID           int
	Username     string
	FirstName    string
	LastName     string
	PhoneNumber  string
	Email        string
	PasswordHash string
	Role         string
}

type SignUpRequest struct {
	Username    string `json:"username"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	PhoneNumber string `json:"phone_number"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	Role        string `json:"role"`
}

type SignUpRequestPatient struct {
	SignUpRequest
	InsuranceNumber string `json:"insurance_number"`
}

type SignUpRequestDoctor struct {
	SignUpRequest
	Speciality_id int32  `json:"speciality_id"`
	Address       string `json:"address"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}
