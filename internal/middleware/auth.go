package middleware

import (
	"context"
	"crypto/subtle"
	"net/http"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "userID"

// UserLookupFunc returns the user ID for the API key holder.
type UserLookupFunc func() (string, error)

func Auth(cfg config.Config, apiKeyUserLookup UserLookupFunc) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch cfg.AuthMode {
			case "none":
				// No authentication — for development use only
				ctx := context.WithValue(r.Context(), UserIDKey, "dev-user")
				next.ServeHTTP(w, r.WithContext(ctx))
				return

			case "proxy":
				// Trust proxy header
				userHeader := r.Header.Get(cfg.AuthProxyHeader)
				if userHeader == "" {
					http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}
				ctx := context.WithValue(r.Context(), UserIDKey, userHeader)
				next.ServeHTTP(w, r.WithContext(ctx))

			default: // "builtin"
				// Check for API key in Authorization header first
				if cfg.APIKey != "" {
					if authHeader := r.Header.Get("Authorization"); authHeader != "" {
						if token, ok := strings.CutPrefix(authHeader, "Bearer "); ok {
							if subtle.ConstantTimeCompare([]byte(token), []byte(cfg.APIKey)) == 1 {
								userID, err := apiKeyUserLookup()
								if err != nil || userID == "" {
									http.Error(w, `{"error":"api key user not found","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
									return
								}
								ctx := context.WithValue(r.Context(), UserIDKey, userID)
								next.ServeHTTP(w, r.WithContext(ctx))
								return
							}
							// Header present but key doesn't match — reject immediately
							http.Error(w, `{"error":"invalid api key","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
							return
						}
					}
				}

				// Fall through to JWT cookie auth
				cookie, err := r.Cookie("token")
				if err != nil {
					http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}

				jwtToken, err := jwt.Parse(cookie.Value, func(t *jwt.Token) (interface{}, error) {
					return []byte(cfg.JWTSecret), nil
				})
				if err != nil || !jwtToken.Valid {
					http.Error(w, `{"error":"invalid token","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}

				claims, ok := jwtToken.Claims.(jwt.MapClaims)
				if !ok {
					http.Error(w, `{"error":"invalid claims","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}

				sub, _ := claims["sub"].(string)
				ctx := context.WithValue(r.Context(), UserIDKey, sub)
				next.ServeHTTP(w, r.WithContext(ctx))
			}
		})
	}
}
