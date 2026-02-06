import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useGoalsStore } from '@/stores/goalsStore'
import { useTodosStore } from '@/stores/todosStore'
import { useAuthStore } from '@/stores/authStore'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalFormDialog } from '@/components/goals/GoalFormDialog'
import { Calendar, Target, Plus } from 'lucide-react'
import type { Goal } from '@/types'

export function WeekPage() {
  const { user } = useAuthStore()
  const { subscribe: subscribeGoals, unsubscribeFromGoals, getGoalsByType } = useGoalsStore()
  const { subscribe: subscribeTodos, unsubscribeFromTodos, todos } = useTodosStore()
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  useEffect(() => {
    if (user) {
      subscribeGoals(user.uid)
      subscribeTodos(user.uid)
    }
    return () => {
      unsubscribeFromGoals()
      unsubscribeFromTodos()
    }
  }, [user, subscribeGoals, subscribeTodos, unsubscribeFromGoals, unsubscribeFromTodos])

  const weeklyGoals = getGoalsByType('weekly')
  const completedWeeklyGoals = weeklyGoals.filter((g) => g.status === 'completed').length

  // Get current week dates
  const today = new Date()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - today.getDay() + 1) // Monday
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6) // Sunday

  // Calculate week's todo stats
  const weekTodos = todos.filter((t) => {
    const todoDate = t.scheduledDate || t.dueDate
    if (!todoDate) return false
    return todoDate >= startOfWeek && todoDate <= endOfWeek
  })
  const completedWeekTodos = weekTodos.filter((t) => t.status === 'completed').length

  const weekRange = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal)
    setShowFormDialog(true)
  }

  const handleCloseDialog = () => {
    setShowFormDialog(false)
    setEditingGoal(null)
  }

  return (
    <div className="flex flex-col">
      <Header title="This Week" subtitle={weekRange} />

      <div className="flex flex-col gap-4 p-4">
        {/* Weekly Overview Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Weekly Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold">{weeklyGoals.length}</span>
                <span className="text-xs text-muted-foreground">Weekly Goals</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold">{weekTodos.length}</span>
                <span className="text-xs text-muted-foreground">Scheduled Tasks</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Goals</span>
                  <span className="text-xs text-muted-foreground">
                    {completedWeeklyGoals}/{weeklyGoals.length}
                  </span>
                </div>
                <Progress
                  value={
                    weeklyGoals.length > 0
                      ? (completedWeeklyGoals / weeklyGoals.length) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Tasks</span>
                  <span className="text-xs text-muted-foreground">
                    {completedWeekTodos}/{weekTodos.length}
                  </span>
                </div>
                <Progress
                  value={
                    weekTodos.length > 0
                      ? (completedWeekTodos / weekTodos.length) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Goals Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              Weekly Goals
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowFormDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>

          {weeklyGoals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Target className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No weekly goals set</p>
                <p className="text-sm text-muted-foreground/70">
                  Create weekly goals to track your progress
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {weeklyGoals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={handleEditGoal} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Goal Form Dialog */}
      <GoalFormDialog
        open={showFormDialog}
        onOpenChange={handleCloseDialog}
        goal={editingGoal}
        defaultType="weekly"
      />
    </div>
  )
}
