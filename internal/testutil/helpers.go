package testutil

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/collinjanssen/thingstodo/internal/database"
)

// SetupTestDB creates a temporary SQLite database with all migrations applied.
// The database and temp directory are cleaned up when the test finishes.
func SetupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dir := t.TempDir()
	dbPath := dir + "/test.db"
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

// TestResponse wraps an HTTP response for convenient assertions.
type TestResponse struct {
	*http.Response
	Body []byte
}

// JSON decodes the response body into the provided value.
func (tr *TestResponse) JSON(t *testing.T, v interface{}) {
	t.Helper()
	if err := json.Unmarshal(tr.Body, v); err != nil {
		t.Fatalf("failed to decode response body: %v\nbody: %s", err, string(tr.Body))
	}
}

// TestClient wraps an httptest.Server for convenient API testing.
type TestClient struct {
	Server *httptest.Server
	t      *testing.T
}

// NewTestClient creates a TestClient from an http.Handler.
func NewTestClient(t *testing.T, handler http.Handler) *TestClient {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	return &TestClient{Server: server, t: t}
}

// Get sends a GET request to the given path.
func (tc *TestClient) Get(path string) *TestResponse {
	tc.t.Helper()
	return tc.do("GET", path, nil)
}

// Post sends a POST request with a JSON body.
func (tc *TestClient) Post(path string, body interface{}) *TestResponse {
	tc.t.Helper()
	return tc.do("POST", path, body)
}

// Patch sends a PATCH request with a JSON body.
func (tc *TestClient) Patch(path string, body interface{}) *TestResponse {
	tc.t.Helper()
	return tc.do("PATCH", path, body)
}

// Delete sends a DELETE request to the given path.
func (tc *TestClient) Delete(path string) *TestResponse {
	tc.t.Helper()
	return tc.do("DELETE", path, nil)
}

func (tc *TestClient) do(method, path string, body interface{}) *TestResponse {
	tc.t.Helper()

	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			tc.t.Fatalf("failed to marshal request body: %v", err)
		}
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, tc.Server.URL+path, reqBody)
	if err != nil {
		tc.t.Fatalf("failed to create request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		tc.t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		tc.t.Fatalf("failed to read response body: %v", err)
	}

	return &TestResponse{Response: resp, Body: respBody}
}

// AssertStatus checks that the response has the expected status code.
func AssertStatus(t *testing.T, resp *TestResponse, expected int) {
	t.Helper()
	if resp.StatusCode != expected {
		t.Errorf("expected status %d, got %d\nbody: %s", expected, resp.StatusCode, string(resp.Body))
	}
}

// AssertJSONField checks that a JSON response contains a field with the expected value.
func AssertJSONField(t *testing.T, resp *TestResponse, field string, expected interface{}) {
	t.Helper()
	var m map[string]interface{}
	resp.JSON(t, &m)
	actual, ok := m[field]
	if !ok {
		t.Errorf("response JSON missing field %q\nbody: %s", field, string(resp.Body))
		return
	}
	expectedStr, _ := json.Marshal(expected)
	actualStr, _ := json.Marshal(actual)
	if string(expectedStr) != string(actualStr) {
		t.Errorf("field %q: expected %s, got %s", field, expectedStr, actualStr)
	}
}
