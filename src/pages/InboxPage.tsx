import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Inbox,
  Mail,
  MessageSquare,
  Calendar,
  X,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import { useInboxStore } from '@/stores/inboxStore'
import { useGoalsStore } from '@/stores/goalsStore'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { InboxSource, InboxItem, Priority } from '@/types'

const sourceConfig: Record<InboxSource, { icon: typeof Mail; color: string; label: string }> = {
  email: { icon: Mail, color: 'text-red-500', label: 'Email' },
  slack: { icon: MessageSquare, color: 'text-purple-500', label: 'Slack' },
  calendar: { icon: Calendar, color: 'text-blue-500', label: 'Calendar' },
}

const priorities: { value: Priority; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function InboxPage() {
  const { user } = useAuthStore()
  const {
    subscribe,
    unsubscribeFromInbox,
    getPendingItems,
    getCountBySource,
    selectedSource,
    setSourceFilter,
    dismissItem,
    convertToTodo,
  } = useInboxStore()
  const { goals, subscribe: subscribeGoals, unsubscribeFromGoals } = useGoalsStore()

  const [convertDialogOpen, setConvertDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [convertFormData, setConvertFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    goalId: null as string | null,
    scheduledDate: '',
    dueDate: '',
  })

  useEffect(() => {
    if (user) {
      subscribe(user.uid)
      subscribeGoals(user.uid)
    }
    return () => {
      unsubscribeFromInbox()
      unsubscribeFromGoals()
    }
  }, [user, subscribe, subscribeGoals, unsubscribeFromInbox, unsubscribeFromGoals])

  const pendingItems = getPendingItems()
  const countBySource = getCountBySource()
  const totalCount = Object.values(countBySource).reduce((a, b) => a + b, 0)

  const handleConvertClick = (item: InboxItem) => {
    setSelectedItem(item)
    setConvertFormData({
      title: item.title,
      description: item.description,
      priority: 'medium',
      goalId: null,
      scheduledDate: new Date().toISOString().split('T')[0],
      dueDate: '',
    })
    setConvertDialogOpen(true)
  }

  const handleConvert = async () => {
    if (!selectedItem || !user) return

    setIsConverting(true)
    try {
      await convertToTodo(selectedItem.id, {
        userId: user.uid,
        categoryId: 'professional',
        goalId: convertFormData.goalId,
        title: convertFormData.title,
        description: convertFormData.description,
        status: 'pending',
        priority: convertFormData.priority,
        dueDate: convertFormData.dueDate ? new Date(convertFormData.dueDate) : null,
        scheduledDate: convertFormData.scheduledDate ? new Date(convertFormData.scheduledDate) : null,
        isRecurring: false,
        recurrencePattern: null,
        tags: [],
        completedAt: null,
      })
      setConvertDialogOpen(false)
      setSelectedItem(null)
    } catch (error) {
      console.error('Failed to convert to todo:', error)
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Inbox"
        subtitle={`${totalCount} items to review`}
      />

      <div className="flex flex-col gap-4 p-4">
        {/* Source Filter Tabs */}
        <Tabs
          value={selectedSource}
          onValueChange={(v) => setSourceFilter(v as InboxSource | 'all')}
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all" className="text-xs">
              All ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              {countBySource.email}
            </TabsTrigger>
            <TabsTrigger value="slack" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              {countBySource.slack}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              {countBySource.calendar}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Inbox Items */}
        <div className="space-y-3">
          {pendingItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Your inbox is empty</p>
                <p className="text-sm text-muted-foreground/70">
                  Items from Slack, Email, and Calendar will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            pendingItems.map((item) => {
              const { icon: SourceIcon, color, label } = sourceConfig[item.source]
              return (
                <Card key={item.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0',
                          color
                        )}
                      >
                        <SourceIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                          {item.sourceSender && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.sourceSender}
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium line-clamp-1">{item.title}</h3>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {item.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>
                            {new Date(item.sourceDate).toLocaleDateString()}
                          </span>
                          {item.sourceChannel && <span>#{item.sourceChannel}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => dismissItem(item.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Dismiss
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => handleConvertClick(item)}>
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Add to Todo
                      </Button>
                      {item.sourceUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(item.sourceUrl!, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Convert to Todo Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Todo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={convertFormData.title}
                onChange={(e) =>
                  setConvertFormData((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={convertFormData.description}
                onChange={(e) =>
                  setConvertFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={convertFormData.priority}
                onValueChange={(value: Priority) =>
                  setConvertFormData((prev) => ({ ...prev, priority: value }))
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
                  value={convertFormData.goalId || 'none'}
                  onValueChange={(value) =>
                    setConvertFormData((prev) => ({
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
                  value={convertFormData.scheduledDate}
                  onChange={(e) =>
                    setConvertFormData((prev) => ({ ...prev, scheduledDate: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={convertFormData.dueDate}
                  onChange={(e) =>
                    setConvertFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={isConverting}
            >
              Cancel
            </Button>
            <Button onClick={handleConvert} disabled={isConverting || !convertFormData.title.trim()}>
              {isConverting ? 'Adding...' : 'Add to Todo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
