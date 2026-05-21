package notifications

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

type NotificationCreateRequest struct {
	Message string    `json:"message"`
	Date    time.Time `json:"date"`
}

// Notifications handles creating and listing notifications for the authenticated user.
// Note: this handler is implemented but not wired into the router by default.
func (h *Handler) Notifications(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := session.AccountID

	switch r.Method {
	case http.MethodGet:
		list, err := h.service.ListByAccountID(accountID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(list)

	case http.MethodPost:
		var req NotificationCreateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		n, err := h.service.Create(accountID, req.Message, req.Date)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(n)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
