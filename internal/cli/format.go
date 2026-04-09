package cli

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/collinjanssen/thingstodo/internal/model"
)

func renderTaskLine(task model.TaskListItem) string {
	status := "[ ]"
	if task.HighPriority {
		status = "[!]"
	}
	parts := []string{status, task.Title}
	if task.ProjectName != nil && *task.ProjectName != "" {
		parts = append(parts, *task.ProjectName)
	}
	if task.Deadline != nil && *task.Deadline != "" {
		parts = append(parts, "due "+*task.Deadline)
	} else if task.WhenDate != nil && *task.WhenDate != "" && *task.WhenDate != "someday" {
		parts = append(parts, *task.WhenDate)
	}
	return strings.Join(parts, "  ")
}

func renderTaskDetail(task model.TaskDetail) string {
	var b strings.Builder
	fmt.Fprintln(&b, task.Title)
	fmt.Fprintf(&b, "id: %s\n", task.ID)
	fmt.Fprintf(&b, "status: %s\n", task.Status)
	if task.Project != nil {
		fmt.Fprintf(&b, "project: %s\n", task.Project.Title)
	}
	if task.Area != nil {
		fmt.Fprintf(&b, "area: %s\n", task.Area.Title)
	}
	if task.HeadingRef != nil {
		fmt.Fprintf(&b, "heading: %s\n", task.HeadingRef.Title)
	}
	var tags []string
	for _, tag := range task.Tags {
		tags = append(tags, tag.Title)
	}
	fmt.Fprintf(&b, "tags: %s\n", strings.Join(tags, ", "))
	if task.WhenDate != nil {
		fmt.Fprintf(&b, "when: %s\n", *task.WhenDate)
	} else {
		fmt.Fprintln(&b, "when: none")
	}
	if task.Deadline != nil {
		fmt.Fprintf(&b, "deadline: %s\n", *task.Deadline)
	} else {
		fmt.Fprintln(&b, "deadline: none")
	}
	if task.Notes != "" {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "notes:")
		fmt.Fprintln(&b, task.Notes)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderInbox(view model.InboxView) string {
	var b strings.Builder
	fmt.Fprintln(&b, "Inbox")
	writeTaskLines(&b, view.Tasks)
	if len(view.Review) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Review")
		writeTaskLines(&b, view.Review)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderToday(view model.TodayView) string {
	var b strings.Builder
	fmt.Fprintln(&b, "Today")
	for _, section := range view.Sections {
		if len(section.Groups) == 0 {
			continue
		}
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, section.Title)
		for _, group := range section.Groups {
			for _, task := range group.Tasks {
				fmt.Fprintln(&b, renderTaskLine(task))
			}
		}
	}
	if len(view.Overdue) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Overdue")
		writeTaskLines(&b, view.Overdue)
	}
	if len(view.Earlier) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Earlier")
		writeTaskLines(&b, view.Earlier)
	}
	if len(view.Completed) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Completed")
		writeTaskLines(&b, view.Completed)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderUpcoming(view model.UpcomingView) string {
	var b strings.Builder
	fmt.Fprintln(&b, "Upcoming")
	if len(view.Overdue) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Overdue")
		writeTaskLines(&b, view.Overdue)
	}
	for _, group := range view.Dates {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, group.Date)
		writeTaskLines(&b, group.Tasks)
	}
	if len(view.Earlier) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "Earlier")
		writeTaskLines(&b, view.Earlier)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderAnytime(title string, view model.AnytimeView) string {
	var b strings.Builder
	fmt.Fprintln(&b, title)
	for _, area := range view.Areas {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, area.Area.Title)
		for _, project := range area.Projects {
			fmt.Fprintf(&b, "%s\n", project.Project.Title)
			writeTaskLines(&b, project.Tasks)
		}
		writeTaskLines(&b, area.StandaloneTasks)
	}
	if len(view.NoArea.Projects) > 0 || len(view.NoArea.StandaloneTasks) > 0 {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, "No Area")
		for _, project := range view.NoArea.Projects {
			fmt.Fprintln(&b, project.Project.Title)
			writeTaskLines(&b, project.Tasks)
		}
		writeTaskLines(&b, view.NoArea.StandaloneTasks)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderLogbook(title string, view model.LogbookView) string {
	var b strings.Builder
	fmt.Fprintln(&b, title)
	for _, group := range view.Groups {
		fmt.Fprintln(&b)
		fmt.Fprintln(&b, group.Date)
		writeTaskLines(&b, group.Tasks)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderSearch(results []model.SearchResult) string {
	var b strings.Builder
	fmt.Fprintln(&b, "Search")
	for _, result := range results {
		fmt.Fprintln(&b, renderTaskLine(result.Task))
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderProjects(projects []model.ProjectListItem) string {
	var b strings.Builder
	for _, project := range projects {
		fmt.Fprintf(&b, "%s  %s\n", project.ID, project.Title)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderAreas(areas []model.Area) string {
	var b strings.Builder
	for _, area := range areas {
		fmt.Fprintf(&b, "%s  %s\n", area.ID, area.Title)
	}
	return strings.TrimRight(b.String(), "\n")
}

func renderTags(tags []model.Tag) string {
	var b strings.Builder
	for _, tag := range tags {
		fmt.Fprintf(&b, "%s  %s\n", tag.ID, tag.Title)
	}
	return strings.TrimRight(b.String(), "\n")
}

func writeTaskLines(b *strings.Builder, tasks []model.TaskListItem) {
	for _, task := range tasks {
		fmt.Fprintln(b, renderTaskLine(task))
	}
}

func writeOutput(buf *bytes.Buffer, text string) {
	if text == "" {
		return
	}
	buf.WriteString(text)
	if !strings.HasSuffix(text, "\n") {
		buf.WriteByte('\n')
	}
}
