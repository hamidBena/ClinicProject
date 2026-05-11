package reservations

import (
	"clinic/internal/auth"
	"encoding/json"
	"net/http"
	"time"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Reservations(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := session.AccountID

	switch r.Method {
	case http.MethodGet:
		reservations, err := h.service.ListByAccountID(accountID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(reservations)

	case http.MethodPost:
		var req struct {
			QueueID   int64     `json:"queue_id"`
			TimeDue   time.Time `json:"timedue"`
			TimeDueAt time.Time `json:"time_due"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		timeDue := req.TimeDue
		if timeDue.IsZero() {
			timeDue = req.TimeDueAt
		}

		reservation, err := h.service.Create(accountID, req.QueueID, timeDue)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(reservation)

	case http.MethodPatch:
		var req ReservationUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		updated, err := h.service.Update(accountID, req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(updated)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
