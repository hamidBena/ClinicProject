package queue

import (
	"clinic/internal/specialities"
	"errors"
)

type Service struct {
	repo                *Repository
	specialitiesService *specialities.Service
}

func NewService(repo *Repository, sp *specialities.Service) *Service {
	return &Service{repo: repo, specialitiesService: sp}
}

func (s *Service) GetByID(id int64) (*Queue, error) {
	if id <= 0 {
		return nil, errors.New("invalid queue id")
	}

	return s.repo.GetByID(id)
}

func (s *Service) ListAll() ([]Queue, error) {
	queues, err := s.repo.ListAll()
	if err != nil {
		return nil, err
	}

	for i := range queues {
		name, err := s.specialitiesService.GetNameByID(queues[i].SpecialityID)
		if err == nil {
			queues[i].SpecialityName = name
		}
	}

	return queues, nil
}

func (s *Service) Create(req Queue) (*Queue, error) {
	if req.MaxSize <= 0 {
		return nil, errors.New("max_size must be greater than zero")
	}
	if req.QueueCurrentSize < 0 {
		return nil, errors.New("queue_current_size cannot be negative")
	}
	if req.QueueIndex < 0 {
		return nil, errors.New("queue_index cannot be negative")
	}
	if req.SpecialityID <= 0 {
		return nil, errors.New("speciality_id is required")
	}
	if req.QueueCurrentSize > req.MaxSize {
		return nil, errors.New("queue_current_size cannot exceed max_size")
	}

	queue := &Queue{
		MaxSize:          req.MaxSize,
		QueueCurrentSize: req.QueueCurrentSize,
		QueueIndex:       req.QueueIndex,
		SpecialityID:     req.SpecialityID,
	}

	if err := s.repo.Create(queue); err != nil {
		return nil, err
	}

	return queue, nil
}

func (s *Service) Update(req QueueUpdateRequest) (*Queue, error) {
	if req.ID <= 0 {
		return nil, errors.New("invalid queue id")
	}

	if req.MaxSize != nil && *req.MaxSize <= 0 {
		return nil, errors.New("max_size must be greater than zero")
	}
	if req.QueueCurrentSize != nil && *req.QueueCurrentSize < 0 {
		return nil, errors.New("queue_current_size cannot be negative")
	}
	if req.QueueIndex != nil && *req.QueueIndex < 0 {
		return nil, errors.New("queue_index cannot be negative")
	}
	if req.SpecialityID != nil && *req.SpecialityID <= 0 {
		return nil, errors.New("speciality_id is required")
	}

	current, err := s.repo.GetByID(req.ID)
	if err != nil {
		return nil, err
	}

	if req.MaxSize != nil {
		current.MaxSize = *req.MaxSize
	}
	if req.QueueCurrentSize != nil {
		current.QueueCurrentSize = *req.QueueCurrentSize
	}
	if req.QueueIndex != nil {
		current.QueueIndex = *req.QueueIndex
	}
	if req.SpecialityID != nil {
		current.SpecialityID = *req.SpecialityID
	}

	if current.QueueCurrentSize > current.MaxSize {
		return nil, errors.New("queue_current_size cannot exceed max_size")
	}

	if err := s.repo.Update(req.ID, req); err != nil {
		return nil, err
	}

	return s.repo.GetByID(req.ID)
}
