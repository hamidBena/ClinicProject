package doctor

import (
	"clinic/internal/auth"
	"encoding/json"
	"net/http"
)

// Handler handles doctor HTTP endpoints
type Handler struct {
	service *Service
}

// NewHandler creates a new doctor handler
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Profile handles GET and PATCH for /doctors/me
func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := int(session.AccountID)

	switch r.Method {
	case http.MethodGet:
		doctor, err := h.service.GetByAccountID(accountID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(doctor)

	case http.MethodPatch:
		var req ProfileUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		updatedDoctor, err := h.service.UpdateProfile(accountID, req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(updatedDoctor)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) SetAvailability(w http.ResponseWriter, r *http.Request) {
    // only PATCH, only admin or doctor role
    // body: { "availability": "Available" | "Unavailable" }
    // calls service which calls repo UPDATE
}