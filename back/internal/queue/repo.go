package queue

import (
	"database/sql"
	"errors"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(queue *Queue) error {
	if queue == nil {
		return errors.New("queue is nil")
	}

	result, err := r.db.Exec(
		`INSERT INTO queues (queue_maxSize, queue_size, queue_index, queue_state, speciality_id)
		 VALUES (?, ?, ?, ?, ?)`,
		queue.MaxSize,
		queue.QueueCurrentSize,
		queue.QueueIndex,
		queue.SpecialityID,
	)
	if err != nil {
		return err
	}

	queue.ID, err = result.LastInsertId()
	return err
}

func (r *Repository) Update(queueID int64, req QueueUpdateRequest) error {
	if queueID <= 0 {
		return errors.New("invalid queue id")
	}

	assignments := make([]string, 0)
	args := make([]interface{}, 0)

	if req.MaxSize != nil {
		assignments = append(assignments, "queue_maxSize = ?")
		args = append(args, *req.MaxSize)
	}
	if req.QueueCurrentSize != nil {
		assignments = append(assignments, "queue_size = ?")
		args = append(args, *req.QueueCurrentSize)
	}
	if req.QueueIndex != nil {
		assignments = append(assignments, "queue_index = ?")
		args = append(args, *req.QueueIndex)
	}
	if req.SpecialityID != nil {
		assignments = append(assignments, "speciality_id = ?")
		args = append(args, *req.SpecialityID)
	}

	if len(assignments) == 0 {
		return errors.New("no queue fields to update")
	}

	args = append(args, queueID)
	query := "UPDATE queues SET " + strings.Join(assignments, ", ") + " WHERE id_queue = ?"
	result, err := r.db.Exec(query, args...)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errors.New("queue not found")
	}

	return nil
}

func (r *Repository) GetByID(id int64) (*Queue, error) {
	if id <= 0 {
		return nil, errors.New("invalid queue id")
	}

	var queue Queue
	err := r.db.QueryRow(
		`SELECT id_queue, queue_maxSize, queue_size, queue_index, speciality_id
		 FROM queues
		 WHERE id_queue = ?`,
		id,
	).Scan(
		&queue.ID,
		&queue.MaxSize,
		&queue.QueueCurrentSize,
		&queue.QueueIndex,
		&queue.SpecialityID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errors.New("queue not found")
		}
		return nil, err
	}

	return &queue, nil
}

func (r *Repository) ListAll() ([]Queue, error) {
	rows, err := r.db.Query(
		`SELECT id_queue, queue_maxSize, queue_size, queue_index, speciality_id
		 FROM queues
		 ORDER BY id_queue ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	queues := make([]Queue, 0)
	for rows.Next() {
		var queue Queue
		if err := rows.Scan(
			&queue.ID,
			&queue.MaxSize,
			&queue.QueueCurrentSize,
			&queue.QueueIndex,
			&queue.SpecialityID,
		); err != nil {
			return nil, err
		}
		queues = append(queues, queue)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return queues, nil
}
