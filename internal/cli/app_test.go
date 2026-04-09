package cli

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	appconfig "github.com/collinjanssen/thingstodo/internal/config"
	"github.com/collinjanssen/thingstodo/internal/push"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/router"
	"github.com/collinjanssen/thingstodo/internal/scheduler"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func newTestCLI(t *testing.T) (*App, *Client) {
	t.Helper()
	db := testutil.SetupTestDB(t)
	userRepo := repository.NewUserRepository(db)
	if _, err := userRepo.Create("admin", "x"); err != nil {
		t.Fatal(err)
	}

	cfg := appconfig.Config{
		AuthMode:        "builtin",
		APIKey:          "test-key",
		JWTSecret:       "secret",
		AttachmentsPath: t.TempDir(),
		Location:        time.UTC,
	}
	broker := sse.NewBroker()
	taskRepo := repository.NewTaskRepository(db, nil)
	ruleRepo := repository.NewRepeatRuleRepository(db, nil)
	checklistRepo := repository.NewChecklistRepository(db, nil)
	attachRepo := repository.NewAttachmentRepository(db, nil)
	scheduleRepo := repository.NewScheduleRepository(db, nil)
	reminderRepo := repository.NewReminderRepository(db, nil)
	settingsRepo := repository.NewUserSettingsRepository(db)
	pushSubRepo := repository.NewPushSubscriptionRepository(db)
	pushSender := push.NewSender(pushSubRepo, "", "", "")
	changeLogRepo := repository.NewChangeLogRepository(db)
	sched := scheduler.New(db, taskRepo, ruleRepo, checklistRepo, attachRepo, scheduleRepo, reminderRepo, settingsRepo, userRepo, changeLogRepo, pushSender, broker, time.UTC)
	handler := router.New(db, cfg, broker, sched)

	httpClient := &http.Client{
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			return rec.Result(), nil
		}),
	}

	var stdout, stderr bytes.Buffer
	home := t.TempDir()
	app := NewApp(Options{
		Stdout:     &stdout,
		Stderr:     &stderr,
		Env:        func(string) string { return "" },
		HomeDir:    home,
		Now:        func() time.Time { return time.Date(2026, 4, 9, 12, 0, 0, 0, time.UTC) },
		HTTPClient: httpClient,
		Version:    "test",
		Commit:     "test",
	})
	client := NewClient("http://example.test", "test-key", 5*time.Second, httpClient)
	return app, client
}

func runCLI(t *testing.T, app *App, args ...string) (int, string, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	app.stdout = &stdout
	app.stderr = &stderr
	code := app.Run(args)
	return code, stdout.String(), stderr.String()
}

func TestCLIJSONToday(t *testing.T) {
	app, client := newTestCLI(t)
	when := "2026-04-09"
	_, err := client.Post(t.Context(), "/api/tasks", map[string]any{
		"title":     "Prepare demo",
		"when_date": when,
	}, nil)
	if err != nil {
		t.Fatal(err)
	}

	code, stdout, stderr := runCLI(t, app, "--url", client.baseURL, "--api-key", "test-key", "--json", "today")
	if code != 0 {
		t.Fatalf("expected exit 0, got %d stderr=%s", code, stderr)
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(stdout), &payload); err != nil {
		t.Fatalf("expected JSON output: %v\n%s", err, stdout)
	}
}

func TestCLIAddInlineDateAndTag(t *testing.T) {
	app, client := newTestCLI(t)
	if _, err := client.Post(t.Context(), "/api/tags", map[string]any{"title": "health"}, nil); err != nil {
		t.Fatal(err)
	}

	code, _, stderr := runCLI(t, app, "--url", client.baseURL, "--api-key", "test-key", "add", "Call dentist tomorrow #health")
	if code != 0 {
		t.Fatalf("expected exit 0, got %d stderr=%s", code, stderr)
	}
	var tasks struct {
		Tasks []map[string]any `json:"tasks"`
	}
	if _, err := client.Get(t.Context(), "/api/tasks", urlValues("search", "Call dentist"), &tasks); err != nil {
		t.Fatal(err)
	}
	if len(tasks.Tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks.Tasks))
	}
	if tasks.Tasks[0]["when_date"] != "2026-04-10" {
		t.Fatalf("expected when_date to be 2026-04-10, got %v", tasks.Tasks[0]["when_date"])
	}
}

func TestCLIAmbiguousDone(t *testing.T) {
	app, client := newTestCLI(t)
	for _, title := range []string{"Send invoice", "Pay invoice"} {
		if _, err := client.Post(t.Context(), "/api/tasks", map[string]any{"title": title}, nil); err != nil {
			t.Fatal(err)
		}
	}
	code, _, stderr := runCLI(t, app, "--url", client.baseURL, "--api-key", "test-key", "done", "invoice")
	if code != 3 {
		t.Fatalf("expected exit 3, got %d stderr=%s", code, stderr)
	}
	if !strings.Contains(stderr, "ambiguous task reference") {
		t.Fatalf("expected ambiguity message, got %s", stderr)
	}
}

func TestCLIUnknownTagFails(t *testing.T) {
	app, client := newTestCLI(t)
	code, _, stderr := runCLI(t, app, "--url", client.baseURL, "--api-key", "test-key", "add", "Call dentist", "--tag", "missing")
	if code != 2 {
		t.Fatalf("expected exit 2, got %d stderr=%s", code, stderr)
	}
	if !strings.Contains(stderr, `unknown tag "missing"`) {
		t.Fatalf("expected unknown tag message, got %s", stderr)
	}
}

func urlValues(k, v string) url.Values {
	return url.Values{k: []string{v}}
}

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}
