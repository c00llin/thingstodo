package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type SearchRepository struct {
	db *sql.DB
}

func NewSearchRepository(db *sql.DB) *SearchRepository {
	return &SearchRepository{db: db}
}

// ftsPrefix converts a user query into an FTS5 prefix query.
// e.g. "inbox task" → "inbox* task*" so partial words match.
func ftsPrefix(query string) string {
	words := strings.Fields(query)
	for i, w := range words {
		// Strip any existing trailing * to avoid double-star
		w = strings.TrimRight(w, "*")
		if w != "" {
			words[i] = w + "*"
		}
	}
	return strings.Join(words, " ")
}

func (r *SearchRepository) Search(query string, limit int) ([]model.SearchResult, error) {
	if limit <= 0 {
		limit = 20
	}

	ftsQuery := ftsPrefix(query)

	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			snippet(tasks_fts, 0, '<mark>', '</mark>', '...', 32),
			snippet(tasks_fts, 1, '<mark>', '</mark>', '...', 32),
			rank
		FROM tasks_fts
		JOIN tasks t ON t.rowid = tasks_fts.rowid
		WHERE tasks_fts MATCH ? AND t.deleted_at IS NULL
		ORDER BY rank
		LIMIT ?`, ftsQuery, limit)
	if err != nil {
		return nil, fmt.Errorf("search: %w", err)
	}
	defer rows.Close()

	var results []model.SearchResult
	for rows.Next() {
		var sr model.SearchResult
		var t model.TaskListItem
		var whenEvening, hasNotes, hasLinks, hasFiles, hasRepeat int
		if err := rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening,
			&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
			&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
			&t.CompletedAt, &t.CanceledAt, &t.DeletedAt, &t.CreatedAt, &t.UpdatedAt,
			&t.ChecklistCount, &t.ChecklistDone,
			&hasNotes, &hasLinks, &hasFiles, &hasRepeat,
			&sr.TitleSnippet, &sr.NotesSnippet, &sr.Rank,
		); err != nil {
			return nil, err
		}
		t.WhenEvening = whenEvening == 1
		t.HasNotes = hasNotes == 1
		t.HasLinks = hasLinks == 1
		t.HasFiles = hasFiles == 1
		t.HasRepeatRule = hasRepeat == 1
		t.Tags = []model.TagRef{}
		sr.Task = t
		results = append(results, sr)
	}
	if results == nil {
		results = []model.SearchResult{}
	}
	return results, rows.Err()
}
