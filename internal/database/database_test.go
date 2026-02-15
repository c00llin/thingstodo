package database_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestOpenAndMigrate(t *testing.T) {
	db := testutil.SetupTestDB(t)

	// Verify the database is open and responsive.
	if err := db.Ping(); err != nil {
		t.Fatalf("database ping failed: %v", err)
	}

	// Verify migrations tracking table exists.
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM _migrations").Scan(&count)
	if err != nil {
		t.Fatalf("failed to query _migrations: %v", err)
	}
	if count == 0 {
		t.Error("expected at least one migration to be recorded")
	}
}

func TestWALMode(t *testing.T) {
	db := testutil.SetupTestDB(t)

	var journalMode string
	err := db.QueryRow("PRAGMA journal_mode").Scan(&journalMode)
	if err != nil {
		t.Fatalf("failed to query journal_mode: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected journal_mode=wal, got %s", journalMode)
	}
}

func TestForeignKeysEnabled(t *testing.T) {
	db := testutil.SetupTestDB(t)

	var fk int
	err := db.QueryRow("PRAGMA foreign_keys").Scan(&fk)
	if err != nil {
		t.Fatalf("failed to query foreign_keys: %v", err)
	}
	if fk != 1 {
		t.Errorf("expected foreign_keys=1, got %d", fk)
	}
}
