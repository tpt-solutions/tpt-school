'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, Check, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  value: string
  label: string
  sublabel?: string
}

type Props = {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  allowClear?: boolean
  clearLabel?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  className,
  disabled,
  allowClear,
  clearLabel = 'None',
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const id = useId()

  const selected = options.find((o) => o.value === value)

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(search.toLowerCase()),
      )
    : options

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', onMouseDown)
      // focus the search input after the dropdown renders
      requestAnimationFrame(() => searchRef.current?.focus())
    }
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function select(val: string) {
    onValueChange(val)
    setOpen(false)
    setSearch('')
  }

  function toggle() {
    if (!disabled) setOpen((o) => !o)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-white px-2.5 py-1 text-sm shadow-sm transition-colors',
          'hover:border-slate-400',
          open && 'border-ring ring-3 ring-ring/50',
          disabled && 'cursor-not-allowed opacity-50',
          !selected && 'text-muted-foreground',
        )}
      >
        <span className="flex-1 truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-border bg-white shadow-lg"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setSearch('') }
                if (e.key === 'Enter' && filtered.length === 1) select(filtered[0].value)
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Options list */}
          <div className="max-h-56 overflow-y-auto p-1">
            {allowClear && !search && (
              <button
                type="button"
                role="option"
                onClick={() => select('')}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-slate-100 transition-colors',
                  !value && 'bg-slate-100',
                )}
              >
                <Check className={cn('h-4 w-4 shrink-0', !value ? 'opacity-100' : 'opacity-0')} />
                {clearLabel}
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => select(opt.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors hover:bg-slate-100',
                    opt.value === value && 'bg-slate-100 font-medium',
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0 text-primary',
                      opt.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <div className="min-w-0">
                    <div className="truncate">{opt.label}</div>
                    {opt.sublabel && (
                      <div className="truncate text-xs text-muted-foreground">{opt.sublabel}</div>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
