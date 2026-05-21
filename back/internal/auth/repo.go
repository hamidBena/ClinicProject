package auth

import (
	"database/sql"
	"errors"

	"clinic/pkg/utils"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateAccount(a SignUpRequest) (int64, error) {
	hashedPassword, err := utils.HashPassword(a.Password)
	if err != nil {
		return 0, err
	}

	query := `
		INSERT INTO accounts (username, first_name, last_name, phone_number, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?)
	`

	result, err := r.db.Exec(query, a.Username, a.FirstName, a.LastName, a.PhoneNumber, a.Email, hashedPassword)
	if err != nil {
		if err.Error() == "UNIQUE constraint failed: accounts.email" {
			return 0, errors.New("email already exists")
		}
		return 0, err
	}

	return result.LastInsertId()
}

func (r *Repository) CreatePatient(accountID int64, insuranceNumber string) error {
	query := `
		INSERT INTO patients (account_id, insurance_number)
		VALUES (?, ?)
	`

	_, err := r.db.Exec(query, accountID, insuranceNumber)
	return err
}

func (r *Repository) CreateDoctor(accountID int64, speciality_id int32, address string) error {
	query := `
		INSERT INTO doctors (account_id, speciality_id, address, availability)
		VALUES (?, ?, ?, 'Available')
	`

	_, err := r.db.Exec(query, accountID, speciality_id, address)
	return err
}

func (r *Repository) SpecialityExists(id int32) (bool, error) {
	var exists bool
	err := r.db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM specialities WHERE id_speciality = ?
		)
	`, id).Scan(&exists)

	return exists, err
}

func (r *Repository) GetAccountByEmail(email string) (*Account, error) {
	var account Account
	err := r.db.QueryRow(`
		SELECT id_account, username, first_name, last_name, phone_number, email, password_hash
		FROM accounts
		WHERE email = ?
	`, email).Scan(&account.ID, &account.Username, &account.FirstName,
		&account.LastName, &account.PhoneNumber, &account.Email,
		&account.PasswordHash)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("account not found")
		}
		return nil, err
	}

	return &account, nil
}

func (r *Repository) GetAccountByID(accountID int64) (*Account, error) {
	var account Account
	err := r.db.QueryRow(`
		SELECT id_account, username, first_name, last_name, phone_number, email, password_hash
		FROM accounts
		WHERE id_account = ?
	`, accountID).Scan(&account.ID, &account.Username, &account.FirstName,
		&account.LastName, &account.PhoneNumber, &account.Email,
		&account.PasswordHash)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("account not found")
		}
		return nil, err
	}

	return &account, nil
}

func (r *Repository) GetAccountRole(accountID int64) (string, error) {
	var role string
	err := r.db.QueryRow(`
		SELECT 'admin' as role FROM admins WHERE account_id = ?
		UNION
		SELECT 'doctor' as role FROM doctors WHERE account_id = ?
		UNION
		SELECT 'patient' as role FROM patients WHERE account_id = ?
		LIMIT 1
	`, accountID, accountID, accountID).Scan(&role)

	if err != nil {
		if err == sql.ErrNoRows {
			return "", errors.New("account role not found")
		}
		return "", err
	}

	return role, nil
}

func (r *Repository) VerifyPassword(hashedPassword, plainPassword string) bool {
	return utils.VerifyPassword(hashedPassword, plainPassword)
}

func (r *Repository) UpdatePasswordHash(accountID int64, passwordHash string) error {
	_, err := r.db.Exec(`
		UPDATE accounts
		SET password_hash = ?
		WHERE id_account = ?
	`, passwordHash, accountID)
	return err
}
