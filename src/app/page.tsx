import Link from 'next/link'

export const metadata = {
  title: 'ScoutSpeak',
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">ScoutSpeak</h1>
        <p className="text-sm text-muted-foreground max-w-prose">
          Find the right leads, rehearse realistic conversations with an AI sales
          representative, and learn from every outcome.
        </p>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          Get started:
        </p>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/profile" className="text-primary underline-offset-4 hover:underline">
              1. Define your business profile
            </Link>
          </li>
          <li>
            <Link href="/campaigns" className="text-primary underline-offset-4 hover:underline">
              2. Create a campaign
            </Link>
          </li>
          <li>
            <Link href="/leads" className="text-primary underline-offset-4 hover:underline">
              3. Import or add leads
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
