package router

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"log"
	"mime"
	"net/http"
	"strings"
	"time"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/frontend"
	"github.com/collinjanssen/thingstodo/internal/handler"
	mw "github.com/collinjanssen/thingstodo/internal/middleware"
	"github.com/collinjanssen/thingstodo/internal/recurrence"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

func New(db *sql.DB, cfg config.Config, broker *sse.Broker, sched *scheduler.Scheduler) http.Handler {
	_ = mime.AddExtensionType(".webmanifest", "application/manifest+json")

	r := chi.NewRouter()
	r.Use(mw.Logger)

	// Repositories
	taskRepo := repository.NewTaskRepository(db)
	projectRepo := repository.NewProjectRepository(db)
	areaRepo := repository.NewAreaRepository(db)
	tagRepo := repository.NewTagRepository(db)
	headingRepo := repository.NewHeadingRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	attachmentRepo := repository.NewAttachmentRepository(db)
	repeatRuleRepo := repository.NewRepeatRuleRepository(db)
	searchRepo := repository.NewSearchRepository(db)
	viewRepo := repository.NewViewRepository(db)
	userRepo := repository.NewUserRepository(db)
	settingsRepo := repository.NewUserSettingsRepository(db)
	savedFilterRepo := repository.NewSavedFilterRepository(db)
	scheduleRepo := repository.NewScheduleRepository(db)

	// Handlers
	taskH := handler.NewTaskHandler(taskRepo, broker, sched)
	projectH := handler.NewProjectHandler(projectRepo, broker)
	areaH := handler.NewAreaHandler(areaRepo, broker)
	tagH := handler.NewTagHandler(tagRepo, broker)
	headingH := handler.NewHeadingHandler(headingRepo, broker)
	checklistH := handler.NewChecklistHandler(checklistRepo, broker)
	attachmentH := handler.NewAttachmentHandler(attachmentRepo, broker, cfg.AttachmentsPath, cfg.MaxUploadSize)
	repeatRuleH := handler.NewRepeatRuleHandler(repeatRuleRepo, taskRepo, recurrence.NewEngine(), broker)
	searchH := handler.NewSearchHandler(searchRepo)
	viewH := handler.NewViewHandler(viewRepo, settingsRepo)
	authH := handler.NewAuthHandler(userRepo, cfg)
	settingsH := handler.NewUserSettingsHandler(settingsRepo)
	savedFilterH := handler.NewSavedFilterHandler(savedFilterRepo, broker)
	scheduleH := handler.NewScheduleHandler(scheduleRepo, broker)
	eventH := handler.NewEventHandler(broker)

	var oidcH *handler.OIDCHandler
	if cfg.AuthMode == "oidc" {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		var err error
		oidcH, err = handler.NewOIDCHandler(ctx, userRepo, cfg)
		if err != nil {
			log.Fatalf("OIDC initialization failed: %v", err)
		}
	}

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// API routes
	r.Route("/api", func(r chi.Router) {
		// Auth endpoints (no middleware)
		r.Post("/auth/login", authH.Login)
		r.Delete("/auth/logout", authH.Logout)
		r.Get("/auth/config", authH.AuthConfig)
		if oidcH != nil {
			r.Get("/auth/oidc/login", oidcH.Login)
			r.Get("/auth/oidc/callback", oidcH.Callback)
		}

		// SSE events (before auth middleware so it can connect)
		r.Get("/events", eventH.Stream)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(mw.Auth(cfg, func() (string, error) {
				u, err := userRepo.GetFirst()
				if err != nil {
					return "", err
				}
				if u == nil {
					return "", nil
				}
				return u.ID, nil
			}))

			// Auth
			r.Get("/auth/me", authH.Me)

			// Tasks
			r.Get("/tasks", taskH.List)
			r.Post("/tasks", taskH.Create)
			r.Get("/tasks/{id}", taskH.Get)
			r.Patch("/tasks/{id}", taskH.Update)
			r.Delete("/tasks/{id}", taskH.Delete)
			r.Delete("/tasks/{id}/purge", taskH.Purge)
			r.Patch("/tasks/{id}/complete", taskH.Complete)
			r.Patch("/tasks/{id}/cancel", taskH.Cancel)
			r.Patch("/tasks/{id}/wontdo", taskH.WontDo)
			r.Patch("/tasks/{id}/reopen", taskH.Reopen)
			r.Patch("/tasks/{id}/restore", taskH.Restore)
			r.Patch("/tasks/{id}/review", taskH.Review)
			r.Patch("/tasks/{id}/move", taskH.Move)
			r.Patch("/tasks/reorder", taskH.Reorder)

			// Checklist
			r.Get("/tasks/{id}/checklist", checklistH.List)
			r.Post("/tasks/{id}/checklist", checklistH.Create)
			r.Patch("/checklist/{id}", checklistH.Update)
			r.Delete("/checklist/{id}", checklistH.Delete)

			// Attachments
			r.Get("/tasks/{id}/attachments", attachmentH.List)
			r.Post("/tasks/{id}/attachments", attachmentH.Create)
			r.Patch("/attachments/{id}", attachmentH.Update)
			r.Delete("/attachments/{id}", attachmentH.Delete)
			r.Get("/attachments/{id}/file", attachmentH.Download)

			// Repeat rules
			r.Get("/tasks/{id}/repeat", repeatRuleH.Get)
			r.Put("/tasks/{id}/repeat", repeatRuleH.Upsert)
			r.Delete("/tasks/{id}/repeat", repeatRuleH.Delete)

			// Schedules
			r.Get("/tasks/{id}/schedules", scheduleH.List)
			r.Post("/tasks/{id}/schedules", scheduleH.Create)
			r.Patch("/tasks/{id}/schedules/reorder", scheduleH.Reorder)
			r.Patch("/schedules/{id}", scheduleH.Update)
			r.Delete("/schedules/{id}", scheduleH.Delete)

			// Projects
			r.Get("/projects", projectH.List)
			r.Post("/projects", projectH.Create)
			r.Get("/projects/{id}", projectH.Get)
			r.Patch("/projects/{id}", projectH.Update)
			r.Delete("/projects/{id}", projectH.Delete)
			r.Patch("/projects/{id}/complete", projectH.Complete)
			r.Patch("/projects/reorder", projectH.Reorder)

			// Headings
			r.Get("/projects/{id}/headings", headingH.List)
			r.Post("/projects/{id}/headings", headingH.Create)
			r.Patch("/headings/{id}", headingH.Update)
			r.Delete("/headings/{id}", headingH.Delete)
			r.Patch("/headings/reorder", headingH.Reorder)

			// Areas
			r.Get("/areas", areaH.List)
			r.Post("/areas", areaH.Create)
			r.Get("/areas/{id}", areaH.Get)
			r.Patch("/areas/{id}", areaH.Update)
			r.Delete("/areas/{id}", areaH.Delete)
			r.Patch("/areas/reorder", areaH.Reorder)

			// Tags
			r.Get("/tags", tagH.List)
			r.Post("/tags", tagH.Create)
			r.Patch("/tags/{id}", tagH.Update)
			r.Delete("/tags/{id}", tagH.Delete)
			r.Get("/tags/{id}/tasks", tagH.GetTasks)
			r.Patch("/tags/reorder", tagH.Reorder)

			// Views
			r.Get("/views/inbox", viewH.Inbox)
			r.Get("/views/today", viewH.Today)
			r.Get("/views/upcoming", viewH.Upcoming)
			r.Get("/views/anytime", viewH.Anytime)
			r.Get("/views/someday", viewH.Someday)
			r.Get("/views/logbook", viewH.Logbook)
			r.Get("/views/trash", viewH.Trash)
			r.Get("/views/counts", viewH.Counts)

			// User Settings
			r.Get("/user/settings", settingsH.Get)
			r.Patch("/user/settings", settingsH.Update)

			// Saved Filters
			r.Get("/saved-filters", savedFilterH.List)
			r.Post("/saved-filters", savedFilterH.Create)
			r.Delete("/saved-filters/{id}", savedFilterH.Delete)

			// Search
			r.Get("/search", searchH.Search)
		})
	})

	// Serve embedded frontend static files with SPA fallback
	staticFS, err := fs.Sub(frontend.StaticFiles, "dist")
	if err != nil {
		panic("failed to create sub filesystem for frontend: " + err.Error())
	}
	indexHTML, _ := fs.ReadFile(staticFS, "index.html")

	r.Handle("/*", http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Try to open the requested file
		path := req.URL.Path[1:] // strip leading /
		if path == "" {
			path = "index.html"
		}

		// Set Cache-Control headers based on file type
		// Hashed assets are immutable; everything else must revalidate
		if strings.HasPrefix(path, "assets/") {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "no-cache")
		}

		if f, err := staticFS.Open(path); err == nil {
			f.Close()
			http.FileServer(http.FS(staticFS)).ServeHTTP(w, req)
			return
		}
		// SPA fallback: serve index.html for all other routes
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write(indexHTML)
	}))

	return r
}
