"use client"

import * as React from "react"
import { Bookmark, ChevronDown, Share2, Trash2, Users } from "lucide-react"

import { cn } from "@/lib/ui/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/components/ui/toast"

/**
 * Saved views (bookmarks): one control that snapshots EVERYTHING the screen
 * is showing - filters, columns, expansion, sorting - and recalls it from a
 * dropdown. Tag chips derived from the state describe each bookmark even
 * when its name does not (the Qlik/Power BI bookmark idiom).
 *
 * A bookmark belongs to the user who saved it: personal unless shared with
 * everyone (2026-10-14). The list shows "My views" then "Shared views" with
 * the owner's name; sharing and deleting are the owner's (or an
 * administrator's).
 *
 *   <BookmarkMenu page="reports" store={store} capture={() => state} apply={(s) => ...}
 *                 tags={() => ["Income Statement", "FY2024", "4 companies"]} />
 *
 * Storage is the host's: `store` reads, saves, shares and removes bookmarks
 * (Consol wired these to /api/bookmarks). A rejected promise surfaces its
 * message in a toast, exactly as a failed request did.
 */

export interface SavedBookmark {
  id: number
  name: string
  state: Record<string, unknown>
  tags: string[]
  created_at: string
  shared: boolean
  owner_user_id: number | null
  owner_name: string | null
  mine: boolean | null
}

/** Where bookmarks live. Every method rejects with an Error to report a failure. */
export interface BookmarkStore {
  /** The page's bookmarks, and whether this user may edit everyone's. */
  list: (page: string) => Promise<{ bookmarks: SavedBookmark[]; admin: boolean }>
  save: (input: { page: string; name: string; state: Record<string, unknown>; tags: string[]; shared: boolean }) => Promise<void>
  remove: (bookmark: SavedBookmark) => Promise<void>
  share: (bookmark: SavedBookmark, shared: boolean) => Promise<void>
  /** Records a recall (most-used ordering); failures are ignored. */
  use?: (bookmark: SavedBookmark) => Promise<void>
}

export function BookmarkMenu({
  page,
  store,
  capture,
  apply,
  tags,
  className,
}: {
  page: string
  /** Where the bookmarks are read from and written to. */
  store: BookmarkStore
  /** Snapshot the screen's current selections. Must be JSON-serializable. */
  capture: () => Record<string, unknown>
  /** Restore a snapshot onto the screen. */
  apply: (state: Record<string, unknown>) => void
  /** Human-readable chips describing the CURRENT selections (used at save). */
  tags: () => string[]
  className?: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [list, setList] = React.useState<SavedBookmark[] | null>(null)
  const [admin, setAdmin] = React.useState(false)
  const [name, setName] = React.useState("")
  const [share, setShare] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(() => {
    store
      .list(page)
      .then((d) => { setList(d.bookmarks); setAdmin(!!d.admin) })
      .catch(() => setList([]))
  }, [page, store])

  React.useEffect(() => {
    if (open && list === null) load()
  }, [open, list, load])

  async function save() {
    const n = name.trim()
    if (!n) return
    setSaving(true)
    try {
      await store.save({ page, name: n, state: capture(), tags: tags(), shared: share })
      setName("")
      setList(null)
      load()
      toast(share ? `Saved "${n}" for everyone` : `Saved "${n}"`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the bookmark")
    } finally {
      setSaving(false)
    }
  }

  async function remove(b: SavedBookmark) {
    setList((l) => (l ? l.filter((x) => x.id !== b.id) : l))
    try {
      await store.remove(b)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove the bookmark")
      load()
    }
  }

  async function setShared(b: SavedBookmark, shared: boolean) {
    setList((l) => (l ? l.map((x) => (x.id === b.id ? { ...x, shared } : x)) : l))
    try {
      await store.share(b, shared)
      toast(shared ? `"${b.name}" is shared with everyone` : `"${b.name}" is yours only`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not change the sharing")
      load()
    }
  }

  function recall(b: SavedBookmark) {
    apply(b.state)
    setOpen(false)
    store.use?.(b).catch(() => {})
  }

  const canEdit = (b: SavedBookmark) => !!b.mine || admin
  const mine = (list ?? []).filter((b) => b.mine)
  const shared = (list ?? []).filter((b) => !b.mine)

  const row = (b: SavedBookmark) => (
    <div key={b.id} className="group flex items-start gap-2 border-b border-gray-50 px-2.5 py-2 last:border-0 hover:bg-gray-50">
      <button type="button" onClick={() => recall(b)} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium text-gray-800">{b.name}</span>
          {b.shared && <Users className="size-3 shrink-0 text-gray-400" aria-label="Shared with everyone" />}
        </div>
        {(b.tags.length > 0 || (!b.mine && b.owner_name)) && (
          <div className="mt-1 flex flex-wrap gap-1">
            {!b.mine && b.owner_name && (
              <span className="rounded bg-sky-50 px-1.5 py-px text-[11px] text-sky-700">{b.owner_name}</span>
            )}
            {b.tags.map((t, i) => (
              <span key={i} className="rounded bg-gray-100 px-1.5 py-px text-[11px] text-gray-500">{t}</span>
            ))}
          </div>
        )}
      </button>
      {canEdit(b) && (
        <>
          <button
            type="button"
            onClick={() => setShared(b, !b.shared)}
            className={cn("mt-0.5 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100", b.shared ? "text-sky-500 hover:text-gray-500" : "text-gray-300 hover:text-sky-600")}
            aria-label={b.shared ? `Stop sharing ${b.name}` : `Share ${b.name} with everyone`}
          >
            <Share2 className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => remove(b)}
            className="mt-0.5 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
            aria-label={`Delete ${b.name}`}
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none",
          className
        )}
      >
        <Bookmark className="size-3.5 text-gray-400" />
        Bookmarks
        <ChevronDown className="size-3.5 text-gray-400" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b border-gray-100 p-2.5">
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save() }}
              placeholder="Name this view"
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
              {saving ? <Spinner className="size-3.5" /> : "Save view"}
            </Button>
          </div>
          <label className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>Share with everyone</span>
            <Switch checked={share} onCheckedChange={setShare} aria-label="Share with everyone" />
          </label>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {list === null ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-gray-400"><Spinner className="size-3.5" /> Loading</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-xs text-gray-400">
              No saved views yet. Set up the report the way you want it, name it above and save - it comes back exactly as it is now.
            </div>
          ) : (
            <>
              {mine.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">My views</p>}
              {mine.map(row)}
              {shared.length > 0 && <p className="px-2.5 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Shared views</p>}
              {shared.map(row)}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
