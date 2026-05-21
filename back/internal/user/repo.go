package user

import (
	"clinic/internal/auth"
	"database/sql"
)

type Repository struct {
	db       *sql.DB
	authRepo *auth.Repository
}

func NewRepository(db *sql.DB, authRepo *auth.Repository) *Repository {
	if authRepo == nil {
		authRepo = auth.NewRepository(db)
	}

	return &Repository{db: db, authRepo: authRepo}
}

func (r *Repository) GetUserByAccountID(accountID int) (*User, error) {
	account, err := r.authRepo.GetAccountByID(int64(accountID))
	if err != nil {
		return nil, err
	}

	role, err := r.authRepo.GetAccountRole(int64(accountID))
	if err != nil {
		return nil, err
	}

	return &User{
		ID:          account.ID,
		AccountID:   account.ID,
		Username:    account.Username,
		FirstName:   account.FirstName,
		LastName:    account.LastName,
		PhoneNumber: account.PhoneNumber,
		Gender:      account.Gender,
		Address:     account.Address,
		Birthday:    account.Birthday,
		Email:       account.Email,
		Role:        role,
		AvatarURL:   account.AvatarURL,
	}, nil
}

func (r *Repository) UpdateUserProfile(accountID int, update ProfileUpdateRequest) error {
	query := `
		UPDATE accounts
		SET username = ?, phone_number = ?, address = ?, birthday = ?
		WHERE id_account = ?
	`
	_, err := r.db.Exec(query, update.Username, update.PhoneNumber, update.Address, update.Birthday, accountID)
	return err
}

// UpdateAvatarURL sets the avatar URL for the given account
func (r *Repository) UpdateAvatarURL(accountID int64, avatarURL string) error {
	_, err := r.db.Exec(`UPDATE accounts SET avatar_url = ? WHERE id_account = ?`, avatarURL, accountID)
	return err
}
