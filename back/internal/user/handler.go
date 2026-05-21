package user

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

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Profile handles current logged-in user profile operations.
// GET returns profile, PATCH updates profile.
func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := int(session.AccountID)

	switch r.Method {
	case http.MethodGet:
		user, err := h.service.GetByAccountID(accountID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(user)

	case http.MethodPatch:
		var req ProfileUpdateRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON body", http.StatusBadRequest)
			return
		}

		updatedUser, err := h.service.UpdateProfile(accountID, req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(updatedUser)

	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// UploadAvatar handles multipart upload for user avatars
func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
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
		if strings.TrimSpace(profile.AvatarURL) == "" {
			http.Error(w, "avatar not found", http.StatusNotFound)
			return
		}

		http.Redirect(w, r, profile.AvatarURL, http.StatusFound)
		return
	}

	// Limit to 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "file too large", http.StatusBadRequest)
		return
	}

	file, hdr, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field 'file'", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read up to 512 bytes to sniff content type
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	if !strings.HasPrefix(contentType, "image/") {
		http.Error(w, "unsupported file type", http.StatusBadRequest)
		return
	}
	// Reset reader
	if seeker, ok := file.(io.Seeker); ok {
		seeker.Seek(0, io.SeekStart)
	} else {
		// fallback: read entire file into memory (shouldn't happen for typical net/http)
		http.Error(w, "cannot seek file stream", http.StatusInternalServerError)
		return
	}

	ext := filepath.Ext(hdr.Filename)
	fname := fmt.Sprintf("%d-%d%s", accountID, time.Now().UnixNano(), ext)
	dstDir := filepath.Join("uploads", "avatars")
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

	avatarURL := "/uploads/avatars/" + fname
	if err := h.service.UpdateAvatar(accountID, avatarURL); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]string{"avatar_url": avatarURL})
}
