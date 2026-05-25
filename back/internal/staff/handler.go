package staff

import (
    "clinic/internal/auth"
    "encoding/json"
    "net/http"
)

type Handler struct {
    service *Service
}

func NewHandler(service *Service) *Handler {
    return &Handler{service: service}
}

func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
    session, ok := auth.SessionFromContext(r.Context())
    if !ok {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }

    accountID := int(session.AccountID)

    switch r.Method {
    case http.MethodGet:
        staff, err := h.service.GetByAccountID(accountID)
        if err != nil {
            http.Error(w, err.Error(), http.StatusNotFound)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(staff)

    case http.MethodPatch:
        var req ProfileUpdateRequest
        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, "invalid JSON body", http.StatusBadRequest)
            return
        }
        updated, err := h.service.UpdateProfile(accountID, req)
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