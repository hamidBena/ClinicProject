package specialities

import "errors"

// Service provides business logic for specialities
type Service struct {
	repo *Repository
}

// NewService creates a new Service
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// GetNameByID validates input and returns the speciality name
func (s *Service) GetNameByID(id int64) (string, error) {
	if id <= 0 {
		return "", errors.New("invalid id")
	}
	return s.repo.GetNameByID(id)
}

func (s *Service) ListAllWithCounts() ([]SpecialityWithCount, error) {
	return s.repo.ListAllWithCounts()
}
