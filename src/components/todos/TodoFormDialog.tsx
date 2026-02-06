import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTodosStore } from '@/stores/todosStore'
import { useGoalsStore } from '@/stores/goalsStore'
import { useAuthStore } from '@/stores/authStore'
import { useCategoriesStore } from '@/stores/categoriesStore'
import type { Todo, Priority, RecurrencePattern } from '@/types'

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface TodoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  todo?: Todo | null
  defaultGoalId?: string | null
}

const priorities: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const frequencies: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function TodoFormDialog({
  open,
  onOpenChange,
  todo,
  defaultGoalId = null,
}: TodoFormDialogProps) {
  const { user } = useAuthStore()
  const { addTodo, updateTodo } = useTodosStore()
  const { goals } = useGoalsStore()
  const { categories } = useCategoriesStore()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    goalId: defaultGoalId,
    dueDate: '',
    scheduledDate: '',
    categoryId: categories[0]?.id || '',
    isRecurring: false,
    recurrenceFrequency: 'daily' as RecurrenceFrequency,
    recurrenceInterval: '1',
    recurrenceEndDate: '',
  })

  // Reset form when dialog opens/closes or todo changes
  useEffect(() => {
    if (open) {
      if (todo) {
        setFormData({
          title: todo.title,
          description: todo.description,
          priority: todo.priority,
          goalId: todo.goalId,
          dueDate: todo.dueDate ? formatDateForInput(todo.dueDate) : '',
          scheduledDate: todo.scheduledDate ? formatDateForInput(todo.scheduledDate) : '',
          categoryId: todo.categoryId || categories[0]?.id || '',
          isRecurring: todo.isRecurring,
          recurrenceFrequency: todo.recurrencePattern?.frequency || 'daily',
          recurrenceInterval: todo.recurrencePattern?.interval?.toString() || '1',
          recurrenceEndDate: todo.recurrencePattern?.endDate ? formatDateForInput(new Date(todo.recurrencePattern.endDate)) : '',
        })
      } else {
        setFormData({
          title: '',
          description: '',
          priority: 'medium',
          goalId: defaultGoalId,
          dueDate: '',
          scheduledDate: new Date().toISOString().split('T')[0], // Default to today
          categoryId: categories[0]?.id || '',
          isRecurring: false,
          recurrenceFrequency: 'daily',
          recurrenceInterval: '1',
          recurrenceEndDate: '',
        })
      }
    }
  }, [open, todo, defaultGoalId, categories])

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.title.trim()) return

    setIsSubmitting(true)
    try {
      const recurrencePattern: RecurrencePattern | null = formData.isRecurring
        ? {
            frequency: formData.recurrenceFrequency,
            interval: parseInt(formData.recurrenceInterval) || 1,
            endDate: formData.recurrenceEndDate ? new Date(formData.recurrenceEndDate) : null,
          }
        : null

      const todoData = {
        userId: user.uid,
        categoryId: formData.categoryId || categories[0]?.id || 'professional',
        goalId: formData.goalId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: todo?.status ?? 'pending' as const,
        priority: formData.priority,
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        scheduledDate: formData.scheduledDate ? new Date(formData.scheduledDate) : null,
        isRecurring: formData.isRecurring,
        recurrencePattern,
        source: 'manual' as const,
        sourceId: null,
        tags: todo?.tags ?? [],
        completedAt: todo?.completedAt ?? null,
      }

      if (todo) {
        await updateTodo(todo.id, todoData)
      } else {
        await addTodo(todoData)
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save todo:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{todo ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="What needs to be done?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Add details..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: Priority) =>
                setFormData((prev) => ({ ...prev, priority: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {goals.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="goalId">Link to Goal</Label>
              <Select
                value={formData.goalId || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    goalId: value === 'none' ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a goal (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked goal</SelectItem>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      [{g.type}] {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate">Scheduled For</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Category Selection */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.categoryId}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, categoryId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurrence */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    isRecurring: checked === true,
                  }))
                }
              />
              <Label htmlFor="isRecurring" className="text-sm font-medium cursor-pointer">
                Make this a recurring task
              </Label>
            </div>

            {formData.isRecurring && (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="recurrenceFrequency">Repeat</Label>
                    <Select
                      value={formData.recurrenceFrequency}
                      onValueChange={(value: RecurrenceFrequency) =>
                        setFormData((prev) => ({ ...prev, recurrenceFrequency: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recurrenceInterval">Every</Label>
                    <Input
                      id="recurrenceInterval"
                      type="number"
                      min="1"
                      max="365"
                      value={formData.recurrenceInterval}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, recurrenceInterval: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recurrenceEndDate">End Date (Optional)</Label>
                  <Input
                    id="recurrenceEndDate"
                    type="date"
                    value={formData.recurrenceEndDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, recurrenceEndDate: e.target.value }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? 'Saving...' : todo ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
