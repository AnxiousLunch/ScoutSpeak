import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <Card className="analytics-card">
      <CardHeader>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-72" />
      </CardHeader>
      <CardContent>
        <div className="analytics-grid">
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-3 h-9 w-16" />
            </CardContent>
          </Card>
          <Card className="analytics-wide">
            <CardContent className="p-5">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="mt-3 h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-5/6" />
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  )
}
