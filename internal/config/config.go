package config

import (
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type Config struct {
	Port            int
	DBPath          string
	AuthMode        string
	LogLevel        string
	AttachmentsPath string
	MaxUploadSize   int64
	AuthProxyHeader string
	JWTSecret       string
	LoginPassword   string
	APIKey          string

	// OIDC (AUTH_MODE=oidc)
	OIDCIssuer       string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURI  string

	// VAPID (Web Push)
	VAPIDPrivateKey string
	VAPIDPublicKey  string
	VAPIDContact    string

	// Timezone for date/time calculations (IANA name, e.g. "America/Chicago")
	Location *time.Location
}

func Load() Config {
	dbPath := envStr("DB_PATH", "./data/thingstodo.db")
	dataDir := filepath.Dir(dbPath)
	cfg := Config{
		Port:            envInt("PORT", 2999),
		DBPath:          dbPath,
		AuthMode:        envStr("AUTH_MODE", "builtin"),
		LogLevel:        envStr("LOG_LEVEL", "info"),
		AttachmentsPath: filepath.Join(dataDir, "attachments"),
		MaxUploadSize:   envInt64("MAX_UPLOAD_SIZE", 25*1024*1024),
		AuthProxyHeader: envStr("AUTH_PROXY_HEADER", "Remote-User"),
		JWTSecret:       envStr("JWT_SECRET", ""),
		LoginPassword:   envStr("LOGIN_PASSWORD", ""),
		APIKey:          envStr("API_KEY", ""),

		OIDCIssuer:       envStr("OIDC_ISSUER", ""),
		OIDCClientID:     envStr("OIDC_CLIENT_ID", ""),
		OIDCClientSecret: envStr("OIDC_CLIENT_SECRET", ""),
		OIDCRedirectURI:  envStr("OIDC_REDIRECT_URI", ""),

		VAPIDPrivateKey: envStr("VAPID_PRIVATE_KEY", ""),
		VAPIDPublicKey:  envStr("VAPID_PUBLIC_KEY", ""),
		VAPIDContact:    envStr("VAPID_CONTACT", ""),
	}

	if (cfg.AuthMode == "builtin" || cfg.AuthMode == "oidc") && cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set when AUTH_MODE is builtin or oidc")
	}

	// Load timezone — defaults to system TZ (UTC in most Docker containers)
	if tz := envStr("TZ", ""); tz != "" {
		loc, err := time.LoadLocation(tz)
		if err != nil {
			log.Fatalf("invalid TZ %q: %v", tz, err)
		}
		cfg.Location = loc
	} else {
		cfg.Location = time.Local
	}

	return cfg
}

func envStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envInt64(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
