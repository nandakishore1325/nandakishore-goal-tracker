import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { MoreVertical, Edit, Trash2, Link as LinkIcon, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useTodosStore } from '@/stores/todosStore'
import { useGoalsStore } from '@/stores/goalsStore'
import { cn } from '@/lib/utils'
import type { Todo, Priority } from '@/types'

interface TodoCardProps {
  todo: Todo
  onEdit: (todo: Todo) => void
}

const priorityColors: Record<Priority, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const priorityLabels: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export function TodoCard({ todo, onEdit }: TodoCardProps) {
  const { deleteTodo, toggleTodoStatus } = useTodosStore()
  const { getGoalById } = useGoalsStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const linkedGoal = todo.goalId ? getGoalById(todo.goalId) : null

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteTodo(todo.id)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete todo:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return null
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <Card
        className={cn(
          'transition-opacity',
          todo.status === 'completed' && 'opacity-60'
        )}
      >
        <CardContent className="flex items-start gap-3 py-3">
          <Checkbox
            checked={todo.status === 'completed'}
            onCheckedChange={() => toggleTodoStatus(todo.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    'font-medium block',
                    todo.status === 'completed' && 'line-through text-muted-foreground'
                  )}
                >
                  {todo.title}
                </span>
                {todo.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                    {todo.description}
                  </p>
                )}
              </div>

              {/* Menu button */}
              <div className="relative shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setShowMenu(!showMenu)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-md shadow-md py-1 min-w-[120px]">
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                        onClick={() => {
                          setShowMenu(false)
                          onEdit(todo)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                        onClick={() => {
                          setShowMenu(false)
                          setShowDeleteDialog(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Meta info */}
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <div className="flex items-center gap-1">
                <div className={cn('h-2 w-2 rounded-full', priorityColors[todo.priority])} />
                <span className="text-xs text-muted-foreground">
                  {priorityLabels[todo.priority]}
                </span>
              </div>

              {todo.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Due {formatDate(todo.dueDate)}</span>
                </div>
              )}

              {linkedGoal && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <LinkIcon className="h-3 w-3" />
                  {linkedGoal.title}
                </Badge>
              )}

              {todo.source !== 'manual' && (
                <Badge variant="outline" className="text-xs">
                  From {todo.source}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{todo.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
