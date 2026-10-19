'use client'

import { useEffect, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export function notify(message: string, kind: ToastKind = 'success') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('scoutspeak:toast', { detail: { message, kind } }))
}

export function ToastViewport() {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; id: number } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; kind?: ToastKind }>).detail
      if (!detail?.message) return
      clearTimeout(timer)
      setToast({ message: detail.message, kind: detail.kind || 'info', id: Date.now() })
      timer = setTimeout(() => setToast(null), 3800)
    }
    window.addEventListener('scoutspeak:toast', receive)
    return () => { clearTimeout(timer); window.removeEventListener('scoutspeak:toast', receive) }
  }, [])
  if (!toast) return null
  return <div key={toast.id} className={`toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}><span className="toast-mark">{toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}</span><span>{toast.message}</span><button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>
}
