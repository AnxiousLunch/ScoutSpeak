import { JoinClient } from './JoinClient'

export const dynamic = 'force-dynamic'

export default function JoinPage({ params }: { params: { token: string } }) {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <JoinClient token={params.token} />
    </div>
  )
}
