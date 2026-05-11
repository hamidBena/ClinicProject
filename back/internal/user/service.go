package user

import (
	"errors"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByAccountID(accountID int) (*User, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	return s.repo.GetUserByAccountID(accountID)
}

func (s *Service) UpdateProfile(accountID int, req ProfileUpdateRequest) (*User, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	current, err := s.repo.GetUserByAccountID(accountID)
	if err != nil {
		return nil, err
	}

	if req.Password != "" {
		return nil, errors.New("password update is not supported in user profile endpoint")
	}

	req.Username = strings.TrimSpace(req.Username)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)

	if req.Username == "" {
		req.Username = current.Username
	}
	if req.PhoneNumber == "" {
		req.PhoneNumber = current.PhoneNumber
	}

	err = s.repo.UpdateUserProfile(accountID, req)
	if err != nil {
		return nil, err
	}

	return s.repo.GetUserByAccountID(accountID)
}
