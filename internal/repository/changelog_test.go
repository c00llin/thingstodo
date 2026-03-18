package repository_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestChangeLogRepository_AppendChange(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	seq, err := repo.AppendChange("task", "abc123", "create", nil, `{"id":"abc123","title":"Test"}`, "user1", "device1")
	if err != nil {
		t.Fatalf("AppendChange failed: %v", err)
	}
	if seq <= 0 {
		t.Errorf("expected seq > 0, got %d", seq)
	}
}

func TestChangeLogRepository_AppendChange_WithFields(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	fields := `["title","status"]`
	seq, err := repo.AppendChange("task", "abc123", "update", &fields, `{"id":"abc123","title":"Updated"}`, "user1", "device1")
	if err != nil {
		t.Fatalf("AppendChange failed: %v", err)
	}
	if seq <= 0 {
		t.Errorf("expected seq > 0, got %d", seq)
	}
}

func TestChangeLogRepository_GetChangesSince(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	seq1, _ := repo.AppendChange("task", "id1", "create", nil, `{"id":"id1"}`, "", "")
	seq2, _ := repo.AppendChange("task", "id2", "create", nil, `{"id":"id2"}`, "", "")
	_, _ = repo.AppendChange("task", "id3", "create", nil, `{"id":"id3"}`, "", "")

	_ = seq1

	entries, err := repo.GetChangesSince(seq2, 100)
	if err != nil {
		t.Fatalf("GetChangesSince failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].EntityID != "id3" {
		t.Errorf("expected entity_id 'id3', got %q", entries[0].EntityID)
	}
}

func TestChangeLogRepository_GetChangesSince_Empty(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	entries, err := repo.GetChangesSince(0, 100)
	if err != nil {
		t.Fatalf("GetChangesSince failed: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("expected 0 entries, got %d", len(entries))
	}
}

func TestChangeLogRepository_GetChangesSince_Limit(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	for i := 0; i < 5; i++ {
		repo.AppendChange("task", "id", "create", nil, `{}`, "", "") //nolint:errcheck
	}

	entries, err := repo.GetChangesSince(0, 3)
	if err != nil {
		t.Fatalf("GetChangesSince failed: %v", err)
	}
	if len(entries) != 3 {
		t.Errorf("expected 3 entries (limit), got %d", len(entries))
	}
}

func TestChangeLogRepository_GetChangesSince_OrderedAsc(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	repo.AppendChange("task", "a", "create", nil, `{}`, "", "") //nolint:errcheck
	repo.AppendChange("task", "b", "create", nil, `{}`, "", "") //nolint:errcheck
	repo.AppendChange("task", "c", "create", nil, `{}`, "", "") //nolint:errcheck

	entries, err := repo.GetChangesSince(0, 100)
	if err != nil {
		t.Fatalf("GetChangesSince failed: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
	for i := 1; i < len(entries); i++ {
		if entries[i].Seq <= entries[i-1].Seq {
			t.Errorf("entries not in ascending seq order: %d <= %d", entries[i].Seq, entries[i-1].Seq)
		}
	}
}

func TestChangeLogRepository_GetLatestSeq(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	seq, err := repo.GetLatestSeq()
	if err != nil {
		t.Fatalf("GetLatestSeq failed: %v", err)
	}
	if seq != 0 {
		t.Errorf("expected 0 for empty table, got %d", seq)
	}

	repo.AppendChange("task", "id1", "create", nil, `{}`, "", "") //nolint:errcheck
	latest, _ := repo.AppendChange("task", "id2", "create", nil, `{}`, "", "")

	seq, err = repo.GetLatestSeq()
	if err != nil {
		t.Fatalf("GetLatestSeq failed: %v", err)
	}
	if seq != latest {
		t.Errorf("expected latest seq %d, got %d", latest, seq)
	}
}

func TestChangeLogRepository_PurgeOlderThan(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	// Insert two old entries manually via raw SQL to simulate old timestamps
	_, err := db.Exec(`INSERT INTO change_log (entity, entity_id, action, snapshot, created_at) VALUES (?, ?, ?, ?, datetime('now', '-10 days'))`,
		"task", "old1", "create", `{}`)
	if err != nil {
		t.Fatalf("failed to insert old entry: %v", err)
	}
	_, err = db.Exec(`INSERT INTO change_log (entity, entity_id, action, snapshot, created_at) VALUES (?, ?, ?, ?, datetime('now', '-10 days'))`,
		"task", "old2", "create", `{}`)
	if err != nil {
		t.Fatalf("failed to insert old entry: %v", err)
	}

	// Insert a recent entry
	repo.AppendChange("task", "new1", "create", nil, `{}`, "", "") //nolint:errcheck

	deleted, err := repo.PurgeOlderThan(7)
	if err != nil {
		t.Fatalf("PurgeOlderThan failed: %v", err)
	}
	if deleted != 2 {
		t.Errorf("expected 2 deleted, got %d", deleted)
	}

	entries, _ := repo.GetChangesSince(0, 100)
	if len(entries) != 1 {
		t.Errorf("expected 1 remaining entry, got %d", len(entries))
	}
	if entries[0].EntityID != "new1" {
		t.Errorf("expected remaining entity_id 'new1', got %q", entries[0].EntityID)
	}
}

func TestChangeLogRepository_PurgeOlderThan_NothingToDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)
	repo := repository.NewChangeLogRepository(db)

	repo.AppendChange("task", "id1", "create", nil, `{}`, "", "") //nolint:errcheck

	deleted, err := repo.PurgeOlderThan(7)
	if err != nil {
		t.Fatalf("PurgeOlderThan failed: %v", err)
	}
	if deleted != 0 {
		t.Errorf("expected 0 deleted, got %d", deleted)
	}
}
