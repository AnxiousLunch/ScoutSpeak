import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Dashboard — ScoutSpeak',
}

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Welcome to ScoutSpeak</CardTitle>
          <CardDescription>
            Your prospecting workspace is empty. Leads, sessions, and insights
            will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use the counter at <a href="/count" className="underline">/count</a> to verify the Supabase connection, or visit{' '}
            <a href="/dev/ai" className="underline">/dev/ai</a> to test the AI adapter.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
