package patient

import (
	"errors"
	"strings"

	"clinic/internal/notifications"
)

type Service struct {
	repo     *Repository
	notifier *notifications.Manager
}

func NewService(repo *Repository, notifier *notifications.Manager) *Service {
	return &Service{repo: repo, notifier: notifier}
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

	err = s.repo.UpdatePatientProfile(accountID, req)
	if err != nil {
		return nil, err
	}
	if s.notifier != nil {
		_, _ = s.notifier.ProfileUpdated(int64(accountID))
	}

	return s.repo.GetPatientByAccountID(accountID)
}

func (s *Service) UpdateMedicalFile(accountID int64, medicalFileURL string) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}
	medicalFileURL = strings.TrimSpace(medicalFileURL)
	if medicalFileURL == "" {
		return errors.New("medical file url is required")
	}

	if err := s.repo.UpdateMedicalFileURL(int(accountID), medicalFileURL); err != nil {
		return err
	}
	if s.notifier != nil {
		_, _ = s.notifier.Send(accountID, "Your medical file was uploaded successfully.")
	}
	return nil
}
