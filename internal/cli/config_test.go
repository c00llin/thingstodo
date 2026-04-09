package cli

import (
	"os"
	"path/filepath"
	"testing"
)

func TestResolveConfigPrecedence(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, ".config", "thingstodo", "config.toml")
	cfg := FileConfig{
		URL:            "http://file-root",
		APIKey:         "file-root-key",
		DefaultProfile: "home",
		Profiles: map[string]ProfileConfig{
			"home": {
				URL:    "http://file-profile",
				APIKey: "file-profile-key",
			},
		},
	}
	if err := writeConfigFile(path, cfg); err != nil {
		t.Fatal(err)
	}

	env := func(key string) string {
		switch key {
		case "THINGSTODO_URL":
			return "http://env"
		case "THINGSTODO_API_KEY":
			return "env-key"
		default:
			return ""
		}
	}

	resolved, _, err := resolveConfig(home, env, GlobalFlags{
		URL:     "http://flag",
		APIKey:  "flag-key",
		Timeout: "3s",
	})
	if err != nil {
		t.Fatal(err)
	}
	if resolved.URL != "http://flag" {
		t.Fatalf("expected flag URL, got %q", resolved.URL)
	}
	if resolved.APIKey != "flag-key" {
		t.Fatalf("expected flag API key, got %q", resolved.APIKey)
	}
	if resolved.Timeout.Seconds() != 3 {
		t.Fatalf("expected timeout 3s, got %s", resolved.Timeout)
	}
}

func TestWriteAndParseConfigFile(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, ".config", "thingstodo", "config.toml")
	cfg := FileConfig{
		URL:            "http://localhost:2999",
		APIKey:         "secret",
		DefaultProfile: "local",
		Profiles: map[string]ProfileConfig{
			"local": {
				URL:    "http://localhost:2999",
				APIKey: "secret",
			},
		},
	}
	if err := writeConfigFile(path, cfg); err != nil {
		t.Fatal(err)
	}
	parsed, found, err := parseConfigFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !found {
		t.Fatal("expected config file to be found")
	}
	if parsed.DefaultProfile != "local" {
		t.Fatalf("expected default_profile local, got %q", parsed.DefaultProfile)
	}
	if parsed.Profiles["local"].APIKey != "secret" {
		t.Fatalf("expected local profile api key to round trip")
	}
}

func TestParseConfigFileMissing(t *testing.T) {
	home := t.TempDir()
	path := filepath.Join(home, "missing.toml")
	_, found, err := parseConfigFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if found {
		t.Fatal("expected missing config file")
	}
	if _, err := os.Stat(filepath.Dir(path)); err == nil {
		// no-op; only here to keep temp dir in use for Windows-like FS behavior
	}
}
