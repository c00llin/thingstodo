package cli

import (
	"fmt"
	"strings"
	"time"
)

type InlineAddMeta struct {
	Title string
	When  *string
	Tags  []string
}

func parseDateExpression(input string, now time.Time) (*string, error) {
	s := strings.TrimSpace(strings.ToLower(input))
	if s == "" {
		return nil, nil
	}
	if s == "none" {
		return nil, nil
	}
	if s == "someday" {
		out := "someday"
		return &out, nil
	}
	if t, err := time.Parse("2006-01-02", s); err == nil {
		out := t.Format("2006-01-02")
		return &out, nil
	}

	switch s {
	case "today":
		out := now.Format("2006-01-02")
		return &out, nil
	case "tomorrow":
		out := now.AddDate(0, 0, 1).Format("2006-01-02")
		return &out, nil
	case "next week":
		out := now.AddDate(0, 0, 7).Format("2006-01-02")
		return &out, nil
	}

	weekdayMap := map[string]time.Weekday{
		"sunday": time.Sunday, "sun": time.Sunday,
		"monday": time.Monday, "mon": time.Monday,
		"tuesday": time.Tuesday, "tue": time.Tuesday, "tues": time.Tuesday,
		"wednesday": time.Wednesday, "wed": time.Wednesday,
		"thursday": time.Thursday, "thu": time.Thursday, "thurs": time.Thursday,
		"friday": time.Friday, "fri": time.Friday,
		"saturday": time.Saturday, "sat": time.Saturday,
	}
	if wd, ok := weekdayMap[s]; ok {
		diff := (int(wd) - int(now.Weekday()) + 7) % 7
		out := now.AddDate(0, 0, diff).Format("2006-01-02")
		return &out, nil
	}

	return nil, fmt.Errorf("unsupported date expression %q", input)
}

func parseInlineAdd(input string, now time.Time) (InlineAddMeta, error) {
	meta := InlineAddMeta{Title: strings.TrimSpace(input)}
	if meta.Title == "" {
		return meta, nil
	}

	words := strings.Fields(meta.Title)
	for len(words) > 0 {
		last := words[len(words)-1]
		if !strings.HasPrefix(last, "#") || len(last) == 1 {
			break
		}
		tag := strings.TrimPrefix(last, "#")
		if tag != "" {
			meta.Tags = append([]string{tag}, meta.Tags...)
		}
		words = words[:len(words)-1]
	}

	candidates := []int{2, 1}
	for _, n := range candidates {
		if len(words) < n {
			continue
		}
		phrase := strings.Join(words[len(words)-n:], " ")
		when, err := parseDateExpression(phrase, now)
		if err == nil && when != nil {
			meta.When = when
			words = words[:len(words)-n]
			break
		}
	}

	meta.Title = strings.TrimSpace(strings.Join(words, " "))
	return meta, nil
}
