package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/database"
	"github.com/collinjanssen/thingstodo/internal/push"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/router"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"golang.org/x/crypto/bcrypt"
)

// Set via -ldflags at build time.
var (
	Version = "dev"
	Commit  = "unknown"
)

func main() {
	// Healthcheck mode for Docker scratch containers.
	if len(os.Args) > 1 && os.Args[1] == "-healthcheck" {
		cfg := config.Load()
		resp, err := http.Get(fmt.Sprintf("http://localhost:%d/health", cfg.Port))
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}

	// Generate VAPID key pair and exit.
	if len(os.Args) > 1 && os.Args[1] == "-generate-vapid" {
		priv, pub, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			log.Fatalf("failed to generate VAPID keys: %v", err)
		}
		fmt.Printf("VAPID_PRIVATE_KEY=%s\n", priv)
		fmt.Printf("VAPID_PUBLIC_KEY=%s\n", pub)
		os.Exit(0)
	}

	cfg := config.Load()

	// Validate VAPID keys at startup if configured.
	if cfg.VAPIDPublicKey != "" {
		// Normalize: accept both standard base64 and base64url
		normalized := cfg.VAPIDPublicKey
		normalized = strings.TrimRight(normalized, "=")
		normalized = strings.ReplaceAll(normalized, "+", "-")
		normalized = strings.ReplaceAll(normalized, "/", "_")
		raw, err := base64.RawURLEncoding.DecodeString(normalized)
		if err != nil {
			log.Printf("WARNING: VAPID_PUBLIC_KEY is not valid base64url: %v", err)
		} else if len(raw) != 65 {
			log.Printf("WARNING: VAPID_PUBLIC_KEY decoded to %d bytes (expected 65 for uncompressed P-256)", len(raw))
		} else {
			log.Printf("VAPID public key OK (%d bytes, %d base64url chars)", len(raw), len(normalized))
		}
	}

	log.Printf("ThingsToDo v%s (commit %s)", Version, Commit)

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	broker := sse.NewBroker()

	// Seed default user from LOGIN_PASSWORD if set and no users exist yet
	if cfg.LoginPassword != "" && cfg.AuthMode == "builtin" {
		userRepo := repository.NewUserRepository(db)
		existing, _ := userRepo.GetByUsername("admin")
		if existing == nil {
			hash, err := bcrypt.GenerateFromPassword([]byte(cfg.LoginPassword), bcrypt.DefaultCost)
			if err != nil {
				log.Fatalf("failed to hash login password: %v", err)
			}
			if _, err := userRepo.Create("admin", string(hash)); err != nil {
				log.Fatalf("failed to create default user: %v", err)
			}
			log.Println("created default admin user from LOGIN_PASSWORD")
		}
	}

	// Start scheduler for repeating tasks + reminders
	taskRepo := repository.NewTaskRepository(db)
	ruleRepo := repository.NewRepeatRuleRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	attachRepo := repository.NewAttachmentRepository(db)
	scheduleRepo := repository.NewScheduleRepository(db)
	reminderRepo := repository.NewReminderRepository(db)
	settingsRepo := repository.NewUserSettingsRepository(db)
	userRepo := repository.NewUserRepository(db)
	pushSubRepo := repository.NewPushSubscriptionRepository(db)
	pushSender := push.NewSender(pushSubRepo, cfg.VAPIDPrivateKey, cfg.VAPIDPublicKey, cfg.VAPIDContact)
	sched := scheduler.New(db, taskRepo, ruleRepo, checklistRepo, attachRepo, scheduleRepo, reminderRepo, settingsRepo, userRepo, pushSender, broker)
	sched.Start()
	defer sched.Stop()

	handler := router.New(db, cfg, broker, sched)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("starting server on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
