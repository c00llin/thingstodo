package handler

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"time"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

type OIDCHandler struct {
	repo         *repository.UserRepository
	cfg          config.Config
	provider     *oidc.Provider
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier
}

func NewOIDCHandler(ctx context.Context, repo *repository.UserRepository, cfg config.Config) (*OIDCHandler, error) {
	provider, err := oidc.NewProvider(ctx, cfg.OIDCIssuer)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery for %s: %w", cfg.OIDCIssuer, err)
	}

	oauth2Cfg := oauth2.Config{
		ClientID:     cfg.OIDCClientID,
		ClientSecret: cfg.OIDCClientSecret,
		RedirectURL:  cfg.OIDCRedirectURI,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}

	verifier := provider.Verifier(&oidc.Config{ClientID: cfg.OIDCClientID})

	return &OIDCHandler{
		repo:         repo,
		cfg:          cfg,
		provider:     provider,
		oauth2Config: oauth2Cfg,
		verifier:     verifier,
	}, nil
}

// Login redirects the browser to the OIDC provider's authorization endpoint.
func (h *OIDCHandler) Login(w http.ResponseWriter, r *http.Request) {
	state, err := generateState()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate state", "INTERNAL")
		return
	}

	signed, err := signState(state, h.cfg.JWTSecret)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to sign state", "INTERNAL")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oidc_state",
		Value:    signed,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})

	http.Redirect(w, r, h.oauth2Config.AuthCodeURL(state), http.StatusFound)
}

// Callback handles the redirect back from the OIDC provider.
// It verifies the state, exchanges the code, extracts the email claim,
// provisions or links the user, and issues an app JWT cookie.
func (h *OIDCHandler) Callback(w http.ResponseWriter, r *http.Request) {
	// Verify state
	stateCookie, err := r.Cookie("oidc_state")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing state cookie", "BAD_REQUEST")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: "oidc_state", Value: "", Path: "/", HttpOnly: true, MaxAge: -1,
	})

	if !verifyState(r.URL.Query().Get("state"), stateCookie.Value, h.cfg.JWTSecret) {
		writeError(w, http.StatusBadRequest, "invalid state", "BAD_REQUEST")
		return
	}

	// Exchange code for tokens
	code := r.URL.Query().Get("code")
	if code == "" {
		writeError(w, http.StatusBadRequest, "missing code", "BAD_REQUEST")
		return
	}

	token, err := h.oauth2Config.Exchange(r.Context(), code)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "token exchange failed", "UNAUTHORIZED")
		return
	}

	// Extract and verify ID token
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok {
		writeError(w, http.StatusUnauthorized, "no id_token in response", "UNAUTHORIZED")
		return
	}

	idToken, err := h.verifier.Verify(r.Context(), rawIDToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "id_token verification failed", "UNAUTHORIZED")
		return
	}

	// Extract email: try ID token claims first, then userinfo endpoint as fallback
	var claims struct {
		Email string `json:"email"`
	}
	_ = idToken.Claims(&claims)

	if claims.Email == "" {
		userInfo, err := h.provider.UserInfo(r.Context(), oauth2.StaticTokenSource(token))
		if err == nil {
			_ = userInfo.Claims(&claims)
		}
	}

	if claims.Email == "" {
		writeError(w, http.StatusUnauthorized, "missing email claim", "UNAUTHORIZED")
		return
	}

	// Resolve user: look up by email, or claim the existing single user on first OIDC login.
	// Single-user enforcement: only the first/linked user can authenticate.
	user, err := h.repo.GetByUsername(claims.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "user lookup failed", "INTERNAL")
		return
	}

	if user == nil {
		existing, err := h.repo.GetFirst()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "user lookup failed", "INTERNAL")
			return
		}

		switch {
		case existing != nil && existing.Username != claims.Email:
			// First OIDC login — link existing user to this OIDC identity
			if err := h.repo.UpdateUsername(existing.ID, claims.Email); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to link user", "INTERNAL")
				return
			}
			user = existing
			user.Username = claims.Email
		case existing == nil:
			// No users at all — create one
			user, err = h.repo.Create(claims.Email, "")
			if err != nil {
				writeError(w, http.StatusInternalServerError, "user provisioning failed", "INTERNAL")
				return
			}
		default:
			// existing.Username == claims.Email — already linked
			user = existing
		}
	}

	// Issue app JWT cookie
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": user.ID,
		"exp": time.Now().Add(7 * 24 * time.Hour).Unix(),
	})
	tokenStr, err := jwtToken.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create token", "INTERNAL")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenStr,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 60 * 60,
	})

	http.Redirect(w, r, "/inbox", http.StatusFound)
}

func generateState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func signState(state, secret string) (string, error) {
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"state": state,
		"exp":   time.Now().Add(10 * time.Minute).Unix(),
	})
	return t.SignedString([]byte(secret))
}

func verifyState(queryState, cookieValue, secret string) bool {
	t, err := jwt.Parse(cookieValue, func(tok *jwt.Token) (interface{}, error) {
		if _, ok := tok.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", tok.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil || !t.Valid {
		return false
	}
	claims, ok := t.Claims.(jwt.MapClaims)
	if !ok {
		return false
	}
	s, _ := claims["state"].(string)
	return s == queryState
}
