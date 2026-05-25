package user

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
	if req.FirstName == "" {
		req.FirstName = current.FirstName
	}
	if req.LastName == "" {
		req.LastName = current.LastName
	}
	if req.Email == "" {
		req.Email = current.Email
	}
	if req.PhoneNumber == "" {
		req.PhoneNumber = current.PhoneNumber
	}

	err = s.repo.UpdateUserProfile(accountID, req)
	if err != nil {
		return nil, err
	}
	if s.notifier != nil {
		_, _ = s.notifier.ProfileUpdated(int64(accountID))
	}

	return s.repo.GetUserByAccountID(accountID)
}

func (s *Service) UpdateAvatar(accountID int64, avatarURL string) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}
	avatarURL = strings.TrimSpace(avatarURL)
	if avatarURL == "" {
		return errors.New("avatar url is required")
	}

	if err := s.repo.UpdateAvatarURL(accountID, avatarURL); err != nil {
		return err
	}
	if s.notifier != nil {
		_, _ = s.notifier.Send(accountID, "Your profile picture was updated.")
	}
	return nil
}
