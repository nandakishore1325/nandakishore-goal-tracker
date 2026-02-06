import { useCallback } from 'react'
import { useGoalsStore } from '@/stores/goalsStore'
import { useTodosStore } from '@/stores/todosStore'

export function useGoalProgress() {
  const { goals, updateGoal } = useGoalsStore()
  const { todos } = useTodosStore()

  const calculateProgress = useCallback(
    (goalId: string): number => {
      const goal = goals.find((g) => g.id === goalId)
      if (!goal) return 0

      // Get child goals
      const childGoals = goals.filter((g) => g.parentGoalId === goalId)

      // Get linked todos
      const linkedTodos = todos.filter((t) => t.goalId === goalId)

      // If has child goals, calculate based on child goals
      if (childGoals.length > 0) {
        const childProgressSum = childGoals.reduce((sum, child) => {
          // Recursively calculate child progress
          return sum + calculateProgress(child.id)
        }, 0)
        return Math.round(childProgressSum / childGoals.length)
      }

      // If has linked todos, calculate based on todos
      if (linkedTodos.length > 0) {
        const completedTodos = linkedTodos.filter((t) => t.status === 'completed').length
        return Math.round((completedTodos / linkedTodos.length) * 100)
      }

      // If goal is completed, return 100
      if (goal.status === 'completed') return 100
      if (goal.status === 'not-started') return 0
      if (goal.status === 'cancelled') return 0

      // Default to manual progress
      return goal.progress
    },
    [goals, todos]
  )

  const updateGoalProgress = useCallback(
    async (goalId: string) => {
      const newProgress = calculateProgress(goalId)
      const goal = goals.find((g) => g.id === goalId)

      if (goal && goal.progress !== newProgress) {
        await updateGoal(goalId, { progress: newProgress })

        // Also update parent goal if exists
        if (goal.parentGoalId) {
          await updateGoalProgress(goal.parentGoalId)
        }
      }
    },
    [calculateProgress, goals, updateGoal]
  )

  const updateAllProgress = useCallback(async () => {
    // Start from leaf goals (daily, then weekly, then mid-term, then long-term)
    const typeOrder = ['daily', 'weekly', 'mid-term', 'long-term']

    for (const type of typeOrder) {
      const goalsOfType = goals.filter((g) => g.type === type)
      for (const goal of goalsOfType) {
        await updateGoalProgress(goal.id)
      }
    }
  }, [goals, updateGoalProgress])

  return {
    calculateProgress,
    updateGoalProgress,
    updateAllProgress,
  }
}
