package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

type sessionContextKey struct{}

type Session struct {
	AccountID int64
	Email     string
	Role      string
}

type SessionStore struct {
	sessions map[string]sessionEntry
	mu       sync.RWMutex
	ttl      time.Duration
	stopCh   chan struct{}
}

func NewSessionStore() *SessionStore {
	s := &SessionStore{
		sessions: make(map[string]sessionEntry),
		ttl:      24 * time.Hour,
		stopCh:   make(chan struct{}),
	}
	go s.cleanupLoop()
	return s
}

func (s *SessionStore) Create(accountID int64, email, role string) string {
	token := randomToken()
	now := time.Now().UTC()

	s.mu.Lock()
	s.sessions[token] = sessionEntry{
		session:   Session{AccountID: accountID, Email: email, Role: role},
		expiresAt: now.Add(s.ttl),
	}
	s.mu.Unlock()

	return token
}

func (s *SessionStore) Get(token string) (Session, bool) {
	s.mu.RLock()
	entry, ok := s.sessions[token]
	s.mu.RUnlock()
	if !ok {
		return Session{}, false
	}
	if time.Now().UTC().After(entry.expiresAt) {
		// expired
		s.mu.Lock()
		delete(s.sessions, token)
		s.mu.Unlock()
		return Session{}, false
	}
	return entry.session, true
}

func (s *SessionStore) Delete(token string) {
	s.mu.Lock()
	delete(s.sessions, token)
	s.mu.Unlock()
}

type sessionEntry struct {
	session   Session
	expiresAt time.Time
}

func (s *SessionStore) cleanupLoop() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			now := time.Now().UTC()
			s.mu.Lock()
			for k, v := range s.sessions {
				if now.After(v.expiresAt) {
					delete(s.sessions, k)
				}
			}
			s.mu.Unlock()
		case <-s.stopCh:
			return
		}
	}
}

func (s *SessionStore) Stop() {
	close(s.stopCh)
}

func AuthMiddleware(sessionStore *SessionStore, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil || cookie.Value == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		session, ok := sessionStore.Get(cookie.Value)
		if !ok {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), sessionContextKey{}, session)
		next(w, r.WithContext(ctx))
	}
}

func SessionFromContext(ctx context.Context) (Session, bool) {
	session, ok := ctx.Value(sessionContextKey{}).(Session)
	return session, ok
}

func randomToken() string {
	bytes := make([]byte, 32)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
