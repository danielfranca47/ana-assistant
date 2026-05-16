export type TaskPriority = 'alta' | 'media' | 'baixa'
export type TaskStatus = 'pending' | 'done' | 'current' | 'late'

export interface Task {
  id: string
  userId: string
  name: string
  time: string | null
  duration: number | null
  priority: TaskPriority
  category: string | null
  status: TaskStatus
  date: string
  createdAt: string
}

export interface CreateTaskInput {
  name: string
  date: string
  time?: string
  duration?: number
  priority?: TaskPriority
  category?: string
  status?: TaskStatus
}

export interface UpdateTaskInput {
  name?: string
  time?: string
  duration?: number
  priority?: TaskPriority
  category?: string
  status?: TaskStatus
}
