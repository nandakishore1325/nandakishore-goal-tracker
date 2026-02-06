import { NavLink } from 'react-router-dom'
import {
  Calendar,
  Target,
  Inbox,
  Settings,
  CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useInboxStore } from '@/stores/inboxStore'

const navItems = [
  { to: '/', icon: CheckSquare, label: 'Today' },
  { to: '/week', icon: Calendar, label: 'Week' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/inbox', icon: Inbox, label: 'Inbox', showBadge: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  const inboxCount = useInboxStore((state) => state.getPendingCount())

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-bottom">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )
            }
          >
            <div className="relative">
              <Icon className="h-5 w-5" />
              {showBadge && inboxCount > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </div>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
