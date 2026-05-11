package app

import (
	reservations "clinic/internal/Reservations"
	"clinic/internal/auth"
	"clinic/internal/doctor"
	"clinic/internal/patient"
	"clinic/internal/queue"
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
		{Method: "POST", Path: "/auth/change-password"},
		{Method: "GET", Path: "/auth/ping"},
		{Method: "GET|PATCH", Path: "/patients/me"},
		{Method: "GET|PATCH", Path: "/doctors/me"},
		{Method: "GET|POST|PATCH", Path: "/queues"},
		{Method: "GET|POST|PATCH", Path: "/reservations"},
		{Method: "GET", Path: "/admin"},
		{Method: "GET", Path: "/"},
	}
}

func NewRouter(db *sql.DB) *http.ServeMux {
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo)
	sessionStore := auth.NewSessionStore()
	authHandler := auth.NewHandler(authService, sessionStore)

	userRepo := user.NewRepository(db, authRepo)

	patientRepo := patient.NewRepository(db, userRepo)
	patientService := patient.NewService(patientRepo)
	patientHandler := patient.NewHandler(patientService)

	doctorRepo := doctor.NewRepository(db, userRepo)
	doctorService := doctor.NewService(doctorRepo)
	doctorHandler := doctor.NewHandler(doctorService)

	queueRepo := queue.NewRepository(db)
	queueService := queue.NewService(queueRepo)
	queueHandler := queue.NewHandler(queueService)

	reservationsRepo := reservations.NewRepository(db)
	reservationsService := reservations.NewService(reservationsRepo)
	reservationsHandler := reservations.NewHandler(reservationsService)

	router := http.NewServeMux()
	router.HandleFunc("/auth/register", authHandler.Register)
	router.HandleFunc("/auth/login", authHandler.Login)
	router.HandleFunc("/auth/me", auth.AuthMiddleware(sessionStore, authHandler.Me))
	router.HandleFunc("/auth/logout", authHandler.Logout)
	router.HandleFunc("/auth/change-password", auth.AuthMiddleware(sessionStore, authHandler.ChangePassword))
	router.HandleFunc("/auth/ping", authHandler.Ping)

	router.HandleFunc("/patients/me", auth.AuthMiddleware(sessionStore, patientHandler.Profile))
	router.HandleFunc("/doctors/me", auth.AuthMiddleware(sessionStore, doctorHandler.Profile))
	router.HandleFunc("/queues", auth.AuthMiddleware(sessionStore, queueHandler.Queues))
	router.HandleFunc("/reservations", auth.AuthMiddleware(sessionStore, reservationsHandler.Reservations))

	adminHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("admin area"))
	}
	router.HandleFunc("/admin", auth.AuthMiddleware(sessionStore, auth.RequireRoles([]string{"admin"}, adminHandler)))
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
