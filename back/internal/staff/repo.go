package staff

import (
    "clinic/internal/user"
    "database/sql"
    "errors"
)

type Repository struct {
    db       *sql.DB
    userRepo *user.Repository
}

func NewRepository(db *sql.DB, userRepo *user.Repository) *Repository {
    return &Repository{db: db, userRepo: userRepo}
}

func (r *Repository) GetStaffByAccountID(accountID int) (*Staff, error) {
    if accountID <= 0 {
        return nil, errors.New("invalid account id")
    }

    usr, err := r.userRepo.GetUserByAccountID(accountID)
    if err != nil {
        return nil, err
    }

    var post, recruitmentDate string
    err = r.db.QueryRow(`
        SELECT COALESCE(post, ''), COALESCE(recruitment_date, '')
        FROM medical_staff WHERE account_id = ?
    `, accountID).Scan(&post, &recruitmentDate)
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, errors.New("staff profile not found")
        }
        return nil, err
    }

    return &Staff{
        User:            *usr,
        Post:            post,
        RecruitmentDate: recruitmentDate,
    }, nil
}

func (r *Repository) UpdateStaffProfile(accountID int, req ProfileUpdateRequest) error {
    if accountID <= 0 {
        return errors.New("invalid account id")
    }

    if err := r.userRepo.UpdateUserProfile(accountID, req.ProfileUpdateRequest); err != nil {
        return err
    }

    _, err := r.db.Exec(`
        UPDATE medical_staff SET post = ?, recruitment_date = ? WHERE account_id = ?
    `, req.Post, req.RecruitmentDate, accountID)
    return err
}