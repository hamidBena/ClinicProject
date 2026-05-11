package doctor

import (
	"clinic/internal/user"
	"database/sql"
	"errors"
)

// Repository handles doctor profile database operations
type Repository struct {
	db       *sql.DB
	userRepo *user.Repository
}

// NewRepository creates a new doctor repository
func NewRepository(db *sql.DB, userRepo *user.Repository) *Repository {
	return &Repository{
		db:       db,
		userRepo: userRepo,
	}
}

// GetDoctorByAccountID fetches a doctor profile by account ID
func (r *Repository) GetDoctorByAccountID(accountID int) (*Doctor, error) {
	if accountID <= 0 {
		return nil, errors.New("invalid account id")
	}

	// Get user data via userRepo
	usr, err := r.userRepo.GetUserByAccountID(accountID)
	if err != nil {
		return nil, err
	}

	// Get doctor-specific data
	var address string
	var specialityID int64
	row := r.db.QueryRow("SELECT address, speciality_id FROM doctors WHERE account_id = ?", accountID)
	err = row.Scan(&address, &specialityID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("doctor profile not found")
		}
		return nil, err
	}

	return &Doctor{
		User:         *usr,
		Address:      address,
		SpecialityID: specialityID,
	}, nil
}

// UpdateDoctorProfile updates a doctor's profile data
func (r *Repository) UpdateDoctorProfile(accountID int, req ProfileUpdateRequest) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}

	// Update user fields via userRepo
	err := r.userRepo.UpdateUserProfile(accountID, req.ProfileUpdateRequest)
	if err != nil {
		return err
	}

	// Build update query for doctor-specific fields
	var query string
	var args []interface{}

	if req.Address != "" && req.SpecialityID > 0 {
		query = "UPDATE doctors SET address = ?, speciality_id = ? WHERE account_id = ?"
		args = []interface{}{req.Address, req.SpecialityID, accountID}
	} else if req.Address != "" {
		query = "UPDATE doctors SET address = ? WHERE account_id = ?"
		args = []interface{}{req.Address, accountID}
	} else if req.SpecialityID > 0 {
		query = "UPDATE doctors SET speciality_id = ? WHERE account_id = ?"
		args = []interface{}{req.SpecialityID, accountID}
	} else {
		// No doctor fields to update
		return nil
	}

	_, err = r.db.Exec(query, args...)
	return err
}

func (r *Repository) SpecialityExists(id int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM specialities WHERE id_speciality = ?
		)
	`, id).Scan(&exists)
	return exists, err
}
