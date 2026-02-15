import type {
  Task,
  TaskDetail,
  Project,
  ProjectDetail,
  Area,
  Tag,
  InboxView,
  TodayView,
} from '../../api/types'

export const mockTask: Task = {
  id: 'task-1',
  title: 'Buy groceries',
  notes: '',
  status: 'open',
  when_date: null,
  when_evening: false,
  deadline: null,
  project_id: null,
  area_id: null,
  heading_id: null,
  sort_order_today: 1024,
  sort_order_project: 1024,
  sort_order_heading: 1024,
  completed_at: null,
  canceled_at: null,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
  tags: [],
  checklist_count: 0,
  checklist_done: 0,
  has_notes: false,
  has_attachments: false,
  has_repeat_rule: false,
}

export const mockTaskWithTags: Task = {
  ...mockTask,
  id: 'task-2',
  title: 'Review PR',
  tags: [{ id: 'tag-1', title: 'work' }],
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
}

export const mockArea: Area = {
  id: 'area-1',
  title: 'Work',
  sort_order: 1024,
  project_count: 2,
  task_count: 5,
  created_at: '2026-01-01 00:00:00',
  updated_at: '2026-01-01 00:00:00',
}

export const mockTag: Tag = {
  id: 'tag-1',
  title: 'urgent',
  parent_tag_id: null,
  sort_order: 1024,
  task_count: 3,
}

export const mockInboxView: InboxView = {
  tasks: [mockTask, { ...mockTask, id: 'task-5', title: 'Clean kitchen' }],
}

export const mockEmptyInboxView: InboxView = {
  tasks: [],
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
          tasks: [{ ...mockTask, id: 'task-8', title: 'Read a book', when_date: '2026-02-15', when_evening: true }],
        },
      ],
    },
  ],
  overdue: [{ ...mockTask, id: 'task-9', title: 'Overdue report', deadline: '2026-02-10' }],
}
