package middleware

import (
	"context"
	"net/http"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "userID"

func Auth(cfg config.Config) func(http.Handler) http.Handler {
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
				if userHeader != "" {
					ctx := context.WithValue(r.Context(), UserIDKey, userHeader)
					next.ServeHTTP(w, r.WithContext(ctx))
				} else {
					next.ServeHTTP(w, r)
				}

			default: // "builtin"
				cookie, err := r.Cookie("token")
				if err != nil {
					http.Error(w, `{"error":"unauthorized","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}

				token, err := jwt.Parse(cookie.Value, func(t *jwt.Token) (interface{}, error) {
					return []byte(cfg.JWTSecret), nil
				})
				if err != nil || !token.Valid {
					http.Error(w, `{"error":"invalid token","code":"UNAUTHORIZED"}`, http.StatusUnauthorized)
					return
				}

				claims, ok := token.Claims.(jwt.MapClaims)
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
