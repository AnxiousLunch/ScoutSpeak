import type { Metadata } from 'next';
import './globals.css';
import { AuthNav } from '@/components/AuthNav';
import { WorkspaceFrame } from '@/components/WorkspaceFrame';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: 'ScoutSpeak — Prospecting, with purpose',
  description: 'Find the right leads. Rehearse the conversation. Learn from every outcome.',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <WorkspaceFrame user={user ? { email: user.email } : null} auth={<AuthNav user={user ? { email: user.email } : null} />}>
          {children}
        </WorkspaceFrame>
      </body>
    </html>
  );
}
