import { Calendar, Check, Edit2, Plus, Trash2 } from "lucide-react"
import { useId, useState } from "react"
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

interface TodoListProps {
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

const priorityLabels = {
  low: "낮음",
  medium: "보통",
  high: "높음",
}

export function TodoList({
  todos,
  workspaceId,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
}: TodoListProps) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isOverdue = (dueDate: string) => {
    return (
      new Date(dueDate) < new Date() &&
      new Date(dueDate).toDateString() !== new Date().toDateString()
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>세일즈 투두리스트</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />할 일 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 할 일 추가</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor={titleId}>제목 *</Label>
                  <Input
                    id={titleId}
                    value={newTodo.title}
                    onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                    placeholder="할 일을 입력하세요"
                  />
                </div>
                <div>
                  <Label htmlFor={descriptionId}>설명</Label>
                  <Textarea
                    id={descriptionId}
                    value={newTodo.description}
                    onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                    placeholder="상세 설명을 입력하세요"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="priority">우선순위</Label>
                    <Select
                      value={newTodo.priority}
                      onValueChange={(value: "low" | "medium" | "high") =>
                        setNewTodo({ ...newTodo, priority: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">낮음</SelectItem>
                        <SelectItem value="medium">보통</SelectItem>
                        <SelectItem value="high">높음</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={dueDateId}>마감일</Label>
                    <Input
                      id={dueDateId}
                      type="date"
                      value={newTodo.dueDate || ""}
                      onChange={(e) => setNewTodo({ ...newTodo, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleAddTodo}>추가</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {todos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>아직 할 일이 없습니다.</p>
              <p className="text-sm">새 할 일을 추가해보세요!</p>
            </div>
          ) : (
            todos.map((todo) => (
              <div
                key={todo.id}
                className={`p-4 border rounded-lg ${
                  todo.completed ? "bg-gray-50 opacity-75" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleComplete(todo.id, !todo.completed)}
                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center ${
                      todo.completed
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-500"
                    }`}
                  >
                    {todo.completed && <Check className="h-3 w-3" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className={`font-medium ${
                          todo.completed ? "line-through text-gray-500" : ""
                        }`}
                      >
                        {todo.title}
                      </h3>
                      <Badge className={`text-xs ${priorityColors[todo.priority]}`}>
                        {priorityLabels[todo.priority]}
                      </Badge>
                      {todo.dueDate && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="h-3 w-3" />
                          <span
                            className={
                              isOverdue(todo.dueDate) && !todo.completed
                                ? "text-red-500 font-medium"
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
                        className={`text-sm text-gray-600 ${todo.completed ? "line-through" : ""}`}
                      >
                        {todo.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEditTodo(todo)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-700"
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
      <Dialog open={!!editingTodo} onOpenChange={() => setEditingTodo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>할 일 편집</DialogTitle>
          </DialogHeader>
          {editingTodo && (
            <div className="space-y-4">
              <div>
                <Label htmlFor={editTitleId}>제목 *</Label>
                <Input
                  id={editTitleId}
                  value={editingTodo.title}
                  onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={editDescriptionId}>설명</Label>
                <Textarea
                  id={editDescriptionId}
                  value={editingTodo.description || ""}
                  onChange={(e) =>
                    setEditingTodo({
                      ...editingTodo,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-priority">우선순위</Label>
                  <Select
                    value={editingTodo.priority}
                    onValueChange={(value: "low" | "medium" | "high") =>
                      setEditingTodo({ ...editingTodo, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">낮음</SelectItem>
                      <SelectItem value="medium">보통</SelectItem>
                      <SelectItem value="high">높음</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor={editDueDateId}>마감일</Label>
                  <Input
                    id={editDueDateId}
                    type="date"
                    value={editingTodo.dueDate || ""}
                    onChange={(e) =>
                      setEditingTodo({
                        ...editingTodo,
                        dueDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditingTodo(null)}>
                  취소
                </Button>
                <Button onClick={handleSaveEdit}>저장</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
