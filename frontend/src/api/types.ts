// Common patterns
export interface ApiError {
  error: string
  code: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
}

// Auth
export interface User {
  id: string
  username: string
}

export interface AuthResponse {
  user: User
  auth_mode: string
}

export interface LoginRequest {
  username: string
  password: string
}

// Tags (embedded in tasks/projects)
export interface TagRef {
  id: string
  title: string
  color: string | null
}

// Tags (full)
export interface Tag {
  id: string
  title: string
  color: string | null
  parent_tag_id: string | null
  sort_order: number
  task_count: number
}

// Checklist
export interface ChecklistItem {
  id: string
  title: string
  completed: boolean
  sort_order: number
}

// Attachments
export interface Attachment {
  id: string
  type: 'file' | 'link'
  title: string
  url: string
  mime_type: string
  file_size: number
  sort_order: number
  created_at: string
}

// Repeat Rules — Recurrence Pattern (discriminated union)
export type RecurrenceMode = 'fixed' | 'after_completion'
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type DayOfWeekFull = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type OrdinalPosition = 'first' | 'second' | 'third' | 'fourth' | 'last'
export type WorkdayPosition = 'first' | 'last'

export type RecurrencePatternType =
  | 'daily'
  | 'daily_weekday'
  | 'daily_weekend'
  | 'weekly'
  | 'monthly_dom'
  | 'monthly_dow'
  | 'monthly_workday'
  | 'yearly_date'
  | 'yearly_dow'

interface PatternBase {
  every: number
  mode: RecurrenceMode
}

export interface DailyPattern extends PatternBase {
  type: 'daily'
}

export interface DailyWeekdayPattern extends PatternBase {
  type: 'daily_weekday'
}

export interface DailyWeekendPattern extends PatternBase {
  type: 'daily_weekend'
}

export interface WeeklyPattern extends PatternBase {
  type: 'weekly'
  on: DayOfWeek[]
}

export interface MonthlyDOMPattern extends PatternBase {
  type: 'monthly_dom'
  day?: number | null // 1-31, 0=last, negative=last-N, null=use when_date
}

export interface MonthlyDOWPattern extends PatternBase {
  type: 'monthly_dow'
  ordinal: OrdinalPosition
  weekday: DayOfWeekFull
}

export interface MonthlyWorkdayPattern extends PatternBase {
  type: 'monthly_workday'
  workday_position: WorkdayPosition
}

export interface YearlyDatePattern extends PatternBase {
  type: 'yearly_date'
  month: number // 1-12
  day?: number | null // 1-31
}

export interface YearlyDOWPattern extends PatternBase {
  type: 'yearly_dow'
  month: number // 1-12
  ordinal: OrdinalPosition
  weekday: DayOfWeekFull
}

export type RecurrencePattern =
  | DailyPattern
  | DailyWeekdayPattern
  | DailyWeekendPattern
  | WeeklyPattern
  | MonthlyDOMPattern
  | MonthlyDOWPattern
  | MonthlyWorkdayPattern
  | YearlyDatePattern
  | YearlyDOWPattern

// Deprecated aliases for backwards compat
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type RepeatMode = RecurrenceMode
export type DayConstraint = DayOfWeek

export interface RepeatRule {
  id: string
  pattern: RecurrencePattern
  // Deprecated flat fields (still present in API responses)
  frequency?: RepeatFrequency
  interval_value?: number
  mode?: RepeatMode
  day_constraints?: DayConstraint[]
}

// Tasks
export type TaskStatus = 'open' | 'completed' | 'canceled' | 'wont_do'

export interface Task {
  id: string
  title: string
  notes: string
  status: TaskStatus
  when_date: string | null
  when_evening: boolean
  high_priority: boolean
  deadline: string | null
  project_id: string | null
  area_id: string | null
  heading_id: string | null
  sort_order_today: number
  sort_order_project: number
  sort_order_heading: number
  completed_at: string | null
  canceled_at: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
  tags: TagRef[]
  checklist_count: number
  checklist_done: number
  has_notes: boolean
  has_links: boolean
  has_files: boolean
  has_repeat_rule: boolean
  project_name: string | null
  area_name: string | null
}

export interface TaskDetail extends Task {
  project: { id: string; title: string } | null
  area: { id: string; title: string } | null
  heading: { id: string; title: string } | null
  checklist: ChecklistItem[]
  attachments: Attachment[]
  repeat_rule: RepeatRule | null
}

export interface CreateTaskRequest {
  title: string
  notes?: string
  when_date?: string | null
  when_evening?: boolean
  high_priority?: boolean
  deadline?: string | null
  project_id?: string | null
  area_id?: string | null
  heading_id?: string | null
  tag_ids?: string[]
}

export interface UpdateTaskRequest {
  title?: string
  notes?: string
  when_date?: string | null
  when_evening?: boolean
  high_priority?: boolean
  deadline?: string | null
  project_id?: string | null
  area_id?: string | null
  heading_id?: string | null
  tag_ids?: string[]
}

export type SortField = 'sort_order_today' | 'sort_order_project' | 'sort_order_heading'

export interface ReorderItem {
  id: string
  sort_field: SortField
  sort_order: number
}

export interface SimpleReorderItem {
  id: string
  sort_order: number
}

// Projects
export type ProjectStatus = 'open' | 'completed' | 'canceled'

export interface Project {
  id: string
  title: string
  notes: string
  area_id: string | null
  area: { id: string; title: string } | null
  status: ProjectStatus
  when_date: string | null
  deadline: string | null
  sort_order: number
  task_count: number
  completed_task_count: number
  tags: TagRef[]
  created_at: string
  updated_at: string
}

export interface Heading {
  id: string
  title: string
  project_id: string
  sort_order: number
}

export interface HeadingWithTasks extends Heading {
  tasks: Task[]
}

export interface ProjectDetail extends Project {
  headings: HeadingWithTasks[]
  tasks_without_heading: Task[]
  completed_tasks: Task[]
}

export interface CreateProjectRequest {
  title: string
  notes?: string
  area_id?: string | null
  when_date?: string | null
  deadline?: string | null
  tag_ids?: string[]
}

export interface UpdateProjectRequest {
  title?: string
  notes?: string
  area_id?: string | null
  when_date?: string | null
  deadline?: string | null
  tag_ids?: string[]
}

// Areas
export interface Area {
  id: string
  title: string
  sort_order: number
  project_count: number
  task_count: number
  standalone_task_count: number
  created_at: string
  updated_at: string
}

export interface AreaDetail extends Area {
  projects: Project[]
  tasks: Task[]
  completed_tasks: Task[]
}

export interface CreateAreaRequest {
  title: string
}

export interface UpdateAreaRequest {
  title?: string
  sort_order?: number
}

// Headings
export interface CreateHeadingRequest {
  title: string
}

export interface UpdateHeadingRequest {
  title?: string
  sort_order?: number
}

// Checklist
export interface CreateChecklistItemRequest {
  title: string
}

export interface UpdateChecklistItemRequest {
  title?: string
  completed?: boolean
  sort_order?: number
}

// Attachments
export interface CreateLinkAttachmentRequest {
  type: 'link'
  title: string
  url: string
}

export interface UpdateAttachmentRequest {
  title?: string
  sort_order?: number
}

// Tags
export interface CreateTagRequest {
  title: string
  parent_tag_id?: string | null
}

export interface UpdateTagRequest {
  title?: string
  color?: string | null
  parent_tag_id?: string | null
  sort_order?: number
}

// Repeat Rules
export interface UpsertRepeatRuleRequest {
  pattern: RecurrencePattern
}

// Deprecated: use UpsertRepeatRuleRequest
export type CreateRepeatRuleRequest = UpsertRepeatRuleRequest

// View responses
export interface InboxView {
  tasks: Task[]
  review: Task[]
}

export interface TodayViewGroup {
  project: { id: string; title: string } | null
  tasks: Task[]
}

export interface TodayViewSection {
  title: string
  groups: TodayViewGroup[]
}

export interface TodayView {
  sections: TodayViewSection[]
  overdue: Task[]
  earlier: Task[]
  completed: Task[]
}

export interface UpcomingViewDate {
  date: string
  tasks: Task[]
}

export interface UpcomingView {
  overdue: Task[]
  dates: UpcomingViewDate[]
  earlier: Task[]
}

export interface AnytimeViewProjectGroup {
  project: { id: string; title: string }
  tasks: Task[]
}

export interface AnytimeViewAreaGroup {
  area: { id: string; title: string }
  projects: AnytimeViewProjectGroup[]
  standalone_tasks: Task[]
}

export interface AnytimeViewNoArea {
  projects: AnytimeViewProjectGroup[]
  standalone_tasks: Task[]
}

export interface AnytimeView {
  areas: AnytimeViewAreaGroup[]
  no_area: AnytimeViewNoArea
}

export interface SomedayView {
  areas: AnytimeViewAreaGroup[]
  no_area: AnytimeViewNoArea
}

export interface LogbookViewGroup {
  date: string
  tasks: Task[]
}

export interface LogbookView {
  groups: LogbookViewGroup[]
  total: number
}

export type TrashView = LogbookView

export interface ViewCounts {
  inbox: number
  today: number
  overdue: number
  review: number
  anytime: number
  someday: number
  logbook: number
  trash: number
}

// Search
export interface SearchResult {
  task: Task
  title_snippet: string
  notes_snippet: string
  rank: number
}

export interface SearchResponse {
  results: SearchResult[]
}

// User Settings
export type SortPreference = 'manual' | 'a-z' | 'z-a'

export interface UserSettings {
  play_complete_sound: boolean
  show_count_main: boolean
  show_count_projects: boolean
  show_count_tags: boolean
  review_after_days: number | null
  sort_areas: SortPreference
  sort_tags: SortPreference
}

// Task query params
export interface TaskQueryParams {
  status?: TaskStatus
  project_id?: string
  area_id?: string
  heading_id?: string
  tag_ids?: string
  when_date?: string
  when_before?: string
  when_after?: string
  has_deadline?: boolean
  is_evening?: boolean
  search?: string
}
