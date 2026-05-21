package doctor

import (
	"errors"
	"strings"

	"clinic/internal/notifications"
)

// Service handles doctor profile business logic
type Service struct {
	repo     *Repository
	notifier *notifications.Manager
}

// NewService creates a new doctor service
func NewService(repo *Repository, notifier *notifications.Manager) *Service {
	return &Service{repo: repo, notifier: notifier}
}

func (s *Service) UpdateCertificate(accountID int64, certificateURL string) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}
	certificateURL = strings.TrimSpace(certificateURL)
	if certificateURL == "" {
		return errors.New("certificate url is required")
	}
	if err := s.repo.UpdateCertificateURL(accountID, certificateURL); err != nil {
		return err
	}
	if s.notifier != nil {
		_, _ = s.notifier.Send(accountID, "Your certificate was uploaded successfully.")
	}
	return nil
}

// GetByAccountID retrieves a doctor profile by account ID
func (s *Service) GetByAccountID(accountID int) (*Doctor, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	return s.repo.GetDoctorByAccountID(accountID)
}

// UpdateProfile updates a doctor's profile
func (s *Service) UpdateProfile(accountID int, req ProfileUpdateRequest) (*Doctor, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	// Fetch current profile
	current, err := s.repo.GetDoctorByAccountID(accountID)
	if err != nil {
		return nil, err
	}

	// Normalize: preserve empty strings from current profile for unspecified fields
	if req.Username == "" {
		req.Username = current.Username
	}
	if req.PhoneNumber == "" {
		req.PhoneNumber = current.PhoneNumber
	}
	if req.Address == "" {
		req.Address = current.Address
	}
	if req.SpecialityID == 0 {
		req.SpecialityID = current.SpecialityID
	}

	exists, err := s.repo.SpecialityExists(req.SpecialityID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, errors.New("invalid speciality id")
	}

	// Trim whitespace
	req.Username = strings.TrimSpace(req.Username)
	req.PhoneNumber = strings.TrimSpace(req.PhoneNumber)
	req.Address = strings.TrimSpace(req.Address)

	// Update in repository
	err = s.repo.UpdateDoctorProfile(accountID, req)
	if err != nil {
		return nil, err
	}
	if s.notifier != nil {
		_, _ = s.notifier.ProfileUpdated(int64(accountID))
	}

	// Refetch and return
	return s.repo.GetDoctorByAccountID(accountID)
}
