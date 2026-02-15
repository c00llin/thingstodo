package router_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/router"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestHealthEndpoint(t *testing.T) {
	db := testutil.SetupTestDB(t)
	cfg := config.Config{AuthMode: "proxy", AttachmentsPath: t.TempDir()}
	broker := sse.NewBroker()

	handler := router.New(db, cfg, broker)
	client := testutil.NewTestClient(t, handler)

	resp := client.Get("/health")
	testutil.AssertStatus(t, resp, 200)
	testutil.AssertJSONField(t, resp, "status", "ok")
}
