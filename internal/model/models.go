package model

import (
	"crypto/rand"
	"encoding/json"
)

const idAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

func NewID() string {
	b := make([]byte, 10)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	for i := range b {
		b[i] = idAlphabet[int(b[i])%len(idAlphabet)]
	}
	return string(b)
}

// --- Domain entities ---

type Area struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	SortOrder    float64 `json:"sort_order"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
	ProjectCount       int `json:"project_count,omitempty"`
	TaskCount          int `json:"task_count,omitempty"`
	StandaloneTaskCount int `json:"standalone_task_count,omitempty"`
}

type AreaDetail struct {
	Area
	Projects       []ProjectListItem `json:"projects"`
	Tasks          []TaskListItem    `json:"tasks"`
	CompletedTasks []TaskListItem    `json:"completed_tasks"`
}

type Project struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Notes     string  `json:"notes"`
	AreaID    *string `json:"area_id"`
	Status    string  `json:"status"`
	WhenDate  *string `json:"when_date"`
	Deadline  *string `json:"deadline"`
	SortOrder float64 `json:"sort_order"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

type ProjectListItem struct {
	Project
	Area               *Ref      `json:"area"`
	TaskCount          int       `json:"task_count"`
	CompletedTaskCount int       `json:"completed_task_count"`
	Tags               []TagRef  `json:"tags"`
}

type ProjectDetail struct {
	ProjectListItem
	Headings             []HeadingWithTasks `json:"headings"`
	TasksWithoutHeading  []TaskListItem     `json:"tasks_without_heading"`
	CompletedTasks       []TaskListItem     `json:"completed_tasks"`
}

type Heading struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	ProjectID string  `json:"project_id"`
	SortOrder float64 `json:"sort_order"`
}

type HeadingWithTasks struct {
	Heading
	Tasks []TaskListItem `json:"tasks"`
}

type Task struct {
	ID                string  `json:"id"`
	Title             string  `json:"title"`
	Notes             string  `json:"notes"`
	Status            string  `json:"status"`
	WhenDate          *string `json:"when_date"`
	WhenEvening       bool    `json:"when_evening"`
	HighPriority      bool    `json:"high_priority"`
	Deadline          *string `json:"deadline"`
	ProjectID         *string `json:"project_id"`
	AreaID            *string `json:"area_id"`
	HeadingID         *string `json:"heading_id"`
	SortOrderToday    float64 `json:"sort_order_today"`
	SortOrderProject  float64 `json:"sort_order_project"`
	SortOrderHeading  float64 `json:"sort_order_heading"`
	CompletedAt       *string `json:"completed_at"`
	CanceledAt        *string `json:"canceled_at"`
	DeletedAt         *string `json:"deleted_at"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

type TaskListItem struct {
	Task
	Tags            []TagRef `json:"tags"`
	ChecklistCount  int      `json:"checklist_count"`
	ChecklistDone   int      `json:"checklist_done"`
	HasNotes        bool     `json:"has_notes"`
	HasLinks        bool     `json:"has_links"`
	HasFiles        bool     `json:"has_files"`
	HasRepeatRule   bool     `json:"has_repeat_rule"`
	ProjectName     *string  `json:"project_name"`
	AreaName        *string  `json:"area_name"`
}

type TaskDetail struct {
	Task
	Project     *Ref             `json:"project"`
	Area        *Ref             `json:"area"`
	HeadingRef  *Ref             `json:"heading"`
	Tags        []TagRef         `json:"tags"`
	Checklist   []ChecklistItem  `json:"checklist"`
	Attachments []Attachment     `json:"attachments"`
	RepeatRule  *RepeatRule      `json:"repeat_rule"`
}

type ChecklistItem struct {
	ID        string  `json:"id"`
	TaskID    string  `json:"task_id,omitempty"`
	Title     string  `json:"title"`
	Completed bool    `json:"completed"`
	SortOrder float64 `json:"sort_order"`
}

type Attachment struct {
	ID        string `json:"id"`
	TaskID    string `json:"task_id,omitempty"`
	Type      string `json:"type"`
	Title     string `json:"title"`
	URL       string `json:"url"`
	MimeType  string `json:"mime_type"`
	FileSize  int64  `json:"file_size"`
	SortOrder float64 `json:"sort_order"`
	CreatedAt string `json:"created_at"`
}

type Tag struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Color       *string `json:"color"`
	ParentTagID *string `json:"parent_tag_id"`
	SortOrder   float64 `json:"sort_order"`
	TaskCount   int     `json:"task_count,omitempty"`
}

type TagRef struct {
	ID    string  `json:"id"`
	Title string  `json:"title"`
	Color *string `json:"color"`
}

type Ref struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type RepeatRule struct {
	ID             string   `json:"id"`
	TaskID         string   `json:"task_id,omitempty"`
	Frequency      string   `json:"frequency"`
	IntervalValue  int      `json:"interval_value"`
	Mode           string   `json:"mode"`
	DayConstraints []string `json:"day_constraints"`
	CreatedAt      string   `json:"created_at,omitempty"`
}

type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at,omitempty"`
}

type UserSettings struct {
	PlayCompleteSound bool `json:"play_complete_sound"`
	ShowCountMain     bool `json:"show_count_main"`
	ShowCountProjects bool `json:"show_count_projects"`
	ShowCountTags     bool `json:"show_count_tags"`
}

type UpdateUserSettingsInput struct {
	PlayCompleteSound *bool `json:"play_complete_sound"`
	ShowCountMain     *bool `json:"show_count_main"`
	ShowCountProjects *bool `json:"show_count_projects"`
	ShowCountTags     *bool `json:"show_count_tags"`
}

// --- Input types ---

type CreateTaskInput struct {
	Title        string   `json:"title"`
	Notes        string   `json:"notes"`
	WhenDate     *string  `json:"when_date"`
	WhenEvening  bool     `json:"when_evening"`
	HighPriority bool     `json:"high_priority"`
	Deadline     *string  `json:"deadline"`
	ProjectID   *string  `json:"project_id"`
	AreaID      *string  `json:"area_id"`
	HeadingID   *string  `json:"heading_id"`
	TagIDs      []string `json:"tag_ids"`
}

type UpdateTaskInput struct {
	Title        *string  `json:"title"`
	Notes        *string  `json:"notes"`
	WhenDate     *string  `json:"when_date"`
	WhenEvening  *bool    `json:"when_evening"`
	HighPriority *bool    `json:"high_priority"`
	Deadline     *string  `json:"deadline"`
	ProjectID   *string  `json:"project_id"`
	AreaID      *string  `json:"area_id"`
	HeadingID   *string  `json:"heading_id"`
	TagIDs      []string `json:"tag_ids"`
	// Use json.RawMessage tracking to detect explicit null vs absent
	Raw map[string]json.RawMessage `json:"-"`
}

type ReorderItem struct {
	ID        string  `json:"id"`
	SortField string  `json:"sort_field"`
	SortOrder float64 `json:"sort_order"`
}

type SimpleReorderItem struct {
	ID        string  `json:"id"`
	SortOrder float64 `json:"sort_order"`
}

type MoveTaskInput struct {
	ProjectID   *string `json:"project_id"`
	AreaID      *string `json:"area_id"`
	HeadingID   *string `json:"heading_id"`
	WhenDate    *string `json:"when_date"`
	WhenEvening *bool   `json:"when_evening"`
}

type CreateProjectInput struct {
	Title    string   `json:"title"`
	Notes    string   `json:"notes"`
	AreaID   *string  `json:"area_id"`
	WhenDate *string  `json:"when_date"`
	Deadline *string  `json:"deadline"`
	TagIDs   []string `json:"tag_ids"`
}

type UpdateProjectInput struct {
	Title    *string `json:"title"`
	Notes    *string `json:"notes"`
	AreaID   *string `json:"area_id"`
	Status   *string `json:"status"`
	WhenDate *string `json:"when_date"`
	Deadline *string `json:"deadline"`
	TagIDs   []string `json:"tag_ids"`
	Raw      map[string]json.RawMessage `json:"-"`
}

type CreateAreaInput struct {
	Title string `json:"title"`
}

type UpdateAreaInput struct {
	Title     *string  `json:"title"`
	SortOrder *float64 `json:"sort_order"`
}

type CreateTagInput struct {
	Title       string  `json:"title"`
	ParentTagID *string `json:"parent_tag_id"`
}

type UpdateTagInput struct {
	Title       *string  `json:"title"`
	Color       *string  `json:"color"`
	ParentTagID *string  `json:"parent_tag_id"`
	SortOrder   *float64 `json:"sort_order"`
	Raw         map[string]json.RawMessage `json:"-"`
}

type CreateHeadingInput struct {
	Title string `json:"title"`
}

type UpdateHeadingInput struct {
	Title     *string  `json:"title"`
	SortOrder *float64 `json:"sort_order"`
}

type CreateChecklistInput struct {
	Title string `json:"title"`
}

type UpdateChecklistInput struct {
	Title     *string  `json:"title"`
	Completed *bool    `json:"completed"`
	SortOrder *float64 `json:"sort_order"`
}

type CreateAttachmentInput struct {
	Type     string `json:"type"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	FileSize int64  `json:"file_size"`
}

type UpdateAttachmentInput struct {
	Title     *string  `json:"title"`
	SortOrder *float64 `json:"sort_order"`
}

type CreateRepeatRuleInput struct {
	Frequency      string   `json:"frequency"`
	IntervalValue  int      `json:"interval_value"`
	Mode           string   `json:"mode"`
	DayConstraints []string `json:"day_constraints"`
}

type TaskFilters struct {
	Status      *string
	ProjectID   *string
	AreaID      *string
	HeadingID   *string
	TagIDs      []string
	WhenDate    *string
	WhenBefore  *string
	WhenAfter   *string
	HasDeadline *bool
	IsEvening   *bool
	Search      *string
}

// --- View response types ---

type TodayView struct {
	Sections  []TodaySection `json:"sections"`
	Overdue   []TaskListItem `json:"overdue"`
	Earlier   []TaskListItem `json:"earlier"`
	Completed []TaskListItem `json:"completed"`
}

type TodaySection struct {
	Title  string       `json:"title"`
	Groups []TaskGroup  `json:"groups"`
}

type TaskGroup struct {
	Project *Ref           `json:"project"`
	Tasks   []TaskListItem `json:"tasks"`
}

type UpcomingView struct {
	Overdue []TaskListItem `json:"overdue"`
	Dates   []DateGroup    `json:"dates"`
	Earlier []TaskListItem `json:"earlier"`
}

type DateGroup struct {
	Date  string         `json:"date"`
	Tasks []TaskListItem `json:"tasks"`
}

type AnytimeView struct {
	Areas  []AnytimeArea  `json:"areas"`
	NoArea AnytimeNoArea  `json:"no_area"`
}

type AnytimeArea struct {
	Area            Ref              `json:"area"`
	Projects        []AnytimeProject `json:"projects"`
	StandaloneTasks []TaskListItem   `json:"standalone_tasks"`
}

type AnytimeProject struct {
	Project Ref            `json:"project"`
	Tasks   []TaskListItem `json:"tasks"`
}

type AnytimeNoArea struct {
	Projects        []AnytimeProject `json:"projects"`
	StandaloneTasks []TaskListItem   `json:"standalone_tasks"`
}

type LogbookView struct {
	Groups []DateGroup `json:"groups"`
	Total  int         `json:"total"`
}

type ViewCounts struct {
	Inbox   int `json:"inbox"`
	Today   int `json:"today"`
	Overdue int `json:"overdue"`
	Anytime int `json:"anytime"`
	Someday int `json:"someday"`
	Logbook int `json:"logbook"`
	Trash   int `json:"trash"`
}

type SearchResult struct {
	Task         TaskListItem `json:"task"`
	TitleSnippet string       `json:"title_snippet"`
	NotesSnippet string       `json:"notes_snippet"`
	Rank         float64      `json:"rank"`
}
