'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  {
    label: 'Rotina do Dia',
    href: '/rotina',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" />
        <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" />
        <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    label: 'Calendário',
    href: '/calendario',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Semana',
    href: '/semana',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="4" height="18" rx="1" />
        <rect x="10" y="3" width="4" height="18" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Falar com Ana',
    href: '/',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'Relatório',
    href: '/relatorio',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    label: 'Projetos',
    href: '/projetos',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    label: 'Preferências',
    href: '/metas',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
]

function formatarDataHoje(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--ana-bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--ana-surface)',
        borderBottom: '0.5px solid var(--ana-border)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            position: 'relative',
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--ana-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            A
            <span style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: '#4CAF50',
              border: '2px solid white',
            }} />
          </div>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--ana-text)',
              lineHeight: 1,
            }}>
              Ana
            </h1>
            <p style={{ fontSize: 11, color: 'var(--ana-muted)', marginTop: 2, fontWeight: 300 }}>
              Assistente Pessoal · Online
            </p>
          </div>
        </div>
        <span style={{ fontSize: 13, color: 'var(--ana-muted)', fontWeight: 400 }}>
          {formatarDataHoje()}
        </span>
      </header>

      {/* Nav tabs */}
      <nav style={{
        display: 'flex',
        gap: 0,
        background: 'var(--ana-bg)',
        borderBottom: '0.5px solid var(--ana-border)',
        padding: '0 24px',
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 16px 11px',
                fontSize: 13,
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--ana-accent)' : 'var(--ana-muted)',
                borderBottom: `2px solid ${active ? 'var(--ana-accent)' : 'transparent'}`,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
