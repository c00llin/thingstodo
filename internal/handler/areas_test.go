package handler_test

import (
	"net/http"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/handler"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
	"github.com/go-chi/chi/v5"
)

func setupAreaRouter(t *testing.T) *testutil.TestClient {
	t.Helper()
	db := testutil.SetupTestDB(t)
	broker := sse.NewBroker()
	areaRepo := repository.NewAreaRepository(db)
	areaHandler := handler.NewAreaHandler(areaRepo, broker)

	r := chi.NewRouter()
	r.Route("/api/areas", func(r chi.Router) {
		r.Get("/", areaHandler.List)
		r.Post("/", areaHandler.Create)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", areaHandler.Get)
			r.Patch("/", areaHandler.Update)
			r.Delete("/", areaHandler.Delete)
		})
	})

	return testutil.NewTestClient(t, r)
}

func TestAreaHandlerCreate(t *testing.T) {
	client := setupAreaRouter(t)

	resp := client.Post("/api/areas", map[string]string{"title": "Work"})
	testutil.AssertStatus(t, resp, http.StatusCreated)
	testutil.AssertJSONField(t, resp, "title", "Work")
}

func TestAreaHandlerCreateMissingTitle(t *testing.T) {
	client := setupAreaRouter(t)

	resp := client.Post("/api/areas", map[string]string{})
	testutil.AssertStatus(t, resp, http.StatusBadRequest)
}

func TestAreaHandlerGet(t *testing.T) {
	client := setupAreaRouter(t)

	createResp := client.Post("/api/areas", map[string]string{"title": "Personal"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Get("/api/areas/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "Personal")
}

func TestAreaHandlerGetNotFound(t *testing.T) {
	client := setupAreaRouter(t)

	resp := client.Get("/api/areas/nonexistent")
	testutil.AssertStatus(t, resp, http.StatusNotFound)
}

func TestAreaHandlerUpdate(t *testing.T) {
	client := setupAreaRouter(t)

	createResp := client.Post("/api/areas", map[string]string{"title": "Old"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Patch("/api/areas/"+created["id"].(string), map[string]string{"title": "New"})
	testutil.AssertStatus(t, resp, http.StatusOK)
	testutil.AssertJSONField(t, resp, "title", "New")
}

func TestAreaHandlerDelete(t *testing.T) {
	client := setupAreaRouter(t)

	createResp := client.Post("/api/areas", map[string]string{"title": "To delete"})
	var created map[string]interface{}
	createResp.JSON(t, &created)

	resp := client.Delete("/api/areas/" + created["id"].(string))
	testutil.AssertStatus(t, resp, http.StatusNoContent)

	getResp := client.Get("/api/areas/" + created["id"].(string))
	testutil.AssertStatus(t, getResp, http.StatusNotFound)
}

func TestAreaHandlerList(t *testing.T) {
	client := setupAreaRouter(t)

	client.Post("/api/areas", map[string]string{"title": "Work"})
	client.Post("/api/areas", map[string]string{"title": "Personal"})

	resp := client.Get("/api/areas")
	testutil.AssertStatus(t, resp, http.StatusOK)

	var body map[string]interface{}
	resp.JSON(t, &body)
	areas := body["areas"].([]interface{})
	if len(areas) != 2 {
		t.Errorf("expected 2 areas, got %d", len(areas))
	}
}
