package cli

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"sort"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

var idLikePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,36}$`)

type AmbiguousError struct {
	Kind    string
	Input   string
	Matches []string
}

func (e *AmbiguousError) Error() string {
	return fmt.Sprintf("ambiguous %s reference %q", e.Kind, e.Input)
}

func isIDLike(input string) bool {
	return idLikePattern.MatchString(input)
}

func resolveTaskID(ctx context.Context, client *Client, scope, selector string) (string, error) {
	if isIDLike(selector) {
		return selector, nil
	}

	var tasks []model.TaskListItem
	switch scope {
	case "open":
		var resp struct {
			Tasks []model.TaskListItem `json:"tasks"`
		}
		query := url.Values{
			"status": {"open"},
			"search": {selector},
		}
		if _, err := client.Get(ctx, "/api/tasks", query, &resp); err != nil {
			return "", err
		}
		tasks = resp.Tasks
	case "logbook":
		var resp model.LogbookView
		query := url.Values{"limit": {"200"}}
		if _, err := client.Get(ctx, "/api/views/logbook", query, &resp); err != nil {
			return "", err
		}
		for _, group := range resp.Groups {
			for _, task := range group.Tasks {
				if strings.Contains(strings.ToLower(task.Title), strings.ToLower(selector)) {
					tasks = append(tasks, task)
				}
			}
		}
	case "trash":
		var resp model.LogbookView
		query := url.Values{"limit": {"200"}}
		if _, err := client.Get(ctx, "/api/views/trash", query, &resp); err != nil {
			return "", err
		}
		for _, group := range resp.Groups {
			for _, task := range group.Tasks {
				if strings.Contains(strings.ToLower(task.Title), strings.ToLower(selector)) {
					tasks = append(tasks, task)
				}
			}
		}
	default:
		return "", fmt.Errorf("unsupported task scope %q", scope)
	}
	return pickTaskMatch("task", selector, tasks)
}

func pickTaskMatch(kind, selector string, tasks []model.TaskListItem) (string, error) {
	if len(tasks) == 0 {
		return "", ErrNotFound
	}
	var exact []model.TaskListItem
	for _, task := range tasks {
		if strings.EqualFold(task.Title, selector) {
			exact = append(exact, task)
		}
	}
	if len(exact) == 1 {
		return exact[0].ID, nil
	}
	if len(exact) > 1 {
		return "", newAmbiguousError(kind, selector, exact)
	}
	if len(tasks) == 1 {
		return tasks[0].ID, nil
	}
	return "", newAmbiguousError(kind, selector, tasks)
}

func newAmbiguousError(kind, selector string, tasks []model.TaskListItem) error {
	seen := map[string]bool{}
	matches := make([]string, 0, len(tasks))
	for _, task := range tasks {
		line := fmt.Sprintf("%s (%s)", task.Title, task.ID)
		if !seen[line] {
			seen[line] = true
			matches = append(matches, line)
		}
	}
	sort.Strings(matches)
	return &AmbiguousError{Kind: kind, Input: selector, Matches: matches}
}

type namedRef struct {
	ID    string
	Title string
}

func resolveByName(kind, selector string, refs []namedRef) (string, error) {
	if isIDLike(selector) {
		return selector, nil
	}
	var matches []namedRef
	for _, ref := range refs {
		if strings.EqualFold(ref.Title, selector) {
			return ref.ID, nil
		}
		if strings.Contains(strings.ToLower(ref.Title), strings.ToLower(selector)) {
			matches = append(matches, ref)
		}
	}
	if len(matches) == 1 {
		return matches[0].ID, nil
	}
	if len(matches) == 0 {
		return "", ErrNotFound
	}
	names := make([]string, 0, len(matches))
	for _, match := range matches {
		names = append(names, fmt.Sprintf("%s (%s)", match.Title, match.ID))
	}
	sort.Strings(names)
	return "", &AmbiguousError{Kind: kind, Input: selector, Matches: names}
}

var ErrNotFound = errors.New("not found")
