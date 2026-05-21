package patient

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

func (s *Service) GetByAccountID(accountID int) (*Patient, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	return s.repo.GetPatientByAccountID(accountID)
}

func (s *Service) UpdateProfile(accountID int, req ProfileUpdateRequest) (*Patient, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	current, err := s.repo.GetPatientByAccountID(accountID)
	if err != nil {
		return nil, err
	}

	if req.Password != "" {
		return nil, errors.New("password update is not supported in patient profile endpoint")
	}

	req.Username = strings.TrimSpace(req.Username)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)
	req.InsuranceNumber = strings.TrimSpace(req.InsuranceNumber)

	if req.Username == "" {
		req.Username = current.User.Username
	}
	if req.PhoneNumber == "" {
		req.PhoneNumber = current.User.PhoneNumber
	}
	if req.InsuranceNumber == "" {
		req.InsuranceNumber = current.InsuranceNumber
	}
	if req.Address == "" {
		req.Address = current.Address
	}
	if req.Birthday == "" {
		req.Birthday = current.Birthday
	}

	err = s.repo.UpdatePatientProfile(accountID, req)
	if err != nil {
		return nil, err
	}

	return s.repo.GetPatientByAccountID(accountID)
}
