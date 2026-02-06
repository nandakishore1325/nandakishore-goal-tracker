import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  MoreVertical,
  Edit,
  Trash2,
  ChevronRight,
  Link as LinkIcon,
  TrendingUp,
  Flame,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useGoalsStore } from '@/stores/goalsStore'
import { useTrackingStore } from '@/stores/trackingStore'
import { ProgressTracker } from './ProgressTracker'
import { cn } from '@/lib/utils'
import type { Goal, GoalStatus, Priority } from '@/types'

interface GoalCardProps {
  goal: Goal
  onEdit: (goal: Goal) => void
  onClick?: (goal: Goal) => void
  showType?: boolean
  showTracking?: boolean
}

const statusColors: Record<GoalStatus, string> = {
  'not-started': 'bg-gray-500',
  'in-progress': 'bg-blue-500',
  'completed': 'bg-green-500',
  'on-hold': 'bg-yellow-500',
  'cancelled': 'bg-red-500',
}

const priorityColors: Record<Priority, string> = {
  urgent: 'text-red-600 bg-red-100',
  high: 'text-orange-600 bg-orange-100',
  medium: 'text-yellow-600 bg-yellow-100',
  low: 'text-green-600 bg-green-100',
}

export function GoalCard({ goal, onEdit, onClick, showType = false, showTracking = true }: GoalCardProps) {
  const { deleteGoal, getGoalById, getChildGoals } = useGoalsStore()
  const { getStreakForGoal, getCheckInsForGoal } = useTrackingStore()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showTrackingDialog, setShowTrackingDialog] = useState(false)

  const parentGoal = goal.parentGoalId ? getGoalById(goal.parentGoalId) : null
  const childGoals = getChildGoals(goal.id)
  const isAutoTracking = goal.trackingMode === 'automatic' && goal.targetDays
  const streak = isAutoTracking ? getStreakForGoal(goal.id) : 0
  const checkIns = isAutoTracking ? getCheckInsForGoal(goal.id) : []
  const completedDays = checkIns.filter(c => c.completed).length

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteGoal(goal.id)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Failed to delete goal:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Card
        className={cn(
          'transition-colors relative',
          onClick && 'cursor-pointer hover:bg-muted/50'
        )}
        onClick={() => onClick?.(goal)}
      >
        <CardContent className="py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Status indicator and title */}
              <div className="flex items-center gap-2 mb-1">
                <div className={cn('h-2 w-2 rounded-full shrink-0', statusColors[goal.status])} />
                <span className="font-medium truncate">{goal.title}</span>
              </div>

              {/* Description */}
              {goal.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {goal.description}
                </p>
              )}

              {/* Parent goal link */}
              {parentGoal && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate">Linked to: {parentGoal.title}</span>
                </div>
              )}

              {/* Badges row */}
              <div className="flex items-center flex-wrap gap-2 mt-2">
                {showType && (
                  <Badge variant="outline" className="text-xs">
                    {goal.type.replace('-', ' ')}
                  </Badge>
                )}
                <Badge className={cn('text-xs', priorityColors[goal.priority])}>
                  {goal.priority}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {goal.status.replace('-', ' ')}
                </Badge>
                {isAutoTracking && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {completedDays}/{goal.targetDays} days
                  </Badge>
                )}
                {isAutoTracking && streak > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-orange-500">
                    <Flame className="h-3 w-3" />
                    {streak} streak
                  </Badge>
                )}
                {goal.targetDate && (
                  <span className="text-xs text-muted-foreground">
                    Due {new Date(goal.targetDate).toLocaleDateString()}
                  </span>
                )}
                {childGoals.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {childGoals.length} sub-goal{childGoals.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(!showMenu)
                  }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                      }}
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-md shadow-md py-1 min-w-[140px]">
                      {showTracking && (
                        <button
                          className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowMenu(false)
                            setShowTrackingDialog(true)
                          }}
                        >
                          <TrendingUp className="h-4 w-4" />
                          View Progress
                        </button>
                      )}
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowMenu(false)
                          onEdit(goal)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
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

              {onClick && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Progress</span>
              <span className="text-xs font-medium">{goal.progress}%</span>
            </div>
            <Progress value={goal.progress} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Goal</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{goal.title}"? This action cannot be undone.
              {childGoals.length > 0 && (
                <span className="block mt-2 text-destructive">
                  Warning: This goal has {childGoals.length} linked sub-goal(s) that will be unlinked.
                </span>
              )}
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

      {/* Progress Tracking Dialog */}
      <Dialog open={showTrackingDialog} onOpenChange={setShowTrackingDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{goal.title}</DialogTitle>
            <DialogDescription>
              Track your progress and check in daily
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <ProgressTracker goal={goal} />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTrackingDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
