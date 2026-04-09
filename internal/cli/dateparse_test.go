package cli

import (
	"testing"
	"time"
)

func TestParseDateExpression(t *testing.T) {
	now := time.Date(2026, 4, 9, 12, 0, 0, 0, time.UTC)
	cases := map[string]string{
		"2026-04-15": "2026-04-15",
		"today":      "2026-04-09",
		"tomorrow":   "2026-04-10",
		"next week":  "2026-04-16",
		"monday":     "2026-04-13",
		"someday":    "someday",
	}
	for input, expected := range cases {
		got, err := parseDateExpression(input, now)
		if err != nil {
			t.Fatalf("%s: %v", input, err)
		}
		if got == nil || *got != expected {
			t.Fatalf("%s: expected %q, got %v", input, expected, got)
		}
	}
}

func TestParseInlineAdd(t *testing.T) {
	now := time.Date(2026, 4, 9, 12, 0, 0, 0, time.UTC)
	meta, err := parseInlineAdd("Call dentist tomorrow #health #admin", now)
	if err != nil {
		t.Fatal(err)
	}
	if meta.Title != "Call dentist" {
		t.Fatalf("expected trimmed title, got %q", meta.Title)
	}
	if meta.When == nil || *meta.When != "2026-04-10" {
		t.Fatalf("expected tomorrow to parse, got %v", meta.When)
	}
	if len(meta.Tags) != 2 || meta.Tags[0] != "health" || meta.Tags[1] != "admin" {
		t.Fatalf("unexpected tags: %#v", meta.Tags)
	}
}
