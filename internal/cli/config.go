package cli

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

type ProfileConfig struct {
	URL      string `json:"url"`
	APIKey   string `json:"api_key"`
	Output   string `json:"output,omitempty"`
	Timezone string `json:"timezone,omitempty"`
}

type FileConfig struct {
	URL            string                   `json:"url,omitempty"`
	APIKey         string                   `json:"api_key,omitempty"`
	Output         string                   `json:"output,omitempty"`
	Timezone       string                   `json:"timezone,omitempty"`
	DefaultProfile string                   `json:"default_profile,omitempty"`
	Profiles       map[string]ProfileConfig `json:"profiles,omitempty"`
}

type GlobalFlags struct {
	URL     string
	APIKey  string
	JSON    bool
	NoColor bool
	Quiet   bool
	Timeout string
	Profile string
}

type ResolvedConfig struct {
	URL         string        `json:"url"`
	APIKey      string        `json:"api_key"`
	Output      string        `json:"output,omitempty"`
	Timezone    string        `json:"timezone,omitempty"`
	Profile     string        `json:"profile,omitempty"`
	ConfigPath  string        `json:"config_path"`
	Timeout     time.Duration `json:"timeout"`
	JSON        bool          `json:"json"`
	NoColor     bool          `json:"no_color"`
	Quiet       bool          `json:"quiet"`
	HasConfig   bool          `json:"has_config"`
	ConfigFound bool          `json:"config_found"`
}

func configPath(homeDir string) string {
	return filepath.Join(homeDir, ".config", "thingstodo", "config.toml")
}

func parseConfigFile(path string) (FileConfig, bool, error) {
	var cfg FileConfig
	cfg.Profiles = map[string]ProfileConfig{}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return cfg, false, nil
		}
		return cfg, false, err
	}

	currentProfile := ""
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "[") && strings.HasSuffix(line, "]") {
			section := strings.TrimSuffix(strings.TrimPrefix(line, "["), "]")
			currentProfile = ""
			if strings.HasPrefix(section, "profiles.") {
				currentProfile = strings.TrimPrefix(section, "profiles.")
				if cfg.Profiles == nil {
					cfg.Profiles = map[string]ProfileConfig{}
				}
				if _, ok := cfg.Profiles[currentProfile]; !ok {
					cfg.Profiles[currentProfile] = ProfileConfig{}
				}
			}
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return cfg, true, fmt.Errorf("invalid config line: %q", line)
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		unquoted, err := parseTOMLString(value)
		if err != nil {
			return cfg, true, err
		}

		if currentProfile != "" {
			profile := cfg.Profiles[currentProfile]
			switch key {
			case "url":
				profile.URL = unquoted
			case "api_key":
				profile.APIKey = unquoted
			case "output":
				profile.Output = unquoted
			case "timezone":
				profile.Timezone = unquoted
			}
			cfg.Profiles[currentProfile] = profile
			continue
		}

		switch key {
		case "url":
			cfg.URL = unquoted
		case "api_key":
			cfg.APIKey = unquoted
		case "output":
			cfg.Output = unquoted
		case "timezone":
			cfg.Timezone = unquoted
		case "default_profile":
			cfg.DefaultProfile = unquoted
		}
	}

	return cfg, true, nil
}

func parseTOMLString(value string) (string, error) {
	if value == "" {
		return "", nil
	}
	if strings.HasPrefix(value, "\"") {
		return strconv.Unquote(value)
	}
	return value, nil
}

func writeConfigFile(path string, cfg FileConfig) error {
	if cfg.Profiles == nil {
		cfg.Profiles = map[string]ProfileConfig{}
	}
	var lines []string
	if cfg.URL != "" {
		lines = append(lines, `url = `+strconv.Quote(cfg.URL))
	}
	if cfg.APIKey != "" {
		lines = append(lines, `api_key = `+strconv.Quote(cfg.APIKey))
	}
	if cfg.Output != "" {
		lines = append(lines, `output = `+strconv.Quote(cfg.Output))
	}
	if cfg.Timezone != "" {
		lines = append(lines, `timezone = `+strconv.Quote(cfg.Timezone))
	}
	if cfg.DefaultProfile != "" {
		lines = append(lines, `default_profile = `+strconv.Quote(cfg.DefaultProfile))
	}

	names := make([]string, 0, len(cfg.Profiles))
	for name := range cfg.Profiles {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		p := cfg.Profiles[name]
		lines = append(lines, "")
		lines = append(lines, "[profiles."+name+"]")
		if p.URL != "" {
			lines = append(lines, `url = `+strconv.Quote(p.URL))
		}
		if p.APIKey != "" {
			lines = append(lines, `api_key = `+strconv.Quote(p.APIKey))
		}
		if p.Output != "" {
			lines = append(lines, `output = `+strconv.Quote(p.Output))
		}
		if p.Timezone != "" {
			lines = append(lines, `timezone = `+strconv.Quote(p.Timezone))
		}
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(strings.Join(lines, "\n")+"\n"), 0o600)
}

func resolveConfig(homeDir string, env func(string) string, flags GlobalFlags) (ResolvedConfig, FileConfig, error) {
	if homeDir == "" {
		var err error
		homeDir, err = os.UserHomeDir()
		if err != nil {
			return ResolvedConfig{}, FileConfig{}, err
		}
	}

	path := configPath(homeDir)
	fileCfg, found, err := parseConfigFile(path)
	if err != nil {
		return ResolvedConfig{}, FileConfig{}, err
	}

	resolved := ResolvedConfig{
		ConfigPath:  path,
		ConfigFound: found,
		HasConfig:   found,
		Timeout:     10 * time.Second,
		NoColor:     flags.NoColor,
		Quiet:       flags.Quiet,
	}

	resolved.URL = fileCfg.URL
	resolved.APIKey = fileCfg.APIKey
	resolved.Output = fileCfg.Output
	resolved.Timezone = fileCfg.Timezone

	selectedProfile := flags.Profile
	if selectedProfile == "" {
		selectedProfile = fileCfg.DefaultProfile
	}
	if selectedProfile != "" {
		if profile, ok := fileCfg.Profiles[selectedProfile]; ok {
			if profile.URL != "" {
				resolved.URL = profile.URL
			}
			if profile.APIKey != "" {
				resolved.APIKey = profile.APIKey
			}
			if profile.Output != "" {
				resolved.Output = profile.Output
			}
			if profile.Timezone != "" {
				resolved.Timezone = profile.Timezone
			}
			resolved.Profile = selectedProfile
		}
	}

	if v := env("THINGSTODO_URL"); v != "" {
		resolved.URL = v
	}
	if v := env("THINGSTODO_API_KEY"); v != "" {
		resolved.APIKey = v
	}

	if flags.URL != "" {
		resolved.URL = flags.URL
	}
	if flags.APIKey != "" {
		resolved.APIKey = flags.APIKey
	}
	if flags.Timeout != "" {
		d, err := time.ParseDuration(flags.Timeout)
		if err != nil {
			return ResolvedConfig{}, FileConfig{}, fmt.Errorf("invalid timeout %q", flags.Timeout)
		}
		resolved.Timeout = d
	}

	if flags.JSON || strings.EqualFold(resolved.Output, "json") {
		resolved.JSON = true
	}

	return resolved, fileCfg, nil
}

func marshalIndented(v any) ([]byte, error) {
	return json.MarshalIndent(v, "", "  ")
}
