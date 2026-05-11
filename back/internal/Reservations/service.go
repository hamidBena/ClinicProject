package reservations

import (
	"errors"
	"time"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByID(id int64) (*Reservation, error) {
	if id <= 0 {
		return nil, errors.New("invalid reservation id")
	}

	return s.repo.GetByID(id)
}

func (s *Service) ListByAccountID(accountID int64) ([]Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	return s.repo.ListByAccountID(accountID)
}

func (s *Service) Create(accountID, queueID int64, timeDue time.Time) (*Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}
	if queueID <= 0 {
		return nil, errors.New("invalid queue id")
	}
	if timeDue.IsZero() {
		return nil, errors.New("timedue is required")
	}

	reservation := &Reservation{
		TimeCreated: time.Now().UTC(),
		TimeDue:     timeDue.UTC(),
		QueueID:     queueID,
		AccountID:   accountID,
	}

	if err := s.repo.Create(reservation); err != nil {
		return nil, err
	}

	return reservation, nil
}

func (s *Service) Update(accountID int64, req ReservationUpdateRequest) (*Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}
	if req.ID <= 0 {
		return nil, errors.New("invalid reservation id")
	}
	if req.TimeDue != nil && req.TimeDue.IsZero() {
		return nil, errors.New("timedue is required")
	}
	if req.QueueID != nil && *req.QueueID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	current, err := s.repo.GetByID(req.ID)
	if err != nil {
		return nil, err
	}
	if current.AccountID != accountID {
		return nil, errors.New("reservation not found")
	}

	if err := s.repo.Update(accountID, req); err != nil {
		return nil, err
	}

	return s.repo.GetByID(req.ID)
}
