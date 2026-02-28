package scheduler

import (
	"database/sql"
	"log"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/recurrence"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron          *cron.Cron
	taskRepo      *repository.TaskRepository
	ruleRepo      *repository.RepeatRuleRepository
	checklistRepo *repository.ChecklistRepository
	attachRepo    *repository.AttachmentRepository
	scheduleRepo  *repository.ScheduleRepository
	db            *sql.DB
	engine        *recurrence.Engine
}

func New(db *sql.DB, taskRepo *repository.TaskRepository, ruleRepo *repository.RepeatRuleRepository, checklistRepo *repository.ChecklistRepository, attachRepo *repository.AttachmentRepository, scheduleRepo *repository.ScheduleRepository) *Scheduler {
	return &Scheduler{
		cron:          cron.New(),
		taskRepo:      taskRepo,
		ruleRepo:      ruleRepo,
		checklistRepo: checklistRepo,
		attachRepo:    attachRepo,
		scheduleRepo:  scheduleRepo,
		db:            db,
		engine:        recurrence.NewEngine(),
	}
}

func (s *Scheduler) Start() {
	if _, err := s.cron.AddFunc("@every 1h", s.processFixedRules); err != nil {
		log.Printf("scheduler: failed to add cron func: %v", err)
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
		Title:       original.Title,
		Notes:       original.Notes,
		WhenDate:    &nextDate,
		WhenEvening: original.WhenEvening,
		Deadline:    nil,
		ProjectID:   original.ProjectID,
		AreaID:      original.AreaID,
		HeadingID:   original.HeadingID,
		TagIDs:      tagIDs,
	}

	newTask, err := s.taskRepo.Create(input)
	if err != nil {
		log.Printf("scheduler: create task instance: %v", err)
		return
	}

	// Create first schedule entry for the new task
	if err := s.scheduleRepo.CreateFirstEntry(newTask.ID, nextDate); err != nil {
		log.Printf("scheduler: create schedule entry for task %s: %v", newTask.ID, err)
	}

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
