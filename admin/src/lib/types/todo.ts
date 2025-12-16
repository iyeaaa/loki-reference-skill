export type Todo = {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: "low" | "medium" | "high"
  dueDate?: string
  workspaceId?: string
  createdAt: string
  updatedAt: string
}

export type CreateTodoRequest = {
  title: string
  description?: string
  priority: "low" | "medium" | "high"
  dueDate?: string
  workspaceId?: string
}

export type UpdateTodoRequest = {
  title?: string
  description?: string
  completed?: boolean
  priority?: "low" | "medium" | "high"
  dueDate?: string
}
