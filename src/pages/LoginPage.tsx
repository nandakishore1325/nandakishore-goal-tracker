import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { Target } from 'lucide-react'

export function LoginPage() {
  const { signInWithGoogle, isLoading, error } = useAuthStore()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary mb-4">
            <Target className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Goal Tracker</h1>
          <p className="text-muted-foreground text-center mt-2">
            Your professional goal tracking dashboard
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to start tracking your goals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={signInWithGoogle}
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </span>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By signing in, you agree to our Terms of Service and Privacy Policy
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl mb-1">📊</div>
            <p className="text-sm font-medium">Track Goals</p>
            <p className="text-xs text-muted-foreground">Long to daily</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl mb-1">📥</div>
            <p className="text-sm font-medium">Smart Inbox</p>
            <p className="text-xs text-muted-foreground">Review & convert</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl mb-1">🔗</div>
            <p className="text-sm font-medium">Integrations</p>
            <p className="text-xs text-muted-foreground">Slack, Gmail, Cal</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-2xl mb-1">📱</div>
            <p className="text-sm font-medium">Mobile First</p>
            <p className="text-xs text-muted-foreground">Install as app</p>
          </div>
        </div>
      </div>
    </div>
  )
}
