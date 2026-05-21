package doctor

import (
	"clinic/internal/auth"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
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

// UploadCertificate allows a doctor to upload a single certificate file.
func (h *Handler) UploadCertificate(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := int64(session.AccountID)

	if r.Method == http.MethodGet {
		profile, err := h.service.GetByAccountID(int(accountID))
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		if strings.TrimSpace(profile.CertificateURL) == "" {
			http.Error(w, "certificate not found", http.StatusNotFound)
			return
		}

		http.Redirect(w, r, profile.CertificateURL, http.StatusFound)
		return
	}

	// Limit to 20MB
	r.Body = http.MaxBytesReader(w, r.Body, 20<<20)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "file too large", http.StatusBadRequest)
		return
	}

	file, hdr, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field 'file'", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// detect content type
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	if !(strings.HasPrefix(contentType, "application/") || strings.HasPrefix(contentType, "image/")) {
		http.Error(w, "unsupported file type", http.StatusBadRequest)
		return
	}
	if seeker, ok := file.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	} else {
		http.Error(w, "cannot seek file stream", http.StatusInternalServerError)
		return
	}

	ext := filepath.Ext(hdr.Filename)
	fname := fmt.Sprintf("%d-%d%s", accountID, time.Now().UnixNano(), ext)
	dstDir := filepath.Join("uploads", "certificates")
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	dstPath := filepath.Join(dstDir, fname)

	out, err := os.Create(dstPath)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	defer out.Close()

	if _, err := io.Copy(out, file); err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	certURL := "/uploads/certificates/" + fname
	if err := h.service.UpdateCertificate(accountID, certURL); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"certificate_url": certURL})
}
