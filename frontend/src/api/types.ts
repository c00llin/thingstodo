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
}

// Tags (full)
export interface Tag {
  id: string
  title: string
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

// Repeat Rules
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type RepeatMode = 'fixed' | 'after_completion'
export type DayConstraint = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface RepeatRule {
  id: string
  frequency: RepeatFrequency
  interval_value: number
  mode: RepeatMode
  day_constraints: DayConstraint[]
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
  parent_tag_id?: string | null
  sort_order?: number
}

// Repeat Rules
export interface CreateRepeatRuleRequest {
  frequency: RepeatFrequency
  interval_value?: number
  mode: RepeatMode
  day_constraints?: DayConstraint[]
}

// View responses
export interface InboxView {
  tasks: Task[]
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
}

export interface UpcomingViewDate {
  date: string
  tasks: Task[]
}

export interface UpcomingView {
  dates: UpcomingViewDate[]
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
export interface UserSettings {
  play_complete_sound: boolean
  show_count_main: boolean
  show_count_projects: boolean
  show_count_tags: boolean
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
