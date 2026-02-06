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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCategoriesStore } from '@/stores/categoriesStore'
import type { GoalCategory } from '@/types'
import {
  Briefcase,
  User,
  BookOpen,
  Heart,
  Dumbbell,
  Home,
  DollarSign,
  Target,
} from 'lucide-react'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: GoalCategory | null
}

const iconOptions = [
  { value: 'briefcase', label: 'Briefcase', icon: Briefcase },
  { value: 'user', label: 'User', icon: User },
  { value: 'book-open', label: 'Education', icon: BookOpen },
  { value: 'heart', label: 'Health', icon: Heart },
  { value: 'dumbbell', label: 'Fitness', icon: Dumbbell },
  { value: 'home', label: 'Home', icon: Home },
  { value: 'dollar-sign', label: 'Finance', icon: DollarSign },
  { value: 'target', label: 'Target', icon: Target },
]

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#6366f1', label: 'Indigo' },
]

export function CategoryDialog({ open, onOpenChange, category }: CategoryDialogProps) {
  const { addCategory, updateCategory, categories } = useCategoriesStore()

  const [name, setName] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [icon, setIcon] = useState('briefcase')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (category) {
      setName(category.name)
      setColor(category.color)
      setIcon(category.icon)
    } else {
      setName('')
      setColor('#3b82f6')
      setIcon('briefcase')
    }
  }, [category, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      if (category) {
        await updateCategory(category.id, {
          name: name.trim(),
          color,
          icon,
        })
      } else {
        await addCategory({
          name: name.trim(),
          color,
          icon,
          isActive: true,
          order: categories.length,
        })
      }
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to save category:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const SelectedIcon = iconOptions.find((i) => i.value === icon)?.icon || Target

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{category ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <SelectedIcon className="h-4 w-4" />
                    {iconOptions.find((i) => i.value === icon)?.label}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {iconOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === option.value
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: option.value }}
                  onClick={() => setColor(option.value)}
                  title={option.label}
                />
              ))}
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: color + '20' }}
              >
                <SelectedIcon className="h-5 w-5" style={{ color }} />
              </div>
              <span className="font-medium">{name || 'Category Name'}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Saving...' : category ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
