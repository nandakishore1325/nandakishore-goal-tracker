import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Plus, Circle } from 'lucide-react'
import { useTodosStore } from '@/stores/todosStore'
import { useGoalsStore } from '@/stores/goalsStore'
import { useAuthStore } from '@/stores/authStore'
import { TodoCard } from '@/components/todos/TodoCard'
import { TodoFormDialog } from '@/components/todos/TodoFormDialog'
import type { Todo } from '@/types'

export function TodayPage() {
  const { user } = useAuthStore()
  const { subscribe: subscribeTodos, unsubscribeFromTodos, getTodayTodos } = useTodosStore()
  const { subscribe: subscribeGoals, unsubscribeFromGoals } = useGoalsStore()
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)

  useEffect(() => {
    if (user) {
      subscribeTodos(user.uid)
      subscribeGoals(user.uid)
    }
    return () => {
      unsubscribeFromTodos()
      unsubscribeFromGoals()
    }
  }, [user, subscribeTodos, subscribeGoals, unsubscribeFromTodos, unsubscribeFromGoals])

  const todayTodos = getTodayTodos()
  const pendingCount = todayTodos.filter((t) => t.status !== 'completed').length
  const completedCount = todayTodos.filter((t) => t.status === 'completed').length
  const totalCount = todayTodos.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const today = new Date()
  const formattedDate = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo)
    setShowFormDialog(true)
  }

  const handleCloseDialog = () => {
    setShowFormDialog(false)
    setEditingTodo(null)
  }

  return (
    <div className="flex flex-col">
      <Header title="Today" subtitle={formattedDate} />

      <div className="flex flex-col gap-4 p-4">
        {/* Progress Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Daily Progress</span>
              <span className="text-sm text-muted-foreground">
                {completedCount}/{totalCount} tasks
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>{pendingCount} pending</span>
              <span>{completedCount} completed</span>
            </div>
          </CardContent>
        </Card>

        {/* Add Task Button */}
        <Button className="w-full" variant="outline" onClick={() => setShowFormDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>

        {/* Tasks List */}
        <div className="space-y-2">
          {todayTodos.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Circle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No tasks for today</p>
                <p className="text-sm text-muted-foreground/70">
                  Add a task to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            todayTodos.map((todo) => (
              <TodoCard key={todo.id} todo={todo} onEdit={handleEditTodo} />
            ))
          )}
        </div>
      </div>

      {/* Todo Form Dialog */}
      <TodoFormDialog
        open={showFormDialog}
        onOpenChange={handleCloseDialog}
        todo={editingTodo}
      />
    </div>
  )
}
