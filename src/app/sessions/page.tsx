import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Sessions — ScoutSpeak',
}

export default function SessionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
      <Card>
        <CardHeader>
          <CardTitle>No sessions yet</CardTitle>
          <CardDescription>
            Review saved voice and typed conversations with prospects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Transcripts and outcomes will be listed here after you run a conversation.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
