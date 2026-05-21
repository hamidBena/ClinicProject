package specialities

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

// Handler handles HTTP endpoints for specialities
type Handler struct {
	service *Service
}

// NewHandler creates a new Handler
func NewHandler(s *Service) *Handler {
	return &Handler{service: s}
}

// GetByID handles GET /specialities/{id} and returns the speciality name
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/specialities/")
	idStr = strings.Trim(idStr, "/")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	name, err := h.service.GetNameByID(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"name": name})
}

// ListAll handles GET /specialities and returns all specialities with doctor counts
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	list, err := h.service.ListAllWithCounts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}
