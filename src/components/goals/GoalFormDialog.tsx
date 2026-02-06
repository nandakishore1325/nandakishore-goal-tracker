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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useGoalsStore } from '@/stores/goalsStore'
import { useAuthStore } from '@/stores/authStore'
import { useCategoriesStore } from '@/stores/categoriesStore'
import type { Goal, GoalType, GoalStatus, Priority, ProgressTrackingMode } from '@/types'

interface GoalFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal?: Goal | null
  defaultType?: GoalType
  parentGoalId?: string | null
}

const goalTypes: { value: GoalType; label: string }[] = [
  { value: 'long-term', label: 'Long Term (1+ year)' },
  { value: 'mid-term', label: 'Mid Term (1-6 months)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'daily', label: 'Daily' },
]

const priorities: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const statuses: { value: GoalStatus; label: string }[] = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
  defaultType = 'long-term',
  parentGoalId = null,
}: GoalFormDialogProps) {
  const { user } = useAuthStore()
  const { addGoal, updateGoal, goals } = useGoalsStore()
  const { categories } = useCategoriesStore()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: defaultType,
    priority: 'medium' as Priority,
    status: 'not-started' as GoalStatus,
    parentGoalId: parentGoalId,
    targetDate: '',
    startDate: '',
    categoryId: categories[0]?.id || '',
    trackingMode: 'manual' as ProgressTrackingMode,
    targetDays: '',
    enableTracking: false,
  })

  // Reset form when dialog opens/closes or goal changes
  useEffect(() => {
    if (open) {
      if (goal) {
        setFormData({
          title: goal.title,
          description: goal.description,
          type: goal.type,
          priority: goal.priority,
          status: goal.status,
          parentGoalId: goal.parentGoalId,
          targetDate: goal.targetDate ? formatDateForInput(goal.targetDate) : '',
          startDate: goal.startDate ? formatDateForInput(goal.startDate) : '',
          categoryId: goal.categoryId || categories[0]?.id || '',
          trackingMode: goal.trackingMode || 'manual',
          targetDays: goal.targetDays?.toString() || '',
          enableTracking: goal.trackingMode === 'automatic',
        })
      } else {
        setFormData({
          title: '',
          description: '',
          type: defaultType,
          priority: 'medium',
          status: 'not-started',
          parentGoalId: parentGoalId,
          targetDate: '',
          startDate: '',
          categoryId: categories[0]?.id || '',
          trackingMode: 'manual',
          targetDays: '',
          enableTracking: false,
        })
      }
    }
  }, [open, goal, defaultType, parentGoalId, categories])

  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !formData.title.trim()) return

    setIsSubmitting(true)
    try {
      const goalData = {
        userId: user.uid,
        categoryId: formData.categoryId || categories[0]?.id || 'professional',
        type: formData.type,
        title: formData.title.trim(),
        description: formData.description.trim(),
        status: formData.status,
        priority: formData.priority,
        progress: goal?.progress ?? 0,
        parentGoalId: formData.parentGoalId,
        startDate: formData.startDate ? new Date(formData.startDate) : null,
        targetDate: formData.targetDate ? new Date(formData.targetDate) : null,
        completedDate: formData.status === 'completed' ? new Date() : null,
        tags: goal?.tags ?? [],
        trackingMode: formData.enableTracking ? 'automatic' as ProgressTrackingMode : 'manual' as ProgressTrackingMode,
        targetDays: formData.enableTracking && formData.targetDays ? parseInt(formData.targetDays) : null,
        trackingStartDate: formData.enableTracking ? (goal?.trackingStartDate || new Date()) : null,
      }

      if (goal) {
        await updateGoal(goal.id, goalData)
      } else {
        await addGoal(goalData)
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save goal:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get potential parent goals (goals of higher level)
  const getParentGoalOptions = () => {
    const typeHierarchy: GoalType[] = ['long-term', 'mid-term', 'weekly', 'daily']
    const currentTypeIndex = typeHierarchy.indexOf(formData.type)

    return goals.filter((g) => {
      const goalTypeIndex = typeHierarchy.indexOf(g.type)
      return goalTypeIndex < currentTypeIndex && g.id !== goal?.id
    })
  }

  const parentGoalOptions = getParentGoalOptions()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? 'Edit Goal' : 'New Goal'}</DialogTitle>
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
              placeholder="Enter goal title"
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
              placeholder="Describe your goal..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: GoalType) =>
                  setFormData((prev) => ({ ...prev, type: value, parentGoalId: null }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {goalTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: GoalStatus) =>
                setFormData((prev) => ({ ...prev, status: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {parentGoalOptions.length > 0 && formData.type !== 'long-term' && (
            <div className="space-y-2">
              <Label htmlFor="parentGoal">Link to Parent Goal</Label>
              <Select
                value={formData.parentGoalId || 'none'}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    parentGoalId: value === 'none' ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent goal (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No parent goal</SelectItem>
                  {parentGoalOptions.map((g) => (
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
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetDate">Target Date</Label>
              <Input
                id="targetDate"
                type="date"
                value={formData.targetDate}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, targetDate: e.target.value }))
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

          {/* Progress Tracking */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enableTracking"
                checked={formData.enableTracking}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({
                    ...prev,
                    enableTracking: checked === true,
                  }))
                }
              />
              <Label htmlFor="enableTracking" className="text-sm font-medium cursor-pointer">
                Enable daily check-in tracking
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Track progress by checking in daily. Perfect for goals like "complete a task for 180 days".
            </p>

            {formData.enableTracking && (
              <div className="space-y-2 mt-2">
                <Label htmlFor="targetDays">Target Days</Label>
                <Input
                  id="targetDays"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.targetDays}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, targetDays: e.target.value }))
                  }
                  placeholder="e.g., 30, 90, 180"
                />
                <p className="text-xs text-muted-foreground">
                  How many days do you want to track? Progress will be calculated automatically.
                </p>
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
              {isSubmitting ? 'Saving...' : goal ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
