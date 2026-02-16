package scheduler

import (
	"database/sql"
	"log"
	"strings"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron     *cron.Cron
	taskRepo *repository.TaskRepository
	ruleRepo *repository.RepeatRuleRepository
	db       *sql.DB
}

func New(db *sql.DB, taskRepo *repository.TaskRepository, ruleRepo *repository.RepeatRuleRepository) *Scheduler {
	return &Scheduler{
		cron:     cron.New(),
		taskRepo: taskRepo,
		ruleRepo: ruleRepo,
		db:       db,
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
	if err != nil || rule == nil || rule.Mode != "after_completion" {
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
		if rule.Mode != "fixed" {
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

		nextDate := calculateNextDate(task.WhenDate, rule)
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

	nextDate := calculateNextDate(original.WhenDate, *rule)

	input := model.CreateTaskInput{
		Title:       original.Title,
		Notes:       original.Notes,
		WhenDate:    &nextDate,
		WhenEvening: original.WhenEvening,
		Deadline:    original.Deadline,
		ProjectID:   original.ProjectID,
		AreaID:      original.AreaID,
		HeadingID:   original.HeadingID,
	}

	newTask, err := s.taskRepo.Create(input)
	if err != nil {
		log.Printf("scheduler: create task instance: %v", err)
		return
	}

	// Move repeat rule to new task
	if err := s.ruleRepo.DeleteByTask(originalTaskID); err != nil {
		log.Printf("scheduler: delete rule for task %s: %v", originalTaskID, err)
	}
	if _, err := s.ruleRepo.Upsert(newTask.ID, model.CreateRepeatRuleInput{
		Frequency:      rule.Frequency,
		IntervalValue:  rule.IntervalValue,
		Mode:           rule.Mode,
		DayConstraints: rule.DayConstraints,
	}); err != nil {
		log.Printf("scheduler: upsert rule for task %s: %v", newTask.ID, err)
	}

	log.Printf("scheduler: created repeat instance %s from %s (next: %s)", newTask.ID, originalTaskID, nextDate)
}

func calculateNextDate(currentDate *string, rule model.RepeatRule) string {
	var base time.Time
	if currentDate != nil {
		var err error
		base, err = time.Parse("2006-01-02", *currentDate)
		if err != nil {
			base = time.Now()
		}
	} else {
		base = time.Now()
	}

	switch rule.Frequency {
	case "daily":
		base = base.AddDate(0, 0, rule.IntervalValue)
	case "weekly":
		if len(rule.DayConstraints) > 0 {
			base = nextMatchingDay(base, rule.DayConstraints, rule.IntervalValue)
		} else {
			base = base.AddDate(0, 0, 7*rule.IntervalValue)
		}
	case "monthly":
		base = base.AddDate(0, rule.IntervalValue, 0)
	case "yearly":
		base = base.AddDate(rule.IntervalValue, 0, 0)
	}

	return base.Format("2006-01-02")
}

func nextMatchingDay(from time.Time, days []string, interval int) time.Time {
	dayMap := map[string]time.Weekday{
		"sun": time.Sunday, "mon": time.Monday, "tue": time.Tuesday,
		"wed": time.Wednesday, "thu": time.Thursday, "fri": time.Friday,
		"sat": time.Saturday,
	}

	target := make(map[time.Weekday]bool)
	for _, d := range days {
		if wd, ok := dayMap[strings.ToLower(d)]; ok {
			target[wd] = true
		}
	}

	// Move forward one day at a time, counting weeks
	candidate := from.AddDate(0, 0, 1)
	for i := 0; i < 365; i++ {
		if target[candidate.Weekday()] {
			return candidate
		}
		candidate = candidate.AddDate(0, 0, 1)
	}
	return from.AddDate(0, 0, 7*interval)
}
