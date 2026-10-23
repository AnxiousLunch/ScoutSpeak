'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ToastViewport } from '@/components/ToastViewport'

type User = { email?: string } | null

const groups = [
  { label: 'WORKSPACE', items: [{ href: '/', label: 'Overview', icon: '◫' }, { href: '/leads', label: 'Leads', icon: '◎' }, { href: '/campaigns', label: 'Campaigns', icon: '↗' }, { href: '/sessions', label: 'Conversations', icon: '◌' }] },
  { label: 'SETTINGS', items: [{ href: '/profile', label: 'Business profile', icon: '⌂' }] },
]

export function WorkspaceFrame({ children, user, auth }: { children: React.ReactNode; user: User; auth: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname === '/login' || pathname === '/signup' || pathname.startsWith('/mfa')

  if (!user || isAuth) {
    return <><header className="public-header"><Link href="/" className="brand"><span className="brand-mark">S</span> scoutspeak</Link><div>{auth}</div></header><main className="public-main">{children}</main><ToastViewport /></>
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/" className="brand"><span className="brand-mark">S</span><span>scoutspeak</span></Link>
        <div className="workspace-switch"><span className="workspace-avatar">{(user.email || 'S')[0].toUpperCase()}</span><span className="workspace-label"><b>My workspace</b><small>Personal account</small></span><span className="switch-chevron">⌄</span></div>
        <nav className="side-nav" aria-label="Main navigation">
          {groups.map((group) => <section key={group.label} className="nav-group"><p>{group.label}</p>{group.items.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return <Link key={item.href} href={item.href} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}><span className="nav-icon">{item.icon}</span>{item.label}{item.href === '/leads' && <span className="nav-arrow">›</span>}</Link>
          })}</section>)}
          <section className="nav-group"><p>DEVELOPER</p><Link href="/dev/ai" className={`nav-link ${pathname.startsWith('/dev') ? 'active' : ''}`}><span className="nav-icon">⌘</span>Diagnostics</Link></section>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-spark">✳</span><b>Good conversations start with good context.</b><span>Build your profile to give every brief a stronger foundation.</span><Link href="/profile">Review profile <span>↗</span></Link></div><div className="account-row"><span className="account-avatar">{(user.email || 'U')[0].toUpperCase()}</span><span className="account-email" title={user.email}>{user.email}</span>{auth}</div></div>
      </aside>
      <div className="mobile-topbar"><Link href="/" className="brand"><span className="brand-mark">S</span> scoutspeak</Link><div>{auth}</div></div>
      <main className="main-panel"><div className="page-content">{children}</div></main><ToastViewport />
    </div>
  )
}
