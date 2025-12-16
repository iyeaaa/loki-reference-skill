import { Calendar, Check, Edit2, Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CreateTodoRequest, Todo, UpdateTodoRequest } from "@/lib/types/todo"

type TodoListProps = {
  todos: Todo[]
  workspaceId?: string
  onAddTodo: (todo: CreateTodoRequest) => void
  onUpdateTodo: (id: string, updates: UpdateTodoRequest) => void
  onDeleteTodo: (id: string) => void
}

const priorityColors = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
}

export function TodoList({
  todos,
  workspaceId,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
}: TodoListProps) {
  const { t } = useTranslation()

  const priorityLabels = {
    low: t("todo.priority.low"),
    medium: t("todo.priority.medium"),
    high: t("todo.priority.high"),
  }

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [newTodo, setNewTodo] = useState<CreateTodoRequest>({
    title: "",
    description: "",
    priority: "medium",
    workspaceId,
  })

  // Generate unique IDs for form elements
  const titleId = useId()
  const descriptionId = useId()
  const dueDateId = useId()
  const editTitleId = useId()
  const editDescriptionId = useId()
  const editDueDateId = useId()

  const handleAddTodo = () => {
    if (newTodo.title.trim()) {
      onAddTodo(newTodo)
      setNewTodo({
        title: "",
        description: "",
        priority: "medium",
        workspaceId,
      })
      setIsAddDialogOpen(false)
    }
  }

  const handleToggleComplete = (id: string, completed: boolean) => {
    onUpdateTodo(id, { completed })
  }

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo)
  }

  const handleSaveEdit = () => {
    if (editingTodo) {
      onUpdateTodo(editingTodo.id, {
        title: editingTodo.title,
        description: editingTodo.description,
        priority: editingTodo.priority,
        dueDate: editingTodo.dueDate,
      })
      setEditingTodo(null)
    }
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })

  const isOverdue = (dueDate: string) =>
    new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("todo.title")}</CardTitle>
          <Dialog onOpenChange={setIsAddDialogOpen} open={isAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                {t("todo.addTodo")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("todo.addNewTodo")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor={titleId}>{t("todo.titleRequired")}</Label>
                  <Input
                    id={titleId}
                    onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                    placeholder={t("todo.titlePlaceholder")}
                    value={newTodo.title}
                  />
                </div>
                <div>
                  <Label htmlFor={descriptionId}>{t("todo.descriptionLabel")}</Label>
                  <Textarea
                    id={descriptionId}
                    onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                    placeholder={t("todo.descriptionPlaceholder")}
                    rows={3}
                    value={newTodo.description}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">{t("todo.priorityLabel")}</Label>
                    <Select
                      onValueChange={(value: "low" | "medium" | "high") =>
                        setNewTodo({ ...newTodo, priority: value })
                      }
                      value={newTodo.priority}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">{t("todo.priority.low")}</SelectItem>
                        <SelectItem value="medium">{t("todo.priority.medium")}</SelectItem>
                        <SelectItem value="high">{t("todo.priority.high")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={dueDateId}>{t("todo.dueDateLabel")}</Label>
                    <Input
                      id={dueDateId}
                      onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                      type="date"
                      value={newTodo.dueDate || ""}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button onClick={() => setIsAddDialogOpen(false)} variant="outline">
                    {t("todo.cancel")}
                  </Button>
                  <Button onClick={handleAddTodo}>{t("todo.add")}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {todos.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>{t("todo.noTodos")}</p>
              <p className="text-sm">{t("todo.noTodosSubtext")}</p>
            </div>
          ) : (
            todos.map((todo) => (
              <div
                className={`rounded-lg border p-4 ${
                  todo.completed ? "bg-gray-50 opacity-75" : "bg-white"
                }`}
                key={todo.id}
              >
                <div className="flex items-start gap-3">
                  <button
                    className={`mt-1 flex h-5 w-5 items-center justify-center rounded border-2 ${
                      todo.completed
                        ? "border-green-500 bg-green-500 text-white"
                        : "border-gray-300 hover:border-green-500"
                    }`}
                    onClick={() => handleToggleComplete(todo.id, !todo.completed)}
                    type="button"
                  >
                    {todo.completed && <Check className="h-3 w-3" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3
                        className={`font-medium ${
                          todo.completed ? "text-gray-500 line-through" : ""
                        }`}
                      >
                        {todo.title}
                      </h3>
                      <Badge className={`text-xs ${priorityColors[todo.priority]}`}>
                        {priorityLabels[todo.priority]}
                      </Badge>
                      {todo.dueDate && (
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <Calendar className="h-3 w-3" />
                          <span
                            className={
                              isOverdue(todo.dueDate) && !todo.completed
                                ? "font-medium text-red-500"
                                : ""
                            }
                          >
                            {formatDate(todo.dueDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {todo.description && (
                      <p
                        className={`text-gray-600 text-sm ${todo.completed ? "line-through" : ""}`}
                      >
                        {todo.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button onClick={() => handleEditTodo(todo)} size="sm" variant="ghost">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => onDeleteTodo(todo.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* 편집 다이얼로그 */}
      <Dialog onOpenChange={() => setEditingTodo(null)} open={!!editingTodo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("todo.editTodo")}</DialogTitle>
          </DialogHeader>
          {editingTodo && (
            <div className="space-y-4">
              <div>
                <Label htmlFor={editTitleId}>{t("todo.titleRequired")}</Label>
                <Input
                  id={editTitleId}
                  onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                  value={editingTodo.title}
                />
              </div>
              <div>
                <Label htmlFor={editDescriptionId}>{t("todo.descriptionLabel")}</Label>
                <Textarea
                  id={editDescriptionId}
                  onChange={(e) =>
                    setEditingTodo({
                      ...editingTodo,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                  value={editingTodo.description || ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-priority">{t("todo.priorityLabel")}</Label>
                  <Select
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setEditingTodo({ ...editingTodo, priority: value })
                    }
                    value={editingTodo.priority}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("todo.priority.low")}</SelectItem>
                      <SelectItem value="medium">{t("todo.priority.medium")}</SelectItem>
                      <SelectItem value="high">{t("todo.priority.high")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={editDueDateId}>{t("todo.dueDateLabel")}</Label>
                  <Input
                    id={editDueDateId}
                    onChange={(e) =>
                      setEditingTodo({
                        ...editingTodo,
                        dueDate: e.target.value,
                      })
                    }
                    type="date"
                    value={editingTodo.dueDate || ""}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setEditingTodo(null)} variant="outline">
                  {t("todo.cancel")}
                </Button>
                <Button onClick={handleSaveEdit}>{t("todo.save")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
