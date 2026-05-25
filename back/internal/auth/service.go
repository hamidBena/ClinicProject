package auth

import (
	"errors"
	"strings"

	"clinic/pkg/utils"
)

type Notifier interface {
	Notify(accountID int64, message string) error
}

type Service struct {
	repo     *Repository
	notifier Notifier
}

func NewService(r *Repository, notifier Notifier) *Service {
	return &Service{repo: r, notifier: notifier}
}

func (s *Service) RegisterPatient(request SignUpRequestPatient) error {
	err := s.ValidateSignUpRequest(request.SignUpRequest)
	if err != nil {
		return err
	}

	// Single atomic transaction: if anything fails, nothing is saved.
	accountID, err := s.repo.CreateAccountAndPatient(request.SignUpRequest, request.InsuranceNumber, request.ChronicDiseases)
	if err != nil {
		return err
	}

	if s.notifier != nil {
		_ = s.notifier.Notify(accountID, "Welcome to ClinicProject. Your patient account is ready.")
	}
	return nil
}

func (s *Service) RegisterDoctor(request SignUpRequestDoctor) error {
	err := s.ValidateSignUpRequest(request.SignUpRequest)
	if err != nil {
		return err
	}

	exists, err := s.repo.SpecialityExists(request.Speciality_id)
	if err != nil {
		return err
	}

	if !exists {
		return errors.New("speciality does not exist")
	}

	accountID, err := s.repo.CreateAccount(request.SignUpRequest)
	if err != nil {
		return err
	}
	if err := s.repo.CreateDoctor(accountID, request.Speciality_id); err != nil {
		return err
	}
	if s.notifier != nil {
		_ = s.notifier.Notify(accountID, "Welcome to ClinicProject. Your doctor account is ready.")
	}
	return nil
}

func (s *Service) Login(email, password string) (*Account, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	account, err := s.repo.GetAccountByEmail(email)
	if err != nil {
		return nil, err
	}

	if account.IsBlocked {
		return nil, errors.New("your account has been blocked. please contact the administrator")
	}

	if !s.repo.VerifyPassword(account.PasswordHash, password) {
		return nil, errors.New("invalid credentials")
	}

	role, err := s.repo.GetAccountRole(int64(account.ID))
	if err != nil {
		return nil, err
	}
	account.Role = role

	return account, nil
}

func (s *Service) ValidateSignUpRequest(request SignUpRequest) error {
	if len(request.Username) <= 4 {
		return errors.New("username must be at least 5 characters long")
	}
	if request.FirstName == "" {
		return errors.New("first name is required")
	}
	if request.LastName == "" {
		return errors.New("last name is required")
	}
	if request.PhoneNumber == "" {
		return errors.New("phone number is required")
	}
	if request.Email == "" {
		return errors.New("email is required")
	}
	if len(request.Password) < 6 {
		return errors.New("password must be at least 6 characters long")
	}
	if strings.Contains(request.Password, " ") {
		return errors.New("password cannot contain spaces")
	}
	if request.Role != "patient" && request.Role != "doctor" {
		return errors.New("role must be 'patient' or 'doctor'")
	}
	return nil
}

func (s *Service) ChangePassword(accountID int64, currentPassword, newPassword string) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}

	currentPassword = strings.TrimSpace(currentPassword)
	newPassword = strings.TrimSpace(newPassword)

	if currentPassword == "" || newPassword == "" {
		return errors.New("current_password and new_password are required")
	}

	if len(newPassword) < 6 {
		return errors.New("new password must be at least 6 characters long")
	}

	if strings.Contains(newPassword, " ") {
		return errors.New("new password cannot contain spaces")
	}

	account, err := s.repo.GetAccountByID(accountID)
	if err != nil {
		return err
	}

	if !s.repo.VerifyPassword(account.PasswordHash, currentPassword) {
		return errors.New("current password is incorrect")
	}

	if currentPassword == newPassword {
		return errors.New("new password must be different from current password")
	}

	newHash, err := utils.HashPassword(newPassword)
	if err != nil {
		return err
	}

	if err := s.repo.UpdatePasswordHash(accountID, newHash); err != nil {
		return err
	}
	if s.notifier != nil {
		_ = s.notifier.Notify(accountID, "Your password was changed successfully.")
	}
	return nil
}
