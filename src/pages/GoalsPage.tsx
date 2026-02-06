import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Rocket, Flag, Calendar, CheckSquare } from 'lucide-react'
import { useGoalsStore } from '@/stores/goalsStore'
import { useAuthStore } from '@/stores/authStore'
import { GoalFormDialog } from '@/components/goals/GoalFormDialog'
import { GoalCard } from '@/components/goals/GoalCard'
import { cn } from '@/lib/utils'
import type { GoalType, Goal } from '@/types'

const goalTypeConfig: Record<GoalType, { label: string; icon: typeof Rocket; color: string }> = {
  'long-term': { label: 'Long Term', icon: Rocket, color: 'text-purple-500' },
  'mid-term': { label: 'Mid Term', icon: Flag, color: 'text-blue-500' },
  'weekly': { label: 'Weekly', icon: Calendar, color: 'text-green-500' },
  'daily': { label: 'Daily', icon: CheckSquare, color: 'text-orange-500' },
}

export function GoalsPage() {
  const { user } = useAuthStore()
  const { subscribe, unsubscribeFromGoals, getGoalsByType } = useGoalsStore()
  const [activeTab, setActiveTab] = useState<GoalType>('long-term')
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  useEffect(() => {
    if (user) {
      subscribe(user.uid)
    }
    return () => unsubscribeFromGoals()
  }, [user, subscribe, unsubscribeFromGoals])

  const filteredGoals = getGoalsByType(activeTab)
  const { icon: Icon, color } = goalTypeConfig[activeTab]

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
      <Header title="Goals" subtitle="Track your progress" />

      <div className="flex flex-col gap-4 p-4">
        {/* Goal Type Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as GoalType)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="long-term" className="text-xs px-2">
              Long
            </TabsTrigger>
            <TabsTrigger value="mid-term" className="text-xs px-2">
              Mid
            </TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-2">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="daily" className="text-xs px-2">
              Daily
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Add Goal Button */}
        <Button className="w-full" variant="outline" onClick={() => setShowFormDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add {goalTypeConfig[activeTab].label} Goal
        </Button>

        {/* Goals List */}
        <div className="space-y-3">
          {filteredGoals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Icon className={cn('h-12 w-12 mb-4', color)} />
                <p className="text-muted-foreground">
                  No {goalTypeConfig[activeTab].label.toLowerCase()} goals yet
                </p>
                <p className="text-sm text-muted-foreground/70">
                  Create your first goal to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={handleEditGoal}
              />
            ))
          )}
        </div>
      </div>

      {/* Goal Form Dialog */}
      <GoalFormDialog
        open={showFormDialog}
        onOpenChange={handleCloseDialog}
        goal={editingGoal}
        defaultType={activeTab}
      />
    </div>
  )
}
