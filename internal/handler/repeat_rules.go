package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/collinjanssen/thingstodo/internal/model"
	"github.com/collinjanssen/thingstodo/internal/recurrence"
	"github.com/collinjanssen/thingstodo/internal/repository"
	"github.com/collinjanssen/thingstodo/internal/sse"
	"github.com/go-chi/chi/v5"
)

type RepeatRuleHandler struct {
	repo     *repository.RepeatRuleRepository
	taskRepo *repository.TaskRepository
	engine   *recurrence.Engine
	broker   *sse.Broker
}

func NewRepeatRuleHandler(repo *repository.RepeatRuleRepository, taskRepo *repository.TaskRepository, engine *recurrence.Engine, broker *sse.Broker) *RepeatRuleHandler {
	return &RepeatRuleHandler{repo: repo, taskRepo: taskRepo, engine: engine, broker: broker}
}

func (h *RepeatRuleHandler) Get(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	rule, err := h.repo.GetByTask(taskID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"repeat_rule": rule})
}

func (h *RepeatRuleHandler) Upsert(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	var input model.CreateRepeatRuleInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}

	// Validate: either pattern or legacy fields must be present
	if input.Pattern != nil {
		if err := validatePattern(input.Pattern); err != nil {
			writeError(w, http.StatusBadRequest, err.Error(), "VALIDATION")
			return
		}
	} else if input.Frequency == "" || input.Mode == "" {
		writeError(w, http.StatusBadRequest, "frequency and mode are required", "VALIDATION")
		return
	}

	if input.IntervalValue <= 0 && input.Pattern == nil {
		input.IntervalValue = 1
	}

	rule, err := h.repo.Upsert(taskID, input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	// Always set when_date to the first occurrence of the recurrence pattern
	today := time.Now().Format("2006-01-02")
	if nextDate, err := h.engine.FirstOnOrAfter(today, rule.Pattern); err == nil {
		if _, err := h.taskRepo.Update(taskID, model.UpdateTaskInput{
			WhenDate: &nextDate,
			Raw:      map[string]json.RawMessage{"when_date": json.RawMessage(`"` + nextDate + `"`)},
		}); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
			return
		}
	}

	h.broker.BroadcastJSON("task_updated", map[string]interface{}{"id": taskID})
	writeJSON(w, http.StatusOK, rule)
}

func (h *RepeatRuleHandler) Delete(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")
	if err := h.repo.DeleteByTask(taskID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

var validPatternTypes = map[model.PatternType]bool{
	model.PatternDaily:          true,
	model.PatternDailyWeekday:   true,
	model.PatternDailyWeekend:   true,
	model.PatternWeekly:         true,
	model.PatternMonthlyDOM:     true,
	model.PatternMonthlyDOW:     true,
	model.PatternMonthlyWorkday: true,
	model.PatternYearlyDate:     true,
	model.PatternYearlyDOW:      true,
}

var validWeekdays = map[string]bool{
	"monday": true, "tuesday": true, "wednesday": true, "thursday": true,
	"friday": true, "saturday": true, "sunday": true,
	"mon": true, "tue": true, "wed": true, "thu": true,
	"fri": true, "sat": true, "sun": true,
}

var validOrdinals = map[string]bool{
	"first": true, "second": true, "third": true, "fourth": true, "last": true,
}

func validatePattern(p *model.RecurrencePattern) error {
	if !validPatternTypes[p.Type] {
		return fmt.Errorf("invalid pattern type: %s", p.Type)
	}
	if p.Mode != model.RecurrenceModeFixed && p.Mode != model.RecurrenceModeAfterCompletion {
		return fmt.Errorf("invalid mode: %s", p.Mode)
	}

	switch p.Type {
	case model.PatternWeekly:
		for _, d := range p.On {
			if !validWeekdays[d] {
				return fmt.Errorf("invalid weekday: %s", d)
			}
		}
	case model.PatternMonthlyDOM:
		if p.Day != nil {
			d := *p.Day
			if d < -30 || d > 31 {
				return fmt.Errorf("day must be between -30 and 31, got %d", d)
			}
		}
	case model.PatternMonthlyDOW:
		if p.Ordinal != "" && !validOrdinals[p.Ordinal] {
			return fmt.Errorf("invalid ordinal: %s", p.Ordinal)
		}
		if p.Weekday != "" && !validWeekdays[p.Weekday] {
			return fmt.Errorf("invalid weekday: %s", p.Weekday)
		}
	case model.PatternMonthlyWorkday:
		if p.WorkdayPosition != "first" && p.WorkdayPosition != "last" {
			return fmt.Errorf("workday_position must be 'first' or 'last'")
		}
	case model.PatternYearlyDate:
		if p.Month < 1 || p.Month > 12 {
			return fmt.Errorf("month must be between 1 and 12")
		}
	case model.PatternYearlyDOW:
		if p.Month < 1 || p.Month > 12 {
			return fmt.Errorf("month must be between 1 and 12")
		}
		if p.Ordinal != "" && !validOrdinals[p.Ordinal] {
			return fmt.Errorf("invalid ordinal: %s", p.Ordinal)
		}
		if p.Weekday != "" && !validWeekdays[p.Weekday] {
			return fmt.Errorf("invalid weekday: %s", p.Weekday)
		}
	}

	return nil
}
