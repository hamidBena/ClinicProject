package specialities

import (
	"database/sql"
	"errors"
	"fmt"
)

// Repository handles DB operations for specialities
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new Repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// GetNameByID returns the speciality name for given id
func (r *Repository) GetNameByID(id int64) (string, error) {
	if id <= 0 {
		return "", errors.New("invalid id")
	}

	var name string
	row := r.db.QueryRow("SELECT name FROM specialities WHERE id_speciality = ?", id)
	err := row.Scan(&name)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", errors.New("speciality not found")
		}
		return "", err
	}

	return name, nil
}

type SpecialityWithCount struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Desc        string `json:"desc"`
	DoctorCount int    `json:"doctor_count"`
}

// ListAllWithCounts returns all specialities and how many doctors each has
func (r *Repository) ListAllWithCounts() ([]SpecialityWithCount, error) {
	rows, err := r.db.Query(
		`SELECT s.id_speciality, s.name, COALESCE(s.description, '') as description, COUNT(d.id_doctor) as doctor_count
		 FROM specialities s
		 LEFT JOIN doctors d ON d.speciality_id = s.id_speciality
		 GROUP BY s.id_speciality, s.name, description
		 ORDER BY s.id_speciality ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	list := make([]SpecialityWithCount, 0)
	for rows.Next() {
		var s SpecialityWithCount
		var desc string
		var count int
		if err := rows.Scan(&s.ID, &s.Name, &desc, &count); err != nil {
			return nil, err
		}
		s.Desc = desc
		s.DoctorCount = count
		list = append(list, s)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return list, nil
}
