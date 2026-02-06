import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTrackingStore } from '@/stores/trackingStore'
import { useGoalsStore } from '@/stores/goalsStore'
import type { Goal } from '@/types'
import {
  CheckCircle2,
  Flame,
  TrendingUp,
  Edit2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressTrackerProps {
  goal: Goal
}

export function ProgressTracker({ goal }: ProgressTrackerProps) {
  const { toggleCheckIn, getCheckInForDate, calculateProgress, getStreakForGoal, getCheckInsForGoal } =
    useTrackingStore()
  const { updateGoal } = useGoalsStore()

  const [showManualDialog, setShowManualDialog] = useState(false)
  const [manualProgress, setManualProgress] = useState(goal.progress.toString())
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const isAutomatic = goal.trackingMode === 'automatic'
  const targetDays = goal.targetDays || 0
  const trackingStartDate = goal.trackingStartDate ? new Date(goal.trackingStartDate) : new Date()

  const checkIns = getCheckInsForGoal(goal.id)
  const completedDays = checkIns.filter((c) => c.completed).length
  const streak = getStreakForGoal(goal.id)

  const progress = isAutomatic && targetDays > 0
    ? calculateProgress(goal.id, targetDays, trackingStartDate)
    : goal.progress

  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: { date: Date; isCurrentMonth: boolean }[] = []

    // Add days from previous month to fill the first week
    const startPadding = firstDay.getDay()
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      days.push({ date, isCurrentMonth: false })
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Add days from next month to complete the grid
    const endPadding = 42 - days.length // 6 rows * 7 days
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return days
  }, [currentMonth])

  const handleDayClick = async (date: Date) => {
    if (!isAutomatic) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const clickedDate = new Date(date)
    clickedDate.setHours(0, 0, 0, 0)

    // Don't allow future dates
    if (clickedDate > today) return

    await toggleCheckIn(goal.id, date)
  }

  const handleManualUpdate = async () => {
    const newProgress = Math.min(100, Math.max(0, parseInt(manualProgress) || 0))
    await updateGoal(goal.id, { progress: newProgress })
    setShowManualDialog(false)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const newMonth = new Date(prev)
      newMonth.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1))
      return newMonth
    })
  }

  const getDayStatus = (date: Date) => {
    const checkIn = getCheckInForDate(goal.id, date)
    return checkIn?.completed ? 'completed' : 'pending'
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Progress Tracking
          </CardTitle>
          {!isAutomatic && (
            <Button variant="ghost" size="sm" onClick={() => setShowManualDialog(true)}>
              <Edit2 className="h-4 w-4 mr-1" />
              Update
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Stats for Automatic Tracking */}
        {isAutomatic && (
          <>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{completedDays}</div>
                <div className="text-xs text-muted-foreground">Days Done</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-orange-500">{targetDays}</div>
                <div className="text-xs text-muted-foreground">Target Days</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-center gap-1">
                  <Flame className="h-5 w-5 text-red-500" />
                  <span className="text-2xl font-bold text-red-500">{streak}</span>
                </div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
            </div>

            {/* Calendar View */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map(({ date, isCurrentMonth }, i) => {
                  const status = getDayStatus(date)
                  const today = isToday(date)
                  const isFuture = date > new Date()

                  return (
                    <button
                      key={i}
                      onClick={() => handleDayClick(date)}
                      disabled={isFuture || !isCurrentMonth}
                      className={cn(
                        'aspect-square flex items-center justify-center rounded-md text-sm transition-all',
                        !isCurrentMonth && 'opacity-30',
                        isCurrentMonth && !isFuture && 'hover:bg-accent cursor-pointer',
                        isFuture && 'opacity-50 cursor-not-allowed',
                        today && 'ring-2 ring-primary',
                        status === 'completed' && isCurrentMonth && 'bg-primary/20'
                      )}
                    >
                      {status === 'completed' && isCurrentMonth ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <span className={cn(today && 'font-bold')}>{date.getDate()}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Manual Progress */}
        {!isAutomatic && (
          <div className="text-center text-muted-foreground text-sm">
            <p>Click "Update" to manually adjust your progress percentage.</p>
          </div>
        )}
      </CardContent>

      {/* Manual Update Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Progress</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={manualProgress}
                onChange={(e) => setManualProgress(e.target.value)}
              />
            </div>
            <Progress value={parseInt(manualProgress) || 0} className="h-3" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualUpdate}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
