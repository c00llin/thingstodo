package repository

import (
	"database/sql"
	"strconv"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
)

type ViewRepository struct {
	db *sql.DB
}

func NewViewRepository(db *sql.DB) *ViewRepository {
	return &ViewRepository{db: db}
}

func (r *ViewRepository) Inbox() ([]model.TaskListItem, error) {
	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.project_id IS NULL AND t.area_id IS NULL
			AND t.status = 'open' AND t.when_date IS NULL AND t.deleted_at IS NULL
		ORDER BY t.sort_order_today ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTaskListItems(r.db, rows), nil
}

func (r *ViewRepository) Today() (*model.TodayView, error) {
	today := time.Now().Format("2006-01-02")

	// Today tasks (not evening)
	todayRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open' AND t.when_evening = 0
			AND (t.when_date = ? OR t.deadline = ?) AND t.deleted_at IS NULL
		ORDER BY t.sort_order_today ASC`, today, today)
	if err != nil {
		return nil, err
	}
	defer todayRows.Close()
	todayTasks := scanTaskListItems(r.db, todayRows)

	// Evening tasks
	eveningRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open' AND t.when_evening = 1
			AND (t.when_date = ? OR t.deadline = ?) AND t.deleted_at IS NULL
		ORDER BY t.sort_order_today ASC`, today, today)
	if err != nil {
		return nil, err
	}
	defer eveningRows.Close()
	eveningTasks := scanTaskListItems(r.db, eveningRows)

	// Overdue
	overdueRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open' AND t.deadline < ? AND t.deleted_at IS NULL
		ORDER BY t.deadline ASC`, today)
	if err != nil {
		return nil, err
	}
	defer overdueRows.Close()
	overdueTasks := scanTaskListItems(r.db, overdueRows)

	// Earlier: tasks with when_date before today, but not overdue (no overdue deadline)
	earlierRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open'
			AND t.when_date < ? AND t.when_date != 'someday'
			AND (t.deadline IS NULL OR t.deadline >= ?)
			AND t.deleted_at IS NULL
		ORDER BY t.when_date ASC, t.sort_order_today ASC`, today, today)
	if err != nil {
		return nil, err
	}
	defer earlierRows.Close()
	earlierTasks := scanTaskListItems(r.db, earlierRows)

	return &model.TodayView{
		Sections: []model.TodaySection{
			{Title: "Today", Groups: groupByProject(r.db, todayTasks)},
			{Title: "This Evening", Groups: groupByProject(r.db, eveningTasks)},
		},
		Overdue: overdueTasks,
		Earlier: earlierTasks,
	}, nil
}

func (r *ViewRepository) Upcoming(from string, days int) (*model.UpcomingView, error) {
	if from == "" {
		from = time.Now().Format("2006-01-02")
	}
	if days <= 0 {
		days = 30
	}

	startDate, _ := time.Parse("2006-01-02", from)
	endDate := startDate.AddDate(0, 0, days).Format("2006-01-02")

	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open' AND t.when_date >= ? AND t.when_date < ? AND t.when_date != 'someday' AND t.deleted_at IS NULL
		ORDER BY t.when_date ASC, t.sort_order_today ASC`, from, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := scanTaskListItems(r.db, rows)

	// Group by date
	dateMap := make(map[string][]model.TaskListItem)
	var dateOrder []string
	for _, t := range tasks {
		if t.WhenDate == nil {
			continue
		}
		d := *t.WhenDate
		if _, ok := dateMap[d]; !ok {
			dateOrder = append(dateOrder, d)
		}
		dateMap[d] = append(dateMap[d], t)
	}

	var dates []model.DateGroup
	for _, d := range dateOrder {
		dates = append(dates, model.DateGroup{Date: d, Tasks: dateMap[d]})
	}
	if dates == nil {
		dates = []model.DateGroup{}
	}

	// Earlier: tasks with when_date before the from date, not someday, not overdue
	earlierRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open'
			AND t.when_date < ? AND t.when_date != 'someday'
			AND (t.deadline IS NULL OR t.deadline >= ?)
			AND t.deleted_at IS NULL
		ORDER BY t.when_date ASC, t.sort_order_today ASC`, from, from)
	if err != nil {
		return nil, err
	}
	defer earlierRows.Close()
	earlierTasks := scanTaskListItems(r.db, earlierRows)

	return &model.UpcomingView{Dates: dates, Earlier: earlierTasks}, nil
}

func (r *ViewRepository) Anytime() (*model.AnytimeView, error) {
	return r.buildAnytimeView(false)
}

func (r *ViewRepository) Someday() (*model.AnytimeView, error) {
	return r.buildAnytimeView(true)
}

func (r *ViewRepository) buildAnytimeView(somedayOnly bool) (*model.AnytimeView, error) {
	// Anytime: open tasks with no when_date (not scheduled for a specific day, not someday).
	// Someday: open tasks explicitly marked when_date = 'someday'.

	// Get all areas
	areaRows, err := r.db.Query("SELECT id, title FROM areas ORDER BY sort_order")
	if err != nil {
		return nil, err
	}
	defer areaRows.Close()

	var view model.AnytimeView
	for areaRows.Next() {
		var areaRef model.Ref
		_ = areaRows.Scan(&areaRef.ID, &areaRef.Title)

		aa := model.AnytimeArea{Area: areaRef}

		// Projects in area
		projRows, err := r.db.Query(
			"SELECT id, title FROM projects WHERE area_id = ? AND status = 'open' ORDER BY sort_order", areaRef.ID)
		if err != nil {
			continue
		}
		for projRows.Next() {
			var projRef model.Ref
			_ = projRows.Scan(&projRef.ID, &projRef.Title)
			tasks := r.getAnytimeTasks(&projRef.ID, &areaRef.ID, true, somedayOnly)
			if len(tasks) == 0 {
				continue
			}
			aa.Projects = append(aa.Projects, model.AnytimeProject{Project: projRef, Tasks: tasks})
		}
		projRows.Close()
		if aa.Projects == nil {
			aa.Projects = []model.AnytimeProject{}
		}

		// Standalone tasks in area
		aa.StandaloneTasks = r.getAnytimeTasks(nil, &areaRef.ID, false, somedayOnly)

		if len(aa.Projects) == 0 && len(aa.StandaloneTasks) == 0 {
			continue
		}
		view.Areas = append(view.Areas, aa)
	}
	if view.Areas == nil {
		view.Areas = []model.AnytimeArea{}
	}

	// No-area projects
	noAreaProjRows, err := r.db.Query(
		"SELECT id, title FROM projects WHERE area_id IS NULL AND status = 'open' ORDER BY sort_order")
	if err == nil {
		for noAreaProjRows.Next() {
			var projRef model.Ref
			_ = noAreaProjRows.Scan(&projRef.ID, &projRef.Title)
			tasks := r.getAnytimeTasks(&projRef.ID, nil, true, somedayOnly)
			if len(tasks) == 0 {
				continue
			}
			view.NoArea.Projects = append(view.NoArea.Projects, model.AnytimeProject{Project: projRef, Tasks: tasks})
		}
		noAreaProjRows.Close()
	}
	if view.NoArea.Projects == nil {
		view.NoArea.Projects = []model.AnytimeProject{}
	}

	// Standalone tasks with no area, no project
	view.NoArea.StandaloneTasks = r.getAnytimeStandaloneNoArea(somedayOnly)

	return &view, nil
}

func (r *ViewRepository) getAnytimeTasks(projectID, areaID *string, byProject, somedayOnly bool) []model.TaskListItem {
	var query string
	var args []interface{}

	query = `
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t WHERE t.status = 'open' AND t.deleted_at IS NULL`

	if byProject && projectID != nil {
		query += " AND t.project_id = ?"
		args = append(args, *projectID)
	} else if !byProject {
		query += " AND t.project_id IS NULL"
		if areaID != nil {
			query += " AND t.area_id = ?"
			args = append(args, *areaID)
		}
	}

	if somedayOnly {
		query += " AND t.when_date = 'someday'"
	} else {
		query += " AND t.when_date IS NULL"
	}

	query += " ORDER BY t.sort_order_today ASC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return []model.TaskListItem{}
	}
	defer rows.Close()
	return scanTaskListItems(r.db, rows)
}

func (r *ViewRepository) getAnytimeStandaloneNoArea(somedayOnly bool) []model.TaskListItem {
	var query string
	query = `
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status = 'open' AND t.project_id IS NULL AND t.area_id IS NULL AND t.deleted_at IS NULL`

	if somedayOnly {
		query += " AND t.when_date = 'someday'"
	} else {
		query += " AND t.when_date IS NULL AND t.deadline IS NOT NULL"
	}

	query += " ORDER BY t.sort_order_today ASC"

	rows, err := r.db.Query(query)
	if err != nil {
		return []model.TaskListItem{}
	}
	defer rows.Close()
	return scanTaskListItems(r.db, rows)
}

func (r *ViewRepository) Logbook(limit, offset int) (*model.LogbookView, error) {
	if limit <= 0 {
		limit = 50
	}

	var total int
	_ = r.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE status IN ('completed', 'canceled', 'wont_do') AND deleted_at IS NULL").Scan(&total)

	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.status IN ('completed', 'canceled', 'wont_do') AND t.deleted_at IS NULL
		ORDER BY COALESCE(t.completed_at, t.canceled_at, t.updated_at) DESC
		LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := scanTaskListItems(r.db, rows)

	// Group by completion date
	dateMap := make(map[string][]model.TaskListItem)
	var dateOrder []string
	for _, t := range tasks {
		d := ""
		if t.CompletedAt != nil {
			d = (*t.CompletedAt)[:10]
		} else if t.CanceledAt != nil {
			d = (*t.CanceledAt)[:10]
		} else {
			d = t.UpdatedAt[:10]
		}
		if _, ok := dateMap[d]; !ok {
			dateOrder = append(dateOrder, d)
		}
		dateMap[d] = append(dateMap[d], t)
	}

	var groups []model.DateGroup
	for _, d := range dateOrder {
		groups = append(groups, model.DateGroup{Date: d, Tasks: dateMap[d]})
	}
	if groups == nil {
		groups = []model.DateGroup{}
	}

	return &model.LogbookView{Groups: groups, Total: total}, nil
}

func (r *ViewRepository) Trash(limit, offset int) (*model.LogbookView, error) {
	if limit <= 0 {
		limit = 50
	}

	var total int
	_ = r.db.QueryRow("SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL").Scan(&total)

	rows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END
		FROM tasks t
		WHERE t.deleted_at IS NOT NULL
		ORDER BY t.deleted_at DESC
		LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := scanTaskListItems(r.db, rows)

	// Group by deletion date
	dateMap := make(map[string][]model.TaskListItem)
	var dateOrder []string
	for _, t := range tasks {
		d := t.UpdatedAt[:10]
		if t.DeletedAt != nil {
			d = (*t.DeletedAt)[:10]
		}
		if _, ok := dateMap[d]; !ok {
			dateOrder = append(dateOrder, d)
		}
		dateMap[d] = append(dateMap[d], t)
	}

	var groups []model.DateGroup
	for _, d := range dateOrder {
		groups = append(groups, model.DateGroup{Date: d, Tasks: dateMap[d]})
	}
	if groups == nil {
		groups = []model.DateGroup{}
	}

	return &model.LogbookView{Groups: groups, Total: total}, nil
}

func groupByProject(db *sql.DB, tasks []model.TaskListItem) []model.TaskGroup {
	if len(tasks) == 0 {
		return []model.TaskGroup{}
	}

	projectMap := make(map[string][]model.TaskListItem)
	var projectOrder []string

	for _, t := range tasks {
		key := ""
		if t.ProjectID != nil {
			key = *t.ProjectID
		}
		if _, ok := projectMap[key]; !ok {
			projectOrder = append(projectOrder, key)
		}
		projectMap[key] = append(projectMap[key], t)
	}

	var groups []model.TaskGroup
	for _, key := range projectOrder {
		g := model.TaskGroup{Tasks: projectMap[key]}
		if key != "" {
			g.Project = getRef(db, "projects", key)
		}
		groups = append(groups, g)
	}
	return groups
}

func (r *ViewRepository) Counts() (*model.ViewCounts, error) {
	today := time.Now().Format("2006-01-02")
	var c model.ViewCounts
	err := r.db.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM tasks WHERE project_id IS NULL AND area_id IS NULL AND status = 'open' AND when_date IS NULL AND deleted_at IS NULL),
			(SELECT COUNT(*) FROM tasks WHERE status = 'open' AND (when_date = ? OR deadline = ?) AND (deadline IS NULL OR deadline >= ?) AND deleted_at IS NULL),
			(SELECT COUNT(*) FROM tasks WHERE status = 'open' AND deadline < ? AND deleted_at IS NULL),
			(SELECT COUNT(*) FROM tasks WHERE status = 'open' AND when_date IS NULL AND deleted_at IS NULL AND (project_id IS NOT NULL OR area_id IS NOT NULL OR deadline IS NOT NULL)),
			(SELECT COUNT(*) FROM tasks WHERE status = 'open' AND when_date = 'someday' AND deleted_at IS NULL),
			(SELECT COUNT(*) FROM tasks WHERE status IN ('completed', 'canceled', 'wont_do') AND deleted_at IS NULL),
			(SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL)
	`, today, today, today, today).Scan(&c.Inbox, &c.Today, &c.Overdue, &c.Anytime, &c.Someday, &c.Logbook, &c.Trash)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// helper for parsing int from query params
func ParseIntDefault(s string, def int) int {
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}
