'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { navItemsFor, type NavItem } from './nav-items'

/**
 * Ctrl+K (Cmd+K on Mac) command palette. Lists the pages the signed-in role can open
 * and filters them as you type. Arrow keys move the selection, Enter opens, Escape closes.
 */
export default function CommandPalette({ role }: { role: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!open) return null
  return <PaletteDialog items={navItemsFor(role)} onClose={() => setOpen(false)} />
}

function PaletteDialog({ items, onClose }: { items: NavItem[]; onClose: () => void }) {
  // Mounted fresh on every open, so the query and selection always start clean.
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(item => item.label.toLowerCase().includes(q) || item.href.toLowerCase().includes(q))
  }, [items, query])

  function go(href: string) {
    onClose()
    router.push(href)
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(i => (results.length === 0 ? 0 : (i + 1) % results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(i => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const choice = results[active]
      if (choice) go(choice.href)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[15vh]"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onInputKey}
            placeholder="Go to a page…"
            aria-label="Search pages"
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `cmd-${results[active].href}` : undefined}
            className="h-12 w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-block rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-400">Esc</kbd>
        </div>
        <ul id="command-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-slate-500">No pages match “{query}”.</li>
          )}
          {results.map((item, i) => {
            const Icon = item.icon
            const selected = i === active
            return (
              <li
                key={item.href}
                id={`cmd-${item.href}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  selected ? 'bg-primary text-primary-foreground' : 'text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                <span className={`text-xs ${selected ? 'opacity-80' : 'text-slate-400'}`}>{item.href}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
