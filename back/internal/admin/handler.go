package admin

import (
	"clinic/internal/auth"
	"clinic/pkg/utils"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{db: db}
}

// GET /admin/me
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	session, ok := auth.SessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var firstName, lastName, username string
	err := h.db.QueryRow(`
        SELECT first_name, last_name, username FROM accounts WHERE id_account = ?
    `, session.AccountID).Scan(&firstName, &lastName, &username)
	if err != nil {
		http.Error(w, "account not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"account_id": session.AccountID,
		"first_name": firstName,
		"last_name":  lastName,
		"username":   username,
		"email":      session.Email,
		"role":       session.Role,
	})
}

// GET /admin/doctors
func (h *Handler) ListDoctors(w http.ResponseWriter, r *http.Request) {

	rows, err := h.db.Query(`
        SELECT a.id_account, a.username, a.first_name, a.last_name, a.email, a.phone_number,
           COALESCE(a.address,''), COALESCE(a.birthday,''),
           COALESCE(s.name,''), COALESCE(d.availability,''),
           COALESCE(a.avatar_url,''), COALESCE(a.is_blocked, 0),
           COALESCE(d.working_day_description,''), COALESCE(d.num_agrement,''),
		   COALESCE(sv.name_service,'')
        FROM doctors d
        JOIN accounts a ON a.id_account = d.account_id
        LEFT JOIN specialities s ON s.id_speciality = d.speciality_id
		LEFT JOIN services sv ON sv.id_service = d.service_id
        ORDER BY a.id_account ASC
    `)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Row struct {
		AccountID    int    `json:"account_id"`
		Username     string `json:"username"`
		FirstName    string `json:"first_name"`
		LastName     string `json:"last_name"`
		Email        string `json:"email"`
		Phone        string `json:"phone_number"`
		Address      string `json:"address"`
		Birthday     string `json:"birthday"`
		Speciality   string `json:"speciality"`
		Availability string `json:"availability"`
		AvatarURL    string `json:"avatar_url"`
		IsBlocked    int    `json:"is_blocked"`
		WorkingDays  string `json:"working_day_description"`
		NumAgrement  string `json:"num_agrement"`
		ServiceName  string `json:"service_name"`
	}

	result := []Row{}
	for rows.Next() {
		var d Row
		if err := rows.Scan(&d.AccountID, &d.Username, &d.FirstName, &d.LastName,
			&d.Email, &d.Phone, &d.Address, &d.Birthday,
			&d.Speciality, &d.Availability, &d.AvatarURL, &d.IsBlocked,
			&d.WorkingDays, &d.NumAgrement, &d.ServiceName); err != nil {
			continue
		}
		result = append(result, d)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// PATCH /admin/doctors/availability
func (h *Handler) SetDoctorAvailability(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AccountID    int64  `json:"account_id"`
		Availability string `json:"availability"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Availability != "Available" && req.Availability != "Unavailable" {
		http.Error(w, "availability must be 'Available' or 'Unavailable'", http.StatusBadRequest)
		return
	}

	_, err := h.db.Exec(`
        UPDATE doctors SET availability = ? WHERE account_id = ?
    `, req.Availability, req.AccountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "availability updated"})
}

// GET /admin/doctors/{id}/certificates
func (h *Handler) ListDoctorCertificates(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 4 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	accountID, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	rows, err := h.db.Query(`
        SELECT id_certificate, title, organization, date, COALESCE(file_url,'')
        FROM certificates
        WHERE doctor_id = (SELECT id_doctor FROM doctors WHERE account_id = ?)
        ORDER BY date DESC
    `, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Cert struct {
		ID           int    `json:"id"`
		Title        string `json:"title"`
		Organization string `json:"organization"`
		Date         string `json:"date"`
		FileURL      string `json:"file_url"`
	}

	result := []Cert{}
	for rows.Next() {
		var c Cert
		if err := rows.Scan(&c.ID, &c.Title, &c.Organization, &c.Date, &c.FileURL); err != nil {
			continue
		}
		result = append(result, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GET /admin/staff
func (h *Handler) ListStaff(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
        SELECT a.id_account, a.username, a.first_name, a.last_name, a.email,
               a.phone_number, COALESCE(ms.post,''), COALESCE(ms.recruitment_date,''),
               COALESCE(a.avatar_url,''), 
			   COALESCE(a.is_blocked, 0),
				COALESCE(sv.name_service,'')
        FROM medical_staff ms
        JOIN accounts a ON a.id_account = ms.account_id
		LEFT JOIN services sv ON sv.id_service = ms.service_id
        ORDER BY a.id_account ASC
    `)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Row struct {
		AccountID       int    `json:"account_id"`
		Username        string `json:"username"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		Email           string `json:"email"`
		Phone           string `json:"phone_number"`
		Post            string `json:"post"`
		RecruitmentDate string `json:"recruitment_date"`
		AvatarURL       string `json:"avatar_url"`
		IsBlocked       int    `json:"is_blocked"`
		ServiceName     string `json:"service_name"`
	}

	result := []Row{}
	for rows.Next() {
		var s Row
		if err := rows.Scan(&s.AccountID, &s.Username, &s.FirstName, &s.LastName,
			&s.Email, &s.Phone, &s.Post, &s.RecruitmentDate,
			&s.AvatarURL, &s.IsBlocked, &s.ServiceName); err != nil {
			continue
		}
		result = append(result, s)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GET /admin/patients
func (h *Handler) ListPatients(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
        SELECT a.id_account, a.first_name, a.last_name, a.email, a.phone_number,
               COALESCE(p.insurance_number,''), COALESCE(a.avatar_url,''),
               COALESCE(a.is_blocked, 0)
        FROM patients p
        JOIN accounts a ON a.id_account = p.account_id
        ORDER BY a.id_account ASC
    `)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Row struct {
		AccountID       int    `json:"account_id"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		Email           string `json:"email"`
		Phone           string `json:"phone_number"`
		InsuranceNumber string `json:"insurance_number"`
		AvatarURL       string `json:"avatar_url"`
		IsBlocked       int    `json:"is_blocked"`
	}

	result := []Row{}
	for rows.Next() {
		var p Row
		if err := rows.Scan(&p.AccountID, &p.FirstName, &p.LastName,
			&p.Email, &p.Phone, &p.InsuranceNumber,
			&p.AvatarURL, &p.IsBlocked); err != nil {
			continue
		}
		result = append(result, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// POST /admin/doctors
func (h *Handler) CreateDoctor(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Username        string `json:"username"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		Email           string `json:"email"`
		Phone           string `json:"phone_number"`
		Gender          string `json:"gender"`
		Birthday        string `json:"birthday"`
		Password        string `json:"password"`
		Address         string `json:"address"`
		SpecialityID    int64  `json:"speciality_id"`
		WorkingDays     string `json:"working_day_description"`
		NumAgrement     string `json:"num_agrement"`
		RecruitmentDate string `json:"recruitment_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	res, err := h.db.Exec(`
    	INSERT INTO accounts (username, first_name, last_name, email, phone_number, password_hash, address, gender, birthday)
    	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, req.Username, req.FirstName, req.LastName, req.Email, req.Phone, hash, req.Address, req.Gender, req.Birthday)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	accountID, _ := res.LastInsertId()

	_, err = h.db.Exec(`
    	INSERT INTO doctors (account_id, speciality_id, availability, working_day_description, num_agrement, recruitment_date)
    	VALUES (?, ?, 'Available', ?, ?, ?)
	`, accountID, req.SpecialityID, req.WorkingDays, req.NumAgrement, req.RecruitmentDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"account_id": accountID, "message": "doctor created"})
}

// POST /admin/certificates
func (h *Handler) CreateCertificate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (file + fields)
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		http.Error(w, "invalid form", http.StatusBadRequest)
		return
	}

	title := r.FormValue("title")
	organization := r.FormValue("organization")
	date := r.FormValue("date")
	doctorID := r.FormValue("doctor_id") // this is account_id from frontend

	if title == "" || organization == "" || date == "" || doctorID == "" {
		http.Error(w, "missing required fields", http.StatusBadRequest)
		return
	}

	// Resolve account_id -> doctor id_doctor
	var idDoctor int64
	err := h.db.QueryRow(`SELECT id_doctor FROM doctors WHERE account_id = ?`, doctorID).Scan(&idDoctor)
	if err != nil {
		http.Error(w, "doctor not found", http.StatusNotFound)
		return
	}

	// Handle optional file
	fileURL := ""
	file, hdr, err := r.FormFile("file")
	if err == nil {
		defer file.Close()
		ext := filepath.Ext(hdr.Filename)
		fname := fmt.Sprintf("cert-%d-%d%s", idDoctor, time.Now().UnixNano(), ext)
		dstDir := filepath.Join("uploads", "certificates")
		os.MkdirAll(dstDir, 0755)
		out, err := os.Create(filepath.Join(dstDir, fname))
		if err == nil {
			io.Copy(out, file)
			out.Close()
			fileURL = "/uploads/certificates/" + fname
		}
	}

	res, err := h.db.Exec(`
        INSERT INTO certificates (title, organization, file_url, date, doctor_id)
        VALUES (?, ?, ?, ?, ?)
    `, title, organization, fileURL, date, idDoctor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"id": id, "message": "certificate created"})
}

// POST /admin/staff
func (h *Handler) CreateStaff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Username        string `json:"username"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		Email           string `json:"email"`
		Phone           string `json:"phone_number"`
		Password        string `json:"password"`
		Post            string `json:"post"`
		RecruitmentDate string `json:"recruitment_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	hash, err := utils.HashPassword(req.Password)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}

	res, err := h.db.Exec(`
        INSERT INTO accounts (username, first_name, last_name, email, phone_number, password_hash)
        VALUES (?, ?, ?, ?, ?, ?)
    `, req.Username, req.FirstName, req.LastName, req.Email, req.Phone, hash)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	accountID, _ := res.LastInsertId()

	_, err = h.db.Exec(`
        INSERT INTO medical_staff (account_id, post, recruitment_date)
        VALUES (?, ?, ?)
    `, accountID, req.Post, req.RecruitmentDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"account_id": accountID, "message": "staff created"})
}

// PATCH /admin/accounts/{id}/block
// PATCH /admin/accounts/{id}/unblock
func (h *Handler) SetAccountBlock(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	// expects: admin/accounts/{id}/block or unblock
	if len(parts) < 4 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	accountID, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid account id", http.StatusBadRequest)
		return
	}
	action := parts[3]
	blocked := 0
	if action == "block" {
		blocked = 1
	}

	_, err = h.db.Exec(`UPDATE accounts SET is_blocked = ? WHERE id_account = ?`, blocked, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "ok"})
}

// PATCH /admin/doctors/{id} — update doctor info
func (h *Handler) UpdateDoctor(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	accountID, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req struct {
		Username     string `json:"username"`
		FirstName    string `json:"first_name"`
		LastName     string `json:"last_name"`
		Email        string `json:"email"`
		Phone        string `json:"phone_number"`
		Address      string `json:"address"`
		SpecialityID int64  `json:"speciality_id"`
		WorkingDays  string `json:"working_day_description"`
		NumAgrement  string `json:"num_agrement"`
		Availability string `json:"availability"`
		ServiceID    int64  `json:"service_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`
		UPDATE accounts SET username=?, first_name=?, last_name=?, email=?, phone_number=?, address=?
		WHERE id_account=?
	`, req.Username, req.FirstName, req.LastName, req.Email, req.Phone, req.Address, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = h.db.Exec(`
    	UPDATE doctors SET speciality_id=CASE WHEN ?=0 THEN speciality_id ELSE ? END,
    	working_day_description=?, num_agrement=?, availability=?,
    	service_id=CASE WHEN ?=0 THEN service_id ELSE ? END
    	WHERE account_id=?
	`, req.SpecialityID, req.SpecialityID, req.WorkingDays, req.NumAgrement, req.Availability, req.ServiceID, req.ServiceID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}

// PATCH /admin/staff/{id} — update staff info
func (h *Handler) UpdateStaff(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	accountID, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req struct {
		Username        string `json:"username"`
		FirstName       string `json:"first_name"`
		LastName        string `json:"last_name"`
		Email           string `json:"email"`
		Phone           string `json:"phone_number"`
		Post            string `json:"post"`
		RecruitmentDate string `json:"recruitment_date"`
		ServiceID       int64  `json:"service_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`
		UPDATE accounts SET username=?, first_name=?, last_name=?, email=?, phone_number=?
		WHERE id_account=?
	`, req.Username, req.FirstName, req.LastName, req.Email, req.Phone, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_, err = h.db.Exec(`
    	UPDATE medical_staff SET post=?, recruitment_date=?,
    	service_id=CASE WHEN ?=0 THEN service_id ELSE ? END
    	WHERE account_id=?
	`, req.Post, req.RecruitmentDate, req.ServiceID, req.ServiceID, accountID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "updated"})
}

// DELETE /admin/certificates/{id}
func (h *Handler) DeleteCertificate(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	_, err = h.db.Exec(`DELETE FROM certificates WHERE id_certificate = ?`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}

// GET /admin/services
func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`SELECT id_service, name_service FROM services ORDER BY id_service ASC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Service struct {
		ID   int64  `json:"id_service"`
		Name string `json:"name_service"`
	}
	result := []Service{}
	for rows.Next() {
		var s Service
		if err := rows.Scan(&s.ID, &s.Name); err != nil {
			continue
		}
		result = append(result, s)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// POST /admin/services
func (h *Handler) CreateService(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name_service"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	if req.Name == "" {
		http.Error(w, "name_service is required", http.StatusBadRequest)
		return
	}
	res, err := h.db.Exec(`INSERT INTO services (name_service) VALUES (?)`, req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"id_service": id, "message": "service created"})
}

// DELETE /admin/services/{id}
func (h *Handler) DeleteService(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	_, err = h.db.Exec(`DELETE FROM services WHERE id_service = ?`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}

// GET /admin/specialities
func (h *Handler) ListSpecialities(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.Query(`
		SELECT s.id_speciality, s.name, COALESCE(s.description,''), COUNT(d.id_doctor)
		FROM specialities s
		LEFT JOIN doctors d ON d.speciality_id = s.id_speciality
		GROUP BY s.id_speciality, s.name, s.description
		ORDER BY s.id_speciality ASC`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	type row struct {
		ID          int64  `json:"id"`
		Name        string `json:"name"`
		Desc        string `json:"desc"`
		DoctorCount int    `json:"doctor_count"`
	}
	list := []row{}
	for rows.Next() {
		var s row
		if err := rows.Scan(&s.ID, &s.Name, &s.Desc, &s.DoctorCount); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		list = append(list, s)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

// POST /admin/specialities
func (h *Handler) CreateSpeciality(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		Desc string `json:"desc"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	res, err := h.db.Exec(`INSERT INTO specialities (name, description) VALUES (?, ?)`, req.Name, req.Desc)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, _ := res.LastInsertId()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{"id": id, "name": req.Name, "desc": req.Desc, "doctor_count": 0})
}

// DELETE /admin/specialities/{id}
func (h *Handler) DeleteSpeciality(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 3 {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var count int
	h.db.QueryRow(`SELECT COUNT(*) FROM doctors WHERE speciality_id = ?`, id).Scan(&count)
	if count > 0 {
		http.Error(w, "cannot delete speciality with assigned doctors", http.StatusConflict)
		return
	}
	_, err = h.db.Exec(`DELETE FROM specialities WHERE id_speciality = ?`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "deleted"})
}
