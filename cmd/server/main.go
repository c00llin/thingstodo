package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/database"
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

	cfg := config.Load()

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

	// Start scheduler for repeating tasks
	taskRepo := repository.NewTaskRepository(db)
	ruleRepo := repository.NewRepeatRuleRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	attachRepo := repository.NewAttachmentRepository(db)
	sched := scheduler.New(db, taskRepo, ruleRepo, checklistRepo, attachRepo)
	sched.Start()
	defer sched.Stop()

	handler := router.New(db, cfg, broker, sched)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("starting server on %s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
