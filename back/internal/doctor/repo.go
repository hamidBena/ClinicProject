package doctor

import (
	"clinic/internal/user"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
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
	var specialityID int64
	var availability string
	var workingDaysRaw string
	var certificateURL string
	var numAgrement string

	row := r.db.QueryRow(`
    	SELECT speciality_id,
           availability,
           COALESCE(working_day_description, ''),
           COALESCE(certificate_url, ''),
           COALESCE(num_agrement, '')
        FROM doctors
        WHERE account_id = ?
	`, accountID)

	err = row.Scan(
		&specialityID,
		&availability,
		&workingDaysRaw,
		&certificateURL,
		&numAgrement,
	)
	var workingDays []string
	if workingDaysRaw != "" {
		for _, d := range strings.Split(workingDaysRaw, ",") {
			d = strings.TrimSpace(d)
			if d != "" {
				workingDays = append(workingDays, d)
			}
		}
	}
	return &Doctor{
		User:           *usr,
		SpecialityID:   specialityID,
		Availability:   availability,
		WorkingDays:    workingDays,
		CertificateURL: certificateURL,
		NumAgrement:    numAgrement,
	}, nil
}

// Set availability updates the doctor's availability status
func (r *Repository) SetAvailability(accountID int, availability string) error {
	_, err := r.db.Exec(
		`UPDATE doctors SET availability = ? WHERE account_id = ?`,
		availability, accountID,
	)
	return err
}

// UpdateDoctorProfile updates a doctor's profile data
func (r *Repository) UpdateDoctorProfile(accountID int, req ProfileUpdateRequest) error {
	if accountID <= 0 {
		return errors.New("invalid account id")
	}

	// Update user fields
	err := r.userRepo.UpdateUserProfile(accountID, req.ProfileUpdateRequest)
	if err != nil {
		return err
	}

	workingDaysJSON, err := json.Marshal(req.WorkingDays)
	if err != nil {
		return err
	}

	_, err = r.db.Exec(`
		UPDATE doctors
		SET speciality_id = ?,
		    working_days = ?
		WHERE account_id = ?
	`,
		req.SpecialityID,
		string(workingDaysJSON),
		accountID,
	)

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

// UpdateCertificateURL sets the certificate URL for the given doctor's account
func (r *Repository) UpdateCertificateURL(accountID int64, certificateURL string) error {
	_, err := r.db.Exec(`UPDATE doctors SET certificate_url = ? WHERE account_id = ?`, certificateURL, accountID)
	return err
}
