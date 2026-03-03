package scheduler

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/push"
	"github.com/collinjanssen/thingstodo/internal/recurrence"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron          *cron.Cron
	taskRepo      *repository.TaskRepository
	ruleRepo      *repository.RepeatRuleRepository
	checklistRepo *repository.ChecklistRepository
	attachRepo    *repository.AttachmentRepository
	scheduleRepo  *repository.ScheduleRepository
	reminderRepo  *repository.ReminderRepository
	settingsRepo  *repository.UserSettingsRepository
	userRepo      *repository.UserRepository
	pushSender    *push.Sender
	broker        *sse.Broker
	db            *sql.DB
	engine        *recurrence.Engine
}

func New(db *sql.DB, taskRepo *repository.TaskRepository, ruleRepo *repository.RepeatRuleRepository, checklistRepo *repository.ChecklistRepository, attachRepo *repository.AttachmentRepository, scheduleRepo *repository.ScheduleRepository, reminderRepo *repository.ReminderRepository, settingsRepo *repository.UserSettingsRepository, userRepo *repository.UserRepository, pushSender *push.Sender, broker *sse.Broker) *Scheduler {
	return &Scheduler{
		cron:          cron.New(),
		taskRepo:      taskRepo,
		ruleRepo:      ruleRepo,
		checklistRepo: checklistRepo,
		attachRepo:    attachRepo,
		scheduleRepo:  scheduleRepo,
		reminderRepo:  reminderRepo,
		settingsRepo:  settingsRepo,
		userRepo:      userRepo,
		pushSender:    pushSender,
		broker:        broker,
		db:            db,
		engine:        recurrence.NewEngine(),
	}
}

func (s *Scheduler) Start() {
	if _, err := s.cron.AddFunc("@every 1h", s.processFixedRules); err != nil {
		log.Printf("scheduler: failed to add recurrence cron: %v", err)
	}
	if _, err := s.cron.AddFunc("@every 1m", s.processReminders); err != nil {
		log.Printf("scheduler: failed to add reminder cron: %v", err)
	}
	s.cron.Start()
	log.Println("scheduler started")
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}

// HandleAfterCompletion is called when a task with mode=after_completion is completed.
func (s *Scheduler) HandleAfterCompletion(taskID string) {
	rule, err := s.ruleRepo.GetByTask(taskID)
	if err != nil || rule == nil || rule.Pattern.Mode != model.RecurrenceModeAfterCompletion {
		return
	}
	s.createNextInstance(taskID, rule)
}

// HandleTaskDone is called when a recurring task is finished (completed, canceled, or won't do).
// It creates the next instance regardless of mode.
func (s *Scheduler) HandleTaskDone(taskID string) {
	rule, err := s.ruleRepo.GetByTask(taskID)
	if err != nil || rule == nil {
		return
	}
	s.createNextInstance(taskID, rule)
}

func (s *Scheduler) processFixedRules() {
	rules, err := s.ruleRepo.ListAll()
	if err != nil {
		log.Printf("scheduler: list rules: %v", err)
		return
	}

	today := time.Now().Format("2006-01-02")

	for _, rule := range rules {
		if rule.Pattern.Mode != model.RecurrenceModeFixed {
			continue
		}
		task, err := s.taskRepo.GetByID(rule.TaskID)
		if err != nil || task == nil {
			continue
		}
		// Only process if the task is completed
		if task.Status != "completed" {
			continue
		}

		nextDate := s.calculateNextDate(task.WhenDate, rule.Pattern)
		if nextDate == "" || nextDate > today {
			continue
		}

		s.createNextInstance(rule.TaskID, &rule)
	}
}

func (s *Scheduler) createNextInstance(originalTaskID string, rule *model.RepeatRule) {
	original, err := s.taskRepo.GetByID(originalTaskID)
	if err != nil || original == nil {
		return
	}

	nextDate := s.calculateNextDate(original.WhenDate, rule.Pattern)

	// Collect tag IDs from original
	tagIDs := make([]string, len(original.Tags))
	for i, t := range original.Tags {
		tagIDs[i] = t.ID
	}

	input := model.CreateTaskInput{
		Title:     original.Title,
		Notes:     original.Notes,
		WhenDate:  &nextDate,
		Deadline:  nil,
		ProjectID: original.ProjectID,
		AreaID:    original.AreaID,
		HeadingID: original.HeadingID,
		TagIDs:    tagIDs,
	}

	newTask, err := s.taskRepo.Create(input)
	if err != nil {
		log.Printf("scheduler: create task instance: %v", err)
		return
	}

	// Note: first schedule entry is created by taskRepo.Create via syncFirstScheduleDate

	// Copy checklist items (unchecked)
	for _, item := range original.Checklist {
		if _, err := s.checklistRepo.Create(newTask.ID, model.CreateChecklistInput{
			Title: item.Title,
		}); err != nil {
			log.Printf("scheduler: copy checklist item for task %s: %v", newTask.ID, err)
		}
	}

	// Copy attachments (links and files — files share the same stored file on disk)
	for _, att := range original.Attachments {
		if _, err := s.attachRepo.Create(newTask.ID, model.CreateAttachmentInput{
			Type:     att.Type,
			Title:    att.Title,
			URL:      att.URL,
			MimeType: att.MimeType,
			FileSize: att.FileSize,
		}); err != nil {
			log.Printf("scheduler: copy attachment for task %s: %v", newTask.ID, err)
		}
	}

	// Copy reminders if setting is enabled
	s.copyRemindersToNewInstance(originalTaskID, newTask.ID)

	// Move repeat rule to new task (pass through the pattern)
	if err := s.ruleRepo.DeleteByTask(originalTaskID); err != nil {
		log.Printf("scheduler: delete rule for task %s: %v", originalTaskID, err)
	}
	if _, err := s.ruleRepo.Upsert(newTask.ID, model.CreateRepeatRuleInput{
		Pattern: &rule.Pattern,
	}); err != nil {
		log.Printf("scheduler: upsert rule for task %s: %v", newTask.ID, err)
	}

	log.Printf("scheduler: created repeat instance %s from %s (next: %s)", newTask.ID, originalTaskID, nextDate)
}

func (s *Scheduler) processReminders() {
	now := time.Now()
	windowStart := now.Add(-1 * time.Minute)
	windowEnd := now.Add(1 * time.Minute)

	// Get morning time from first user's settings (single-user app)
	morningTime := "09:00"
	if user, err := s.userRepo.GetFirst(); err == nil && user != nil {
		if settings, err := s.settingsRepo.GetOrCreate(user.ID); err == nil {
			// evening_starts_at is the evening boundary; morning is typically 09:00
			// We don't have a separate morning setting, so use 09:00 as default
			_ = settings
		}
	}

	// Process relative reminders (at_start, on_day, minutes_before, hours_before, days_before)
	pending, err := s.reminderRepo.GetPendingRelative()
	if err != nil {
		log.Printf("scheduler: get pending relative reminders: %v", err)
	}
	for _, p := range pending {
		fireAt := computeFireAt(p, morningTime)
		if fireAt.IsZero() {
			continue
		}
		if fireAt.Before(windowStart) || !fireAt.Before(windowEnd) {
			continue
		}
		s.fireReminder(p, fireAt)
	}

	// Process exact reminders
	exact, err := s.reminderRepo.GetPendingExact()
	if err != nil {
		log.Printf("scheduler: get pending exact reminders: %v", err)
	}
	for _, p := range exact {
		if p.Reminder.ExactAt == nil {
			continue
		}
		fireAt, err := time.ParseInLocation("2006-01-02T15:04:05", *p.Reminder.ExactAt, time.Local)
		if err != nil {
			fireAt, err = time.ParseInLocation("2006-01-02 15:04:05", *p.Reminder.ExactAt, time.Local)
			if err != nil {
				continue
			}
		}
		if fireAt.Before(windowStart) || !fireAt.Before(windowEnd) {
			continue
		}
		s.fireReminder(p, fireAt)
	}
}

func computeFireAt(p model.PendingReminder, morningTime string) time.Time {
	morningHour, morningMin := 9, 0
	if parts := splitTime(morningTime); parts != nil {
		morningHour, morningMin = parts[0], parts[1]
	}

	switch p.Reminder.Type {
	case model.ReminderAtStart:
		return parseAnchor(p.WhenDate, p.StartTime, morningHour, morningMin)

	case model.ReminderOnDay:
		if p.WhenDate == "" {
			return time.Time{}
		}
		d, err := time.ParseInLocation("2006-01-02", p.WhenDate, time.Local)
		if err != nil {
			return time.Time{}
		}
		return d.Add(time.Duration(morningHour)*time.Hour + time.Duration(morningMin)*time.Minute)

	case model.ReminderMinutesBefore:
		anchor := parseAnchor(p.WhenDate, p.StartTime, morningHour, morningMin)
		if anchor.IsZero() {
			return time.Time{}
		}
		return anchor.Add(-time.Duration(p.Reminder.Value) * time.Minute)

	case model.ReminderHoursBefore:
		anchor := parseAnchor(p.WhenDate, p.StartTime, morningHour, morningMin)
		if anchor.IsZero() {
			return time.Time{}
		}
		return anchor.Add(-time.Duration(p.Reminder.Value) * time.Hour)

	case model.ReminderDaysBefore:
		if p.WhenDate == "" {
			return time.Time{}
		}
		d, err := time.ParseInLocation("2006-01-02", p.WhenDate, time.Local)
		if err != nil {
			return time.Time{}
		}
		d = d.AddDate(0, 0, -p.Reminder.Value)
		return d.Add(time.Duration(morningHour)*time.Hour + time.Duration(morningMin)*time.Minute)
	}
	return time.Time{}
}

// parseAnchor returns the anchor time for time-relative reminders.
// If start_time exists, use when_date + start_time. Otherwise fall back to when_date + morning.
func parseAnchor(whenDate string, startTime *string, morningH, morningM int) time.Time {
	if whenDate == "" || whenDate == "someday" {
		return time.Time{}
	}
	d, err := time.ParseInLocation("2006-01-02", whenDate, time.Local)
	if err != nil {
		return time.Time{}
	}
	if startTime != nil && *startTime != "" {
		parts := splitTime(*startTime)
		if parts != nil {
			return d.Add(time.Duration(parts[0])*time.Hour + time.Duration(parts[1])*time.Minute)
		}
	}
	return d.Add(time.Duration(morningH)*time.Hour + time.Duration(morningM)*time.Minute)
}

// splitTime parses "HH:MM" into [hour, minute].
func splitTime(s string) []int {
	var h, m int
	if _, err := fmt.Sscanf(s, "%d:%d", &h, &m); err != nil {
		return nil
	}
	return []int{h, m}
}

func (s *Scheduler) fireReminder(p model.PendingReminder, fireAt time.Time) {
	fireAtStr := fireAt.Format("2006-01-02T15:04:05")

	// Check dedup log
	if sent, _ := s.reminderRepo.HasBeenSent(p.Reminder.ID, p.ScheduleID, fireAtStr); sent {
		return
	}
	if err := s.reminderRepo.MarkSent(p.Reminder.ID, p.ScheduleID, fireAtStr); err != nil {
		return
	}

	log.Printf("scheduler: firing reminder %s for task %s (%s)", p.Reminder.ID, p.TaskID, p.TaskTitle)

	// Describe the reminder for notification text
	body := describeReminder(p.Reminder)

	// Web Push
	if s.pushSender != nil && s.pushSender.Enabled() {
		if user, err := s.userRepo.GetFirst(); err == nil && user != nil {
			if err := s.pushSender.Send(user.ID, push.Payload{
				Title: p.TaskTitle,
				Body:  body,
				URL:   fmt.Sprintf("/tasks/%s", p.TaskID),
				Tag:   p.Reminder.ID,
			}); err != nil {
				log.Printf("scheduler: push send error: %v", err)
			}
		}
	}

	// SSE broadcast for in-app toast
	s.broker.BroadcastJSON("reminder_fired", map[string]interface{}{
		"task_id":       p.TaskID,
		"task_title":    p.TaskTitle,
		"reminder_type": string(p.Reminder.Type),
		"reminder_value": p.Reminder.Value,
	})
}

func describeReminder(r model.Reminder) string {
	switch r.Type {
	case model.ReminderAtStart:
		return "Starting now"
	case model.ReminderOnDay:
		return "Scheduled for today"
	case model.ReminderMinutesBefore:
		return fmt.Sprintf("Starting in %d minutes", r.Value)
	case model.ReminderHoursBefore:
		if r.Value == 1 {
			return "Starting in 1 hour"
		}
		return fmt.Sprintf("Starting in %d hours", r.Value)
	case model.ReminderDaysBefore:
		if r.Value == 1 {
			return "Scheduled for tomorrow"
		}
		return fmt.Sprintf("Scheduled in %d days", r.Value)
	case model.ReminderExact:
		return "Reminder"
	}
	return "Reminder"
}

func (s *Scheduler) copyRemindersToNewInstance(originalTaskID, newTaskID string) {
	// Check user setting
	if user, err := s.userRepo.GetFirst(); err == nil && user != nil {
		if settings, err := s.settingsRepo.GetOrCreate(user.ID); err == nil && !settings.CopyRemindersToRecurring {
			return
		}
	}

	reminders, err := s.reminderRepo.ListByTask(originalTaskID)
	if err != nil || len(reminders) == 0 {
		return
	}

	for _, r := range reminders {
		if r.Type == model.ReminderExact {
			// Skip exact reminders — they are tied to specific dates
			continue
		}
		if _, err := s.reminderRepo.Create(newTaskID, model.CreateReminderInput{
			Type:  r.Type,
			Value: r.Value,
		}); err != nil {
			log.Printf("scheduler: copy reminder for task %s: %v", newTaskID, err)
		}
	}
}

func (s *Scheduler) calculateNextDate(currentDate *string, pattern model.RecurrencePattern) string {
	fromDate := ""
	if currentDate != nil {
		fromDate = *currentDate
	}

	result, err := s.engine.Next(fromDate, pattern)
	if err != nil {
		log.Printf("scheduler: calculate next date: %v", err)
		// Fallback to simple daily
		if currentDate != nil {
			t, _ := time.Parse("2006-01-02", *currentDate)
			return t.AddDate(0, 0, 1).Format("2006-01-02")
		}
		return time.Now().AddDate(0, 0, 1).Format("2006-01-02")
	}
	return result
}
