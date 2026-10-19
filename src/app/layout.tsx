import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { AuthNav } from '@/components/AuthNav';
import { createClient } from '@/utils/supabase/server';

export const metadata: Metadata = {
  title: 'ScoutSpeak',
  description: 'AI-assisted prospecting workspace.',
};

const nav = [
  { href: '/profile', label: 'Profile' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/leads', label: 'Leads' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/dev/voice', label: 'Voice' },
  { href: '/dev/ai', label: 'AI ping' },
];

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <header className="border-b bg-card px-4 py-3 shadow-sm">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight">
                ScoutSpeak
              </Link>
              <ul className="flex items-center gap-4 text-sm">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <AuthNav user={user ? { email: user.email } : null} />
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </body>
    </html>
  );
}
