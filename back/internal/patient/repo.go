package patient

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
	if userRepo == nil {
		userRepo = user.NewRepository(db, nil)
	}

	return &Repository{db: db, userRepo: userRepo}
}

func (r *Repository) GetPatientByAccountID(accountID int) (*Patient, error) {
	u, err := r.userRepo.GetUserByAccountID(accountID)
	if err != nil {
		return nil, err
	}

	var insuranceNumber sql.NullString
	var chronicDiseases sql.NullString
	var medicalFileURL sql.NullString

	err = r.db.QueryRow(`
    	SELECT insurance_number, chronic_diseases, COALESCE(medical_file_url, '')
    	FROM patients WHERE account_id = ?
	`, accountID).Scan(&insuranceNumber, &chronicDiseases, &medicalFileURL)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("patient not found")
		}
		return nil, err
	}

	return &Patient{
		User:            *u,
		InsuranceNumber: insuranceNumber.String,
		ChronicDiseases: chronicDiseases.String,
		MedicalFileURL:  medicalFileURL.String,
	}, nil
}

func (r *Repository) UpdatePatientProfile(accountID int, update ProfileUpdateRequest) error {
	err := r.userRepo.UpdateUserProfile(accountID, update.ProfileUpdateRequest)
	if err != nil {
		return err
	}

	_, err = r.db.Exec(`
    	UPDATE patients
    	SET insurance_number = ?, chronic_diseases = ?
    	WHERE account_id = ?
	`, update.InsuranceNumber, update.ChronicDiseases, accountID)
	return err
}

func (r *Repository) UpdateMedicalFileURL(accountID int, medicalFileURL string) error {
	_, err := r.db.Exec(`UPDATE patients SET medical_file_url = ? WHERE account_id = ?`, medicalFileURL, accountID)
	return err
}
