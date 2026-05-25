package auth

import (
	"database/sql"
	"errors"
	"strings"

	"clinic/pkg/utils"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func uniqueErr(err error) error {
	if err == nil {
		return nil
	}
	msg := err.Error()
	if strings.Contains(msg, "accounts.email") {
		return errors.New("email already exists")
	}
	if strings.Contains(msg, "accounts.phone_number") {
		return errors.New("phone number already exists")
	}
	if strings.Contains(msg, "accounts.username") {
		return errors.New("username already exists")
	}
	if strings.Contains(msg, "patients.insurance_number") {
		return errors.New("insurance number already exists")
	}
	return err
}

func (r *Repository) CreateAccountAndPatient(a SignUpRequest, insuranceNumber string, chronicDiseases string) (int64, error) {
	a.Email = strings.ToLower(strings.TrimSpace(a.Email))
	a.Gender = strings.TrimSpace(a.Gender)

	hashedPassword, err := utils.HashPassword(a.Password)
	if err != nil {
		return 0, err
	}

	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(`
		INSERT INTO accounts (username, first_name, last_name, phone_number, gender, address, birthday, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.Username, a.FirstName, a.LastName, a.PhoneNumber, a.Gender, a.Address, a.Birthday, a.Email, hashedPassword)
	if err != nil {
		return 0, uniqueErr(err)
	}

	accountID, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	_, err = tx.Exec(`
		INSERT INTO patients (account_id, insurance_number, chronic_diseases)
		VALUES (?, ?, ?)
	`, accountID, insuranceNumber, chronicDiseases)
	if err != nil {
		return 0, uniqueErr(err)
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return accountID, nil
}

func (r *Repository) CreateAccount(a SignUpRequest) (int64, error) {
	a.Email = strings.ToLower(strings.TrimSpace(a.Email))
	a.Gender = strings.TrimSpace(a.Gender)

	hashedPassword, err := utils.HashPassword(a.Password)
	if err != nil {
		return 0, err
	}

	result, err := r.db.Exec(`
		INSERT INTO accounts (username, first_name, last_name, phone_number, gender, address, birthday, email, password_hash)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, a.Username, a.FirstName, a.LastName, a.PhoneNumber, a.Gender, a.Address, a.Birthday, a.Email, hashedPassword)
	if err != nil {
		return 0, uniqueErr(err)
	}

	return result.LastInsertId()
}

func (r *Repository) CreatePatient(accountID int64, insuranceNumber string) error {
	_, err := r.db.Exec(`
		INSERT INTO patients (account_id, insurance_number)
		VALUES (?, ?)
	`, accountID, insuranceNumber)
	return uniqueErr(err)
}

func (r *Repository) CreateDoctor(accountID int64, speciality_id int32) error {
    query := `
        INSERT INTO doctors (account_id, speciality_id, availability)
        VALUES (?, ?, 'Available')
    `
    _, err := r.db.Exec(query, accountID, speciality_id)
    return err
}

func (r *Repository) CreateStaff(accountID int64, post string, recruitmentDate string) error {
	_, err := r.db.Exec(`
        INSERT INTO medical_staff (account_id, post, recruitment_date)
        VALUES (?, ?, ?)
    `, accountID, post, recruitmentDate)
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
	email = strings.ToLower(strings.TrimSpace(email))
	var account Account
	err := r.db.QueryRow(`
    	SELECT id_account, username, first_name, last_name, phone_number, COALESCE(gender, ''), COALESCE(address, ''), COALESCE(birthday, ''), email, password_hash, COALESCE(avatar_url, ''), COALESCE(is_blocked, 0)
    	FROM accounts
    	WHERE LOWER(email) = LOWER(?)
	`, email).Scan(&account.ID, &account.Username, &account.FirstName,
		&account.LastName, &account.PhoneNumber, &account.Gender, &account.Address, &account.Birthday, &account.Email,
		&account.PasswordHash, &account.AvatarURL, &account.IsBlocked)

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
		SELECT id_account, username, first_name, last_name, phone_number, COALESCE(gender, ''), COALESCE(address, ''), COALESCE(birthday, ''), email, password_hash, COALESCE(avatar_url, '')
		FROM accounts
		WHERE id_account = ?
	`, accountID).Scan(&account.ID, &account.Username, &account.FirstName,
		&account.LastName, &account.PhoneNumber, &account.Gender, &account.Address, &account.Birthday, &account.Email,
		&account.PasswordHash, &account.AvatarURL)

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
    	UNION
    	SELECT 'staff' as role FROM medical_staff WHERE account_id = ?
    	LIMIT 1
	`, accountID, accountID, accountID, accountID).Scan(&role)

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