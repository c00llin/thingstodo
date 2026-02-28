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

func (r *ViewRepository) Inbox(reviewAfterDays *int) (*model.InboxView, error) {
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.project_id IS NULL AND t.area_id IS NULL
			AND t.status = 'open' AND t.when_date IS NULL AND t.deleted_at IS NULL
		ORDER BY t.sort_order_today ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	inboxTasks := scanTaskListItems(r.db, rows)
	populateActionableScheduleFlags(r.db, inboxTasks)

	// Collect inbox task IDs to exclude from review
	inboxIDs := make(map[string]bool, len(inboxTasks))
	for _, t := range inboxTasks {
		inboxIDs[t.ID] = true
	}

	var reviewTasks []model.TaskListItem
	if reviewAfterDays != nil && *reviewAfterDays > 0 {
		reviewRows, err := r.db.Query(`
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
			WHERE t.status = 'open' AND t.deleted_at IS NULL
				AND date(t.updated_at) < date('now', '-' || ? || ' days')
			ORDER BY t.updated_at ASC`, *reviewAfterDays)
		if err != nil {
			return nil, err
		}
		defer reviewRows.Close()
		allReview := scanTaskListItems(r.db, reviewRows)
		populateActionableScheduleFlags(r.db, allReview)

		// Exclude tasks already in inbox
		for _, t := range allReview {
			if !inboxIDs[t.ID] {
				reviewTasks = append(reviewTasks, t)
			}
		}
	}
	if reviewTasks == nil {
		reviewTasks = []model.TaskListItem{}
	}

	return &model.InboxView{Tasks: inboxTasks, Review: reviewTasks}, nil
}

func (r *ViewRepository) Today(eveningStartsAt string) (*model.TodayView, error) {
	today := time.Now().Format("2006-01-02")

	// Today tasks: JOIN task_schedules so multi-schedule entries for today each appear.
	// Includes tasks where ANY schedule entry matches today (not just when_date).
	// Excludes evening entries (start_time >= eveningStartsAt).
	// Tasks without any schedule entry for today (e.g. deadline-only) use LEFT JOIN.
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			ts.start_time,
			ts.end_time,
			ts.id AS schedule_entry_id
		FROM tasks t
		LEFT JOIN task_schedules ts ON ts.task_id = t.id AND ts.when_date = ?
		WHERE t.status = 'open'
			AND (t.when_date = ? OR t.deadline = ?
				OR EXISTS(SELECT 1 FROM task_schedules WHERE task_id = t.id AND when_date = ?))
			AND t.deleted_at IS NULL
			AND (ts.start_time IS NULL OR ts.start_time < ?)
		ORDER BY t.sort_order_today ASC, ts.start_time ASC`, today, today, today, today, eveningStartsAt)
	if err != nil {
		return nil, err
	}
	defer todayRows.Close()
	todayTasks := scanTodayTaskListItems(r.db, todayRows)
	populateActionableScheduleFlags(r.db, todayTasks)

	// Evening tasks: schedule entry's start_time >= eveningStartsAt
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			ts.start_time,
			ts.end_time,
			ts.id AS schedule_entry_id
		FROM tasks t
		LEFT JOIN task_schedules ts ON ts.task_id = t.id AND ts.when_date = ?
		WHERE t.status = 'open'
			AND (t.when_date = ? OR t.deadline = ?
				OR EXISTS(SELECT 1 FROM task_schedules WHERE task_id = t.id AND when_date = ?))
			AND t.deleted_at IS NULL
			AND ts.start_time IS NOT NULL AND ts.start_time >= ?
		ORDER BY t.sort_order_today ASC, ts.start_time ASC`, today, today, today, today, eveningStartsAt)
	if err != nil {
		return nil, err
	}
	defer eveningRows.Close()
	eveningTasks := scanTodayTaskListItems(r.db, eveningRows)
	populateActionableScheduleFlags(r.db, eveningTasks)

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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.status = 'open' AND t.deadline < ? AND t.deleted_at IS NULL
		ORDER BY t.deadline ASC`, today)
	if err != nil {
		return nil, err
	}
	defer overdueRows.Close()
	overdueTasks := scanTaskListItems(r.db, overdueRows)
	populateActionableScheduleFlags(r.db, overdueTasks)

	// Earlier: tasks with when_date before today, but not overdue (no overdue deadline)
	// Only include tasks that have at least one uncompleted past schedule entry
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1),
			(SELECT id FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.status = 'open'
			AND t.when_date < ? AND t.when_date != 'someday'
			AND (t.deadline IS NULL OR t.deadline >= ?)
			AND t.deleted_at IS NULL
			AND EXISTS(SELECT 1 FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0)
		ORDER BY t.when_date ASC, t.sort_order_today ASC`, today, today, today, today, today, today)
	if err != nil {
		return nil, err
	}
	defer earlierRows.Close()
	earlierTasks := scanTodayTaskListItems(r.db, earlierRows)
	populatePastScheduleCounts(r.db, earlierTasks, today)
	populateActionableScheduleFlags(r.db, earlierTasks)

	// Completed today
	completedRows, err := r.db.Query(`
		SELECT t.id, t.title, t.notes, t.status, t.when_date, t.when_evening, t.high_priority,
			t.deadline, t.project_id, t.area_id, t.heading_id,
			t.sort_order_today, t.sort_order_project, t.sort_order_heading,
			t.completed_at, t.canceled_at, t.deleted_at, t.created_at, t.updated_at,
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id), 0),
			COALESCE((SELECT COUNT(*) FROM checklist_items WHERE task_id = t.id AND completed = 1), 0),
			CASE WHEN t.notes != '' THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'link') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM attachments WHERE task_id = t.id AND type = 'file') THEN 1 ELSE 0 END,
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.status IN ('completed', 'canceled', 'wont_do')
			AND COALESCE(t.completed_at, t.canceled_at, t.updated_at) >= ?
			AND t.deleted_at IS NULL
		ORDER BY COALESCE(t.completed_at, t.canceled_at, t.updated_at) DESC`, today)
	if err != nil {
		return nil, err
	}
	defer completedRows.Close()
	completedTasks := scanTaskListItems(r.db, completedRows)

	return &model.TodayView{
		Sections: []model.TodaySection{
			{Title: "Today", Groups: groupByProject(r.db, todayTasks)},
			{Title: "This Evening", Groups: groupByProject(r.db, eveningTasks)},
		},
		Overdue:   overdueTasks,
		Earlier:   earlierTasks,
		Completed: completedTasks,
	}, nil
}

func (r *ViewRepository) Upcoming(from string, days int) (*model.UpcomingView, error) {
	if from == "" {
		from = time.Now().Format("2006-01-02")
	}
	// JOIN task_schedules so a task with multiple schedule dates appears once per date
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			ts.start_time,
			ts.end_time,
			ts.id AS schedule_entry_id,
			ts.when_date AS schedule_date
		FROM tasks t
		JOIN task_schedules ts ON ts.task_id = t.id
		WHERE t.status = 'open' AND ts.when_date >= ? AND ts.when_date != 'someday' AND t.deleted_at IS NULL
		ORDER BY ts.when_date ASC, ts.start_time ASC, t.sort_order_today ASC`, from)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := scanUpcomingTaskListItems(r.db, rows)

	// Group by schedule_date (which may differ from t.when_date for multi-date tasks)
	dateMap := make(map[string][]model.TaskListItem)
	var dateOrder []string
	for _, item := range tasks {
		d := item.date
		if _, ok := dateMap[d]; !ok {
			dateOrder = append(dateOrder, d)
		}
		dateMap[d] = append(dateMap[d], item.task)
	}

	var dates []model.DateGroup
	for _, d := range dateOrder {
		group := dateMap[d]
		populateActionableScheduleFlags(r.db, group)
		dates = append(dates, model.DateGroup{Date: d, Tasks: group})
	}
	if dates == nil {
		dates = []model.DateGroup{}
	}

	// Overdue: tasks with deadline before today
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.status = 'open' AND t.deadline < ? AND t.deleted_at IS NULL
		ORDER BY t.deadline ASC`, from)
	if err != nil {
		return nil, err
	}
	defer overdueRows.Close()
	overdueTasks := scanTaskListItems(r.db, overdueRows)
	populateActionableScheduleFlags(r.db, overdueTasks)

	// Earlier: tasks with when_date before the from date, not someday, not overdue
	// Only include tasks that have at least one uncompleted past schedule entry
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1),
			(SELECT id FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0 ORDER BY sort_order ASC LIMIT 1)
		FROM tasks t
		WHERE t.status = 'open'
			AND t.when_date < ? AND t.when_date != 'someday'
			AND (t.deadline IS NULL OR t.deadline >= ?)
			AND t.deleted_at IS NULL
			AND EXISTS(SELECT 1 FROM task_schedules WHERE task_id = t.id AND when_date < ? AND when_date != 'someday' AND completed = 0)
		ORDER BY t.when_date ASC, t.sort_order_today ASC`, from, from, from, from, from, from)
	if err != nil {
		return nil, err
	}
	defer earlierRows.Close()
	earlierTasks := scanTodayTaskListItems(r.db, earlierRows)
	populatePastScheduleCounts(r.db, earlierTasks, from)
	populateActionableScheduleFlags(r.db, earlierTasks)

	return &model.UpcomingView{Overdue: overdueTasks, Dates: dates, Earlier: earlierTasks}, nil
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
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
	tasks := scanTaskListItems(r.db, rows)
	populateActionableScheduleFlags(r.db, tasks)
	return tasks
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
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
	tasks := scanTaskListItems(r.db, rows)
	populateActionableScheduleFlags(r.db, tasks)
	return tasks
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
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
			CASE WHEN EXISTS(SELECT 1 FROM repeat_rules WHERE task_id = t.id) THEN 1 ELSE 0 END,
			(SELECT start_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1),
			(SELECT end_time FROM task_schedules WHERE task_id = t.id ORDER BY sort_order ASC LIMIT 1)
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

type upcomingItem struct {
	task model.TaskListItem
	date string // the schedule_date for grouping
}

func scanUpcomingTaskListItems(db *sql.DB, rows *sql.Rows) []upcomingItem {
	var items []upcomingItem
	for rows.Next() {
		var t model.TaskListItem
		var whenEvening, highPriority, hasNotes, hasLinks, hasFiles, hasRepeat int
		var scheduleDate string
		_ = rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening, &highPriority,
			&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
			&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
			&t.CompletedAt, &t.CanceledAt, &t.DeletedAt, &t.CreatedAt, &t.UpdatedAt,
			&t.ChecklistCount, &t.ChecklistDone,
			&hasNotes, &hasLinks, &hasFiles, &hasRepeat,
			&t.FirstScheduleTime, &t.FirstScheduleEndTime,
			&t.ScheduleEntryID,
			&scheduleDate,
		)
		_ = whenEvening // column retained in DB but no longer exposed
		t.HighPriority = highPriority == 1
		t.HasNotes = hasNotes == 1
		t.HasLinks = hasLinks == 1
		t.HasFiles = hasFiles == 1
		t.HasRepeatRule = hasRepeat == 1
		// Get tags
		tagRows, _ := db.Query(
			"SELECT t.id, t.title, t.color FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?", t.ID)
		if tagRows != nil {
			var tags []model.TagRef
			for tagRows.Next() {
				var tag model.TagRef
				_ = tagRows.Scan(&tag.ID, &tag.Title, &tag.Color)
				tags = append(tags, tag)
			}
			tagRows.Close()
			if tags == nil {
				tags = []model.TagRef{}
			}
			t.Tags = tags
		} else {
			t.Tags = []model.TagRef{}
		}
		// Resolve project/area names
		if t.ProjectID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM projects WHERE id = ?", *t.ProjectID).Scan(&name); err == nil {
				t.ProjectName = &name
			}
		}
		if t.AreaID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM areas WHERE id = ?", *t.AreaID).Scan(&name); err == nil {
				t.AreaName = &name
			}
		}
		items = append(items, upcomingItem{task: t, date: scheduleDate})
	}
	return items
}

// scanTodayTaskListItems scans rows that include ts.start_time, ts.end_time,
// and ts.id (schedule_entry_id) from a LEFT JOIN on task_schedules.
// Unlike scanUpcomingTaskListItems, there is no extra schedule_date grouping column.
func scanTodayTaskListItems(db *sql.DB, rows *sql.Rows) []model.TaskListItem {
	var tasks []model.TaskListItem
	for rows.Next() {
		var t model.TaskListItem
		var whenEvening, highPriority, hasNotes, hasLinks, hasFiles, hasRepeat int
		_ = rows.Scan(
			&t.ID, &t.Title, &t.Notes, &t.Status, &t.WhenDate, &whenEvening, &highPriority,
			&t.Deadline, &t.ProjectID, &t.AreaID, &t.HeadingID,
			&t.SortOrderToday, &t.SortOrderProject, &t.SortOrderHeading,
			&t.CompletedAt, &t.CanceledAt, &t.DeletedAt, &t.CreatedAt, &t.UpdatedAt,
			&t.ChecklistCount, &t.ChecklistDone,
			&hasNotes, &hasLinks, &hasFiles, &hasRepeat,
			&t.FirstScheduleTime, &t.FirstScheduleEndTime,
			&t.ScheduleEntryID,
		)
		_ = whenEvening // column retained in DB but no longer exposed
		t.HighPriority = highPriority == 1
		t.HasNotes = hasNotes == 1
		t.HasLinks = hasLinks == 1
		t.HasFiles = hasFiles == 1
		t.HasRepeatRule = hasRepeat == 1
		// Get tags
		tagRows, _ := db.Query(
			"SELECT t.id, t.title, t.color FROM tags t JOIN task_tags tt ON t.id = tt.tag_id WHERE tt.task_id = ?", t.ID)
		if tagRows != nil {
			var tags []model.TagRef
			for tagRows.Next() {
				var tag model.TagRef
				_ = tagRows.Scan(&tag.ID, &tag.Title, &tag.Color)
				tags = append(tags, tag)
			}
			tagRows.Close()
			if tags == nil {
				tags = []model.TagRef{}
			}
			t.Tags = tags
		} else {
			t.Tags = []model.TagRef{}
		}
		// Resolve project/area names
		if t.ProjectID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM projects WHERE id = ?", *t.ProjectID).Scan(&name); err == nil {
				t.ProjectName = &name
			}
		}
		if t.AreaID != nil {
			var name string
			if err := db.QueryRow("SELECT title FROM areas WHERE id = ?", *t.AreaID).Scan(&name); err == nil {
				t.AreaName = &name
			}
		}
		tasks = append(tasks, t)
	}
	if tasks == nil {
		tasks = []model.TaskListItem{}
	}
	return tasks
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

func (r *ViewRepository) Counts(reviewAfterDays *int) (*model.ViewCounts, error) {
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

	// Review count: all open non-deleted tasks stale by X days, excluding inbox tasks
	if reviewAfterDays != nil && *reviewAfterDays > 0 {
		_ = r.db.QueryRow(`
			SELECT COUNT(*) FROM tasks
			WHERE status = 'open' AND deleted_at IS NULL
				AND date(updated_at) < date('now', '-' || ? || ' days')
				AND NOT (project_id IS NULL AND area_id IS NULL AND when_date IS NULL)
		`, *reviewAfterDays).Scan(&c.Review)
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

// populateActionableScheduleFlags sets HasActionableSchedules on each task
// that has uncompleted schedule entries requiring confirmation — i.e. past
// entries (will be auto-completed) or future/someday entries (will be deleted).
// If the only uncompleted entries are for today, no flag is set because
// completing today's entry is the normal expected behavior.
func populateActionableScheduleFlags(db *sql.DB, tasks []model.TaskListItem) {
	if len(tasks) == 0 {
		return
	}
	today := time.Now().Format("2006-01-02")
	for i, t := range tasks {
		var count int
		err := db.QueryRow(
			"SELECT COUNT(*) FROM task_schedules WHERE task_id = ? AND completed = 0 AND (when_date != ? OR when_date = 'someday')",
			t.ID, today,
		).Scan(&count)
		if err == nil && count > 0 {
			tasks[i].HasActionableSchedules = true
		}
	}
}

// populatePastScheduleCounts sets PastScheduleCount on each task that has
// schedule entries with when_date before the given date.
func populatePastScheduleCounts(db *sql.DB, tasks []model.TaskListItem, before string) {
	if len(tasks) == 0 {
		return
	}
	for i, t := range tasks {
		var count int
		err := db.QueryRow(
			`SELECT COUNT(*) FROM task_schedules WHERE task_id = ? AND when_date < ? AND when_date != 'someday' AND completed = 0`,
			t.ID, before,
		).Scan(&count)
		if err == nil {
			tasks[i].PastScheduleCount = count
		}
	}
}
