package reservations

import (
	"errors"
	"time"

	"clinic/internal/notifications"
)

type Service struct {
	repo     *Repository
	notifier *notifications.Manager
}

func NewService(repo *Repository, notifier *notifications.Manager) *Service {
	return &Service{repo: repo, notifier: notifier}
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

func (s *Service) ListByQueueID(queueID int64) ([]Reservation, error) {
	if queueID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	return s.repo.ListByQueueID(queueID)
}

func (s *Service) Create(accountID, queueID int64) (*Reservation, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}
	if queueID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	reservation := &Reservation{
		TimeCreated: time.Now().UTC(),
		QueueID:     queueID,
		Status:      "Waiting",
		AccountID:   accountID,
	}

	if err := s.repo.Create(reservation); err != nil {
		return nil, err
	}
	if s.notifier != nil {
		_, _ = s.notifier.ReservationCreated(accountID, reservation.ID, queueID)
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
	if s.notifier != nil {
		if updated, err := s.repo.GetByID(req.ID); err == nil {
			_, _ = s.notifier.ReservationUpdated(accountID, updated.ID, updated.Status)
		}
	}

	return s.repo.GetByID(req.ID)
}

func (s *Service) UpdateByStaff(req ReservationUpdateRequest) error {
    if req.ID <= 0 {
        return errors.New("invalid reservation id")
    }
    current, err := s.repo.GetByID(req.ID)
    if err != nil {
        return err
    }
    return s.repo.Update(current.AccountID, req)
}