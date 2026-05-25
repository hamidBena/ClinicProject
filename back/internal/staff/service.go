package staff

import "errors"

type Service struct {
    repo *Repository
}

func NewService(repo *Repository) *Service {
    return &Service{repo: repo}
}

func (s *Service) GetByAccountID(accountID int) (*Staff, error) {
    if accountID <= 0 {
        return nil, errors.New("invalid account id")
    }
    return s.repo.GetStaffByAccountID(accountID)
}

func (s *Service) UpdateProfile(accountID int, req ProfileUpdateRequest) (*Staff, error) {
    if accountID <= 0 {
        return nil, errors.New("invalid account id")
    }
    current, err := s.repo.GetStaffByAccountID(accountID)
    if err != nil {
        return nil, err
    }
    if req.Username == ""    { req.Username    = current.Username }
    if req.FirstName == ""   { req.FirstName   = current.FirstName }
    if req.LastName == ""    { req.LastName    = current.LastName }
    if req.Email == ""       { req.Email       = current.Email }
    if req.PhoneNumber == "" { req.PhoneNumber = current.PhoneNumber }
    if req.Address == ""     { req.Address     = current.Address }
    if req.Birthday == ""    { req.Birthday    = current.Birthday }
    if req.Post == ""        { req.Post        = current.Post }

    if err := s.repo.UpdateStaffProfile(accountID, req); err != nil {
        return nil, err
    }
    return s.repo.GetStaffByAccountID(accountID)
}