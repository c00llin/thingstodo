package database_test

import (
	"testing"

	"github.com/collinjanssen/thingstodo/internal/testutil"
)

func TestSchemaTablesExist(t *testing.T) {
	db := testutil.SetupTestDB(t)

	expectedTables := []string{
		"areas",
		"projects",
		"headings",
		"tasks",
		"checklist_items",
		"attachments",
		"tags",
		"task_tags",
		"project_tags",
		"repeat_rules",
		"users",
		"_migrations",
	}

	for _, table := range expectedTables {
		var name string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}
}

func TestSchemaFTSExists(t *testing.T) {
	db := testutil.SetupTestDB(t)

	var name string
	err := db.QueryRow(
		"SELECT name FROM sqlite_master WHERE type='table' AND name='tasks_fts'",
	).Scan(&name)
	if err != nil {
		t.Errorf("FTS table tasks_fts not found: %v", err)
	}
}

func TestSchemaIndexesExist(t *testing.T) {
	db := testutil.SetupTestDB(t)

	expectedIndexes := []string{
		"idx_tasks_status",
		"idx_tasks_when_date",
		"idx_tasks_deadline",
		"idx_tasks_project_id",
		"idx_tasks_area_id",
		"idx_tasks_heading_id",
		"idx_projects_area_id",
		"idx_projects_status",
		"idx_checklist_items_task_id",
		"idx_attachments_task_id",
		"idx_headings_project_id",
	}

	for _, idx := range expectedIndexes {
		var name string
		err := db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='index' AND name=?", idx,
		).Scan(&name)
		if err != nil {
			t.Errorf("index %q not found: %v", idx, err)
		}
	}
}

func TestSchemaForeignKeyConstraints(t *testing.T) {
	db := testutil.SetupTestDB(t)

	// Inserting a task with a non-existent project_id should fail.
	_, err := db.Exec(`INSERT INTO tasks (id, title, project_id) VALUES ('t1', 'Test', 'nonexistent')`)
	if err == nil {
		t.Error("expected foreign key constraint violation for tasks.project_id")
	}

	// Inserting a heading with a non-existent project_id should fail.
	_, err = db.Exec(`INSERT INTO headings (id, title, project_id) VALUES ('h1', 'Test', 'nonexistent')`)
	if err == nil {
		t.Error("expected foreign key constraint violation for headings.project_id")
	}
}

func TestSchemaStatusCheckConstraints(t *testing.T) {
	db := testutil.SetupTestDB(t)

	// Invalid task status should be rejected.
	_, err := db.Exec(`INSERT INTO tasks (id, title, status) VALUES ('t1', 'Test', 'invalid')`)
	if err == nil {
		t.Error("expected check constraint violation for invalid task status")
	}

	// Invalid project status should be rejected.
	_, err = db.Exec(`INSERT INTO projects (id, title, status) VALUES ('p1', 'Test', 'invalid')`)
	if err == nil {
		t.Error("expected check constraint violation for invalid project status")
	}
}

func TestSchemaCascadeDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)

	// Create a project and a heading within it.
	_, err := db.Exec(`INSERT INTO projects (id, title) VALUES ('p1', 'Project 1')`)
	if err != nil {
		t.Fatalf("failed to insert project: %v", err)
	}
	_, err = db.Exec(`INSERT INTO headings (id, title, project_id) VALUES ('h1', 'Heading 1', 'p1')`)
	if err != nil {
		t.Fatalf("failed to insert heading: %v", err)
	}

	// Delete the project -- heading should cascade delete.
	_, err = db.Exec(`DELETE FROM projects WHERE id = 'p1'`)
	if err != nil {
		t.Fatalf("failed to delete project: %v", err)
	}

	var count int
	db.QueryRow(`SELECT COUNT(*) FROM headings WHERE id = 'h1'`).Scan(&count)
	if count != 0 {
		t.Error("expected heading to be cascade-deleted with project")
	}
}

func TestSchemaTaskCascadeDelete(t *testing.T) {
	db := testutil.SetupTestDB(t)

	// Create a task with checklist items and attachments.
	_, err := db.Exec(`INSERT INTO tasks (id, title) VALUES ('t1', 'Task 1')`)
	if err != nil {
		t.Fatalf("failed to insert task: %v", err)
	}
	_, err = db.Exec(`INSERT INTO checklist_items (id, task_id, title) VALUES ('c1', 't1', 'Item 1')`)
	if err != nil {
		t.Fatalf("failed to insert checklist item: %v", err)
	}
	_, err = db.Exec(`INSERT INTO attachments (id, task_id, type, url) VALUES ('a1', 't1', 'link', 'https://example.com')`)
	if err != nil {
		t.Fatalf("failed to insert attachment: %v", err)
	}
	_, err = db.Exec(`INSERT INTO tags (id, title) VALUES ('tag1', 'urgent')`)
	if err != nil {
		t.Fatalf("failed to insert tag: %v", err)
	}
	_, err = db.Exec(`INSERT INTO task_tags (task_id, tag_id) VALUES ('t1', 'tag1')`)
	if err != nil {
		t.Fatalf("failed to insert task_tag: %v", err)
	}

	// Delete the task -- children should cascade delete.
	_, err = db.Exec(`DELETE FROM tasks WHERE id = 't1'`)
	if err != nil {
		t.Fatalf("failed to delete task: %v", err)
	}

	tables := []struct {
		table string
		query string
	}{
		{"checklist_items", "SELECT COUNT(*) FROM checklist_items WHERE task_id = 't1'"},
		{"attachments", "SELECT COUNT(*) FROM attachments WHERE task_id = 't1'"},
		{"task_tags", "SELECT COUNT(*) FROM task_tags WHERE task_id = 't1'"},
	}

	for _, tc := range tables {
		var count int
		db.QueryRow(tc.query).Scan(&count)
		if count != 0 {
			t.Errorf("expected %s to be cascade-deleted with task, got count=%d", tc.table, count)
		}
	}
}
