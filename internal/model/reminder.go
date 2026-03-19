package model

type ReminderType string

const (
	ReminderAtStart       ReminderType = "at_start"
	ReminderOnDay         ReminderType = "on_day"
	ReminderMinutesBefore ReminderType = "minutes_before"
	ReminderHoursBefore   ReminderType = "hours_before"
	ReminderDaysBefore    ReminderType = "days_before"
	ReminderExact         ReminderType = "exact"
)

type Reminder struct {
	ID        string       `json:"id"`
	TaskID    string       `json:"task_id,omitempty"`
	Type      ReminderType `json:"type"`
	Value     int          `json:"value"`
	ExactAt   *string      `json:"exact_at,omitempty"`
	CreatedAt string       `json:"created_at,omitempty"`
}

type CreateReminderInput struct {
	ID      string       `json:"id,omitempty"`
	Type    ReminderType `json:"type"`
	Value   int          `json:"value"`
	ExactAt *string      `json:"exact_at,omitempty"`
}

type PushSubscription struct {
	ID        string `json:"id"`
	UserID    string `json:"user_id,omitempty"`
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	UserAgent string `json:"user_agent,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
}

type CreatePushSubscriptionInput struct {
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	UserAgent string `json:"user_agent,omitempty"`
}

type ReminderLog struct {
	ID         string `json:"id"`
	ReminderID string `json:"reminder_id"`
	ScheduleID string `json:"schedule_id"`
	FireAt     string `json:"fire_at"`
	SentAt     string `json:"sent_at"`
}

// PendingReminder is a joined result used by the scheduler.
type PendingReminder struct {
	Reminder   Reminder
	TaskTitle  string
	TaskID     string
	ScheduleID string
	WhenDate   string
	StartTime  *string
}
