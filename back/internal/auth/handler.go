package auth

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type Handler struct {
	service      *Service
	sessionStore *SessionStore
}

func NewHandler(s *Service, sessionStore *SessionStore) *Handler {
	return &Handler{service: s, sessionStore: sessionStore}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type registerPayload struct {
		SignUpRequest
		InsuranceNumber string `json:"insurance_number"`
		Speciality_id   int32  `json:"speciality_id"`
		DoctorAddress   string `json:"doctor_address"`
	}

	var payload registerPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	role := strings.ToLower(strings.TrimSpace(payload.Role))
	if role == "" {
		http.Error(w, "role is required", http.StatusBadRequest)
		return
	}

	switch role {
	case "patient":
		request := SignUpRequestPatient{SignUpRequest: payload.SignUpRequest}
		request.InsuranceNumber = strings.TrimSpace(payload.InsuranceNumber)
		if request.InsuranceNumber == "" {
			http.Error(w, "insurance_number is required for patient", http.StatusBadRequest)
			return
		}
		if err := h.service.RegisterPatient(request); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	case "doctor":
		request := SignUpRequestDoctor{SignUpRequest: payload.SignUpRequest}
		request.Speciality_id = payload.Speciality_id
		request.Address = strings.TrimSpace(payload.DoctorAddress)
		if request.Address == "" {
			http.Error(w, "doctor_address is required for doctor", http.StatusBadRequest)
			return
		}
		if err := h.service.RegisterDoctor(request); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, "role must be 'patient' or 'doctor'", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "registered"})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	type loginPayload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	var payload loginPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	account, err := h.service.Login(payload.Email, payload.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	token := h.sessionStore.Create(int64(account.ID), account.Email, account.Role)
	// Set Secure flag when request is over TLS
	secureFlag := r.TLS != nil
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   secureFlag,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(24 * time.Hour),
	})

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(account)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session, ok := SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"account_id": session.AccountID,
		"email":      session.Email,
		"role":       session.Role,
	})
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	cookie, err := r.Cookie("session_token")
	if err == nil {
		h.sessionStore.Delete(cookie.Value)
		cookie.Value = ""
		cookie.Path = "/"
		cookie.Expires = time.Unix(0, 0)
		// Preserve Secure flag based on request
		cookie.Secure = r.TLS != nil
		cookie.HttpOnly = true
		cookie.SameSite = http.SameSiteLaxMode
		http.SetCookie(w, cookie)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "logged out"})
}

func (h *Handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	defer r.Body.Close()

	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if req.Email == "" {
		http.Error(w, "email is required", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	json.NewEncoder(w).Encode(map[string]string{
		"message": "If this email exists, reset instructions have been sent.",
	})
}

func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	session, ok := SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if err := h.service.ChangePassword(session.AccountID, req.CurrentPassword, req.NewPassword); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"message": "password changed"})
}

func (h *Handler) Ping(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("pong"))
}
