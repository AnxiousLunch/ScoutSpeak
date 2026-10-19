import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const metadata = {
  title: 'Leads — ScoutSpeak',
}

export default function LeadsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
      <Card>
        <CardHeader>
          <CardTitle>No leads yet</CardTitle>
          <CardDescription>
            Import leads from a CSV or add company URLs to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Lead enrichment, scoring, and outreach suggestions will appear here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
