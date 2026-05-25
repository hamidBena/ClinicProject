package app

import (
	reservations "clinic/internal/Reservations"
	"clinic/internal/admin"
	"clinic/internal/auth"
	"clinic/internal/doctor"
	"clinic/internal/notifications"
	"clinic/internal/patient"
	"clinic/internal/queue"
	"clinic/internal/specialities"
	"clinic/internal/staff"
	"clinic/internal/user"
	"database/sql"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

type Endpoint struct {
	Method string
	Path   string
}

func Endpoints() []Endpoint {
	return []Endpoint{
		{Method: "POST", Path: "/auth/register"},
		{Method: "POST", Path: "/auth/login"},
		{Method: "GET", Path: "/auth/me"},
		{Method: "POST", Path: "/auth/logout"},
		{Method: "POST", Path: "/auth/forgot-password"},
		{Method: "POST", Path: "/auth/change-password"},

		{Method: "GET|PATCH", Path: "/patients/me"},
		{Method: "GET|PATCH", Path: "/doctors/me"},

		{Method: "GET|POST|PATCH", Path: "/queues"},
		{Method: "GET|POST|PATCH", Path: "/reservations"},
		{Method: "GET", Path: "/admin"},
		{Method: "GET", Path: "/"},

		{Method: "GET", Path: "/specialities"},
		{Method: "GET", Path: "/specialities/{id}"},

		{Method: "GET|POST", Path: "/notifications"},
		{Method: "GET|POST", Path: "/profile/avatar"},
		{Method: "GET|POST", Path: "/patients/medical-file"},
		{Method: "GET|POST", Path: "/doctors/certificate"},
	}
}

func NewRouter(db *sql.DB) *http.ServeMux {
	authRepo := auth.NewRepository(db)
	notificationsRepo := notifications.NewRepository(db)
	notificationsService := notifications.NewService(notificationsRepo)
	notificationsManager := notifications.NewManager(notificationsService)

	authService := auth.NewService(authRepo, notificationsManager)
	sessionStore := auth.NewSessionStore()
	authHandler := auth.NewHandler(authService, sessionStore)

	userRepo := user.NewRepository(db, authRepo)
	userService := user.NewService(userRepo, notificationsManager)
	userHandler := user.NewHandler(userService)

	patientRepo := patient.NewRepository(db, userRepo)
	patientService := patient.NewService(patientRepo, notificationsManager)
	patientHandler := patient.NewHandler(patientService)

	doctorRepo := doctor.NewRepository(db, userRepo)
	doctorService := doctor.NewService(doctorRepo, notificationsManager)
	doctorHandler := doctor.NewHandler(doctorService)

	staffRepo := staff.NewRepository(db, userRepo)
	staffService := staff.NewService(staffRepo)
	staffHandler := staff.NewHandler(staffService)

	adminH := admin.NewHandler(db)

	specialitiesRepo := specialities.NewRepository(db)
	specialitiesService := specialities.NewService(specialitiesRepo)
	specialitiesHandler := specialities.NewHandler(specialitiesService)

	queueRepo := queue.NewRepository(db)
	queueService := queue.NewService(queueRepo, specialitiesService)
	queueHandler := queue.NewHandler(queueService)

	reservationsRepo := reservations.NewRepository(db)
	reservationsService := reservations.NewService(reservationsRepo, notificationsManager)
	reservationsHandler := reservations.NewHandler(reservationsService)
	notificationsHandler := notifications.NewHandler(notificationsService)

	// Serve uploaded files from the uploads directory (development only).
	uploadsDir := filepath.Join("uploads")
	_ = os.MkdirAll(uploadsDir, 0755)

	router := http.NewServeMux()
	router.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))
	router.HandleFunc("/auth/register", authHandler.Register)
	router.HandleFunc("/auth/login", authHandler.Login)
	router.HandleFunc("/auth/me", auth.AuthMiddleware(sessionStore, authHandler.Me))
	router.HandleFunc("/auth/logout", authHandler.Logout)
	router.HandleFunc("/auth/forgot-password", authHandler.ForgotPassword)
	router.HandleFunc("/auth/change-password", auth.AuthMiddleware(sessionStore, authHandler.ChangePassword))
	router.HandleFunc("/patients/me", auth.AuthMiddleware(sessionStore, patientHandler.Profile))
	router.HandleFunc("/patients/medical-file", auth.AuthMiddleware(sessionStore, patientHandler.UploadMedicalFile))
	router.HandleFunc("/doctors/me", auth.AuthMiddleware(sessionStore, doctorHandler.Profile))
	router.HandleFunc("/doctors", doctorHandler.ListBySpeciality)
	router.HandleFunc("/doctors/availability", auth.AuthMiddleware(sessionStore, doctorHandler.SetAvailability))
	router.HandleFunc("/staff/me", auth.AuthMiddleware(sessionStore, staffHandler.Profile))
	router.HandleFunc("/queues", queueHandler.Queues)
	router.HandleFunc("/profile/avatar", auth.AuthMiddleware(sessionStore, userHandler.UploadAvatar))
	router.HandleFunc("/doctors/certificate", auth.AuthMiddleware(sessionStore, doctorHandler.UploadCertificate))
	router.HandleFunc("/reservations", auth.AuthMiddleware(sessionStore, reservationsHandler.Reservations))
	router.HandleFunc("/reservations/queue/", reservationsHandler.ListByQueueID)
	router.Handle("/reservations/staff", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin", "doctor", "staff"}, http.HandlerFunc(reservationsHandler.CreateForPatient))))
	router.Handle("/reservations/staff/update", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin", "doctor", "staff"}, http.HandlerFunc(reservationsHandler.UpdateForStaff))))
	router.HandleFunc("/notifications", auth.AuthMiddleware(sessionStore, notificationsHandler.Notifications))
	router.HandleFunc("/specialities", specialitiesHandler.ListAll)
	router.HandleFunc("/specialities/", specialitiesHandler.GetByID)

	adminHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("admin area"))
	}
	// Serve Admin.html only to admin users
	adminHTMLHandler := func(w http.ResponseWriter, r *http.Request) {
		frontDir := resolveFrontDir()
		file, err := frontDir.Open("Admin.html")
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, r)
				return
			}
			http.Error(w, "unable to open file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		info, err := file.Stat()
		if err != nil {
			http.Error(w, "unable to read file", http.StatusInternalServerError)
			return
		}

		http.ServeContent(w, r, info.Name(), info.ModTime(), file.(io.ReadSeeker))
	}

	router.HandleFunc("/Admin.html", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, adminHTMLHandler)))
	router.HandleFunc("/admin", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, adminHandler)))
	router.HandleFunc("/admin/me", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(adminH.Me))))
	router.HandleFunc("/admin/doctors/availability", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPatch:
			adminH.SetDoctorAvailability(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/doctors", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		switch r.Method {
		case http.MethodGet:
			adminH.ListDoctors(w, r)
		case http.MethodPost:
			adminH.CreateDoctor(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/doctors/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, "/certificates") && r.Method == http.MethodGet:
			adminH.ListDoctorCertificates(w, r)
		case r.Method == http.MethodPatch:
			adminH.UpdateDoctor(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/staff", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.ListStaff(w, r)
		case http.MethodPost:
			adminH.CreateStaff(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/staff/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPatch:
			adminH.UpdateStaff(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/patients", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.ListPatients(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/accounts/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPatch:
			adminH.SetAccountBlock(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/certificates", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			adminH.CreateCertificate(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/certificates/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodDelete:
			adminH.DeleteCertificate(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/services", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.ListServices(w, r)
		case http.MethodPost:
			adminH.CreateService(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))

	router.HandleFunc("/admin/services/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodDelete:
			adminH.DeleteService(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	router.HandleFunc("/admin/specialities", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			adminH.ListSpecialities(w, r)
		case http.MethodPost:
			adminH.CreateSpeciality(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	router.HandleFunc("/admin/specialities/", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodDelete:
			adminH.DeleteSpeciality(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))))
	// Serve MedicalStaff.html only to doctors and admins
	medicalStaffHTMLHandler := func(w http.ResponseWriter, r *http.Request) {
		frontDir := resolveFrontDir()
		file, err := frontDir.Open("MedicalStaff.html")
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, r)
				return
			}
			http.Error(w, "unable to open file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		info, err := file.Stat()
		if err != nil {
			http.Error(w, "unable to read file", http.StatusInternalServerError)
			return
		}

		http.ServeContent(w, r, info.Name(), info.ModTime(), file.(io.ReadSeeker))
	}

	router.HandleFunc("/MedicalStaff.html", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin", "doctor", "staff"}, medicalStaffHTMLHandler)))
	router.HandleFunc("/", staticFrontHandler())

	return router
}

func staticFrontHandler() http.HandlerFunc {
	frontDir := resolveFrontDir()

	return func(w http.ResponseWriter, r *http.Request) {
		requestPath := r.URL.Path
		if requestPath == "/" {
			requestPath = "/Welcome.html"
		}

		cleanPath := path.Clean(strings.TrimPrefix(requestPath, "/"))
		if strings.HasPrefix(cleanPath, "..") {
			http.NotFound(w, r)
			return
		}

		file, err := frontDir.Open(cleanPath)
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				http.NotFound(w, r)
				return
			}
			http.Error(w, "unable to open file", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		info, err := file.Stat()
		if err != nil {
			http.Error(w, "unable to read file", http.StatusInternalServerError)
			return
		}

		if info.IsDir() {
			http.NotFound(w, r)
			return
		}

		http.ServeContent(w, r, info.Name(), info.ModTime(), file.(io.ReadSeeker))
	}
}

func resolveFrontDir() http.Dir {
	candidates := []string{"front", filepath.Join("..", "front"), filepath.Join("..", "..", "front")}
	for _, candidate := range candidates {
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			return http.Dir(candidate)
		}
	}
	return http.Dir("front")
}
