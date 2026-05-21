package auth

import (
	"net/http"
	"strings"
)

type Role string

const (
	RoleAdmin   Role = "admin"
	RoleDoctor  Role = "doctor"
	RolePatient Role = "patient"
)

func normalizeRole(r string) string {
	return strings.ToLower(strings.TrimSpace(r))
}

func HasRole(sessionRole string, allowed []string) bool {
	if sessionRole == "" {
		return false
	}
	sr := normalizeRole(sessionRole)
	for _, a := range allowed {
		if sr == normalizeRole(a) {
			return true
		}
	}
	return false
}

// RequireRoles wraps a handler and allows only requests where the session's
// Role matches one of the allowed roles. It expects the request to already
// have been authenticated and the session placed into the context by
// AuthMiddleware.
func RequireRoles(allowed []string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, ok := SessionFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		if HasRole(session.Role, allowed) {
			next(w, r)
			return
		}

		http.Error(w, "forbidden", http.StatusForbidden)
	}
}
