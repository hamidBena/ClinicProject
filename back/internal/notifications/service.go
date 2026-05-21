package notifications

import (
	"errors"
	"strings"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(accountID int64, message string, date time.Time) (*Notification, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}
	message = strings.TrimSpace(message)
	if message == "" {
		return nil, errors.New("message is required")
	}
	if date.IsZero() {
		date = time.Now().UTC()
	}

	n := &Notification{
		AccountID: accountID,
		Message:   message,
		Date:      date.UTC(),
	}

	if err := s.repo.Create(n); err != nil {
		return nil, err
	}

	return n, nil
}

func (s *Service) GetByID(id int64) (*Notification, error) {
	if id <= 0 {
		return nil, errors.New("invalid notification id")
	}
	return s.repo.GetByID(id)
}

func (s *Service) ListByAccountID(accountID int64) ([]Notification, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}
	return s.repo.ListByAccountID(accountID)
}
