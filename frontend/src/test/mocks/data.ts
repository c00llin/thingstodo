import type {
  Task,
  TaskDetail,
  Project,
  ProjectDetail,
  Area,
  Tag,
  InboxView,
  TodayView,
  ViewCounts,
  UserSettings,
} from '../../api/types'

export const mockTask: Task = {
  id: 'task-1',
  title: 'Buy groceries',
  notes: '',
  status: 'open',
  when_date: null,
  high_priority: false,
  deadline: null,
  project_id: null,
  area_id: null,
  heading_id: null,
  sort_order_today: 1024,
  sort_order_project: 1024,
  sort_order_heading: 1024,
  completed_at: null,
  canceled_at: null,
  deleted_at: null,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  tags: [],
  checklist_count: 0,
  checklist_done: 0,
  has_notes: false,
  has_links: false,
  has_files: false,
  has_repeat_rule: false,
  project_name: null,
  area_name: null,
}

export const mockTaskWithTags: Task = {
  ...mockTask,
  id: 'task-2',
  title: 'Review PR',
  tags: [{ id: 'tag-1', title: 'work', color: null }],
  deadline: '2026-03-15',
  when_date: '2026-03-10',
  checklist_count: 3,
  checklist_done: 1,
}

export const mockTaskDetail: TaskDetail = {
  ...mockTask,
  project: null,
  area: null,
  heading: null,
  checklist: [],
  attachments: [],
  repeat_rule: null,
}

export const mockProject: Project = {
  id: 'proj-1',
  title: 'Website Redesign',
  notes: 'Redesign the company website',
  area_id: 'area-1',
  area: { id: 'area-1', title: 'Work' },
  status: 'open',
  when_date: null,
  deadline: null,
  sort_order: 1024,
  task_count: 5,
  completed_task_count: 2,
  tags: [],
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
}

export const mockProjectDetail: ProjectDetail = {
  ...mockProject,
  headings: [
    {
      id: 'heading-1',
      title: 'Design',
      project_id: 'proj-1',
      sort_order: 1024,
      tasks: [
        { ...mockTask, id: 'task-3', title: 'Create mockups', project_id: 'proj-1', heading_id: 'heading-1' },
      ],
    },
  ],
  tasks_without_heading: [
    { ...mockTask, id: 'task-4', title: 'Setup project repo', project_id: 'proj-1' },
  ],
  completed_tasks: [],
}

export const mockArea: Area = {
  id: 'area-1',
  title: 'Work',
  sort_order: 1024,
  project_count: 2,
  task_count: 5,
  standalone_task_count: 0,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
}

export const mockTag: Tag = {
  id: 'tag-1',
  title: 'urgent',
  color: null,
  parent_tag_id: null,
  sort_order: 1024,
  task_count: 3,
}

export const mockViewCounts: ViewCounts = {
  inbox: 2,
  today: 1,
  overdue: 0,
  review: 0,
  anytime: 0,
  someday: 0,
  logbook: 0,
  trash: 0,
}

export const mockUserSettings: UserSettings = {
  play_complete_sound: true,
  show_count_main: true,
  show_count_projects: true,
  show_count_tags: true,
  review_after_days: 7,
  sort_areas: 'manual',
  sort_tags: 'manual',
}

export const mockInboxView: InboxView = {
  tasks: [mockTask, { ...mockTask, id: 'task-5', title: 'Clean kitchen' }],
  review: [],
}

export const mockEmptyInboxView: InboxView = {
  tasks: [],
  review: [],
}

export const mockTodayView: TodayView = {
  sections: [
    {
      title: 'Today',
      groups: [
        {
          project: { id: 'proj-1', title: 'Website Redesign' },
          tasks: [{ ...mockTask, id: 'task-6', title: 'Deploy staging', when_date: '2026-02-15' }],
        },
        {
          project: null,
          tasks: [{ ...mockTask, id: 'task-7', title: 'Morning workout', when_date: '2026-02-15' }],
        },
      ],
    },
    {
      title: 'This Evening',
      groups: [
        {
          project: null,
          tasks: [{ ...mockTask, id: 'task-8', title: 'Read a book', when_date: '2026-02-15', first_schedule_time: '19:00' }],
        },
      ],
    },
  ],
  overdue: [{ ...mockTask, id: 'task-9', title: 'Overdue report', deadline: '2026-02-10' }],
  earlier: [],
  completed: [],
}
