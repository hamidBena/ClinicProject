package auth

import (
	"net/http"
)

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

		for _, a := range allowed {
			if session.Role == a {
				next(w, r)
				return
			}
		}

		http.Error(w, "forbidden", http.StatusForbidden)
	}
}
