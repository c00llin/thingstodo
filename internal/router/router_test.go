package router_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/router"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestHealthEndpoint(t *testing.T) {
	db := testutil.SetupTestDB(t)
	cfg := config.Config{AuthMode: "proxy", AttachmentsPath: t.TempDir()}
	broker := sse.NewBroker()
	taskRepo := repository.NewTaskRepository(db)
	ruleRepo := repository.NewRepeatRuleRepository(db)
	checklistRepo := repository.NewChecklistRepository(db)
	attachRepo := repository.NewAttachmentRepository(db)
	sched := scheduler.New(db, taskRepo, ruleRepo, checklistRepo, attachRepo)

	handler := router.New(db, cfg, broker, sched)
	client := testutil.NewTestClient(t, handler)

	resp := client.Get("/health")
	testutil.AssertStatus(t, resp, 200)
	testutil.AssertJSONField(t, resp, "status", "ok")
}
