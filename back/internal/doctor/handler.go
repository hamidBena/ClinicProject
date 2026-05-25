package doctor

import (
    "clinic/internal/auth"
    "database/sql"
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

// ListBySpeciality handles GET /doctors?speciality_id=X
func (h *Handler) ListBySpeciality(w http.ResponseWriter, r *http.Request) {
    specialityID := r.URL.Query().Get("speciality_id")

    var rows *sql.Rows
    var err error

    query := `
        SELECT a.id_account, a.first_name, a.last_name,
               COALESCE(s.name, ''), COALESCE(d.availability, 'Available'),
               COALESCE(d.working_day_description, '')
        FROM doctors d
        JOIN accounts a ON a.id_account = d.account_id
        LEFT JOIN specialities s ON s.id_speciality = d.speciality_id
        WHERE COALESCE(a.is_blocked, 0) = 0
    `
    if specialityID != "" {
        query += ` AND d.speciality_id = ?`
        rows, err = h.service.DB().Query(query, specialityID)
    } else {
        rows, err = h.service.DB().Query(query)
    }
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    type Row struct {
        AccountID    int    `json:"account_id"`
        FirstName    string `json:"first_name"`
        LastName     string `json:"last_name"`
        Speciality   string `json:"speciality"`
        Availability string `json:"availability"`
        WorkingDays  string `json:"working_day_description"`
    }

    result := []Row{}
    for rows.Next() {
        var d Row
        if err := rows.Scan(&d.AccountID, &d.FirstName, &d.LastName,
            &d.Speciality, &d.Availability, &d.WorkingDays); err != nil {
            continue
        }
        result = append(result, d)
    }

    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(result)
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
    if r.Method != http.MethodPatch {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
        return
    }

    session, ok := auth.SessionFromContext(r.Context())
    if !ok {
        http.Error(w, "unauthorized", http.StatusUnauthorized)
        return
    }

    var req struct {
        Availability string `json:"availability"`
    }
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid JSON body", http.StatusBadRequest)
        return
    }
    if req.Availability != "Available" && req.Availability != "Unavailable" {
        http.Error(w, "availability must be 'Available' or 'Unavailable'", http.StatusBadRequest)
        return
    }

    if err := h.service.SetAvailability(int(session.AccountID), req.Availability); err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }

    w.WriteHeader(http.StatusNoContent)
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
