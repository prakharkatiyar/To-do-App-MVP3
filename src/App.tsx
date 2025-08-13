import React, { useEffect, useMemo, useRef, useState } from 'react'

type Task = {
  id: string
  title: string
  notes?: string
  due?: string // ISO
  completed: boolean
  notified?: boolean
  createdAt: string
}

const STORAGE_KEY = 'todo_mvp_tasks_v1'

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: Task[] = JSON.parse(raw)
    return parsed.map(t => ({ ...t }))
  } catch {
    return []
  }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isToday(d?: Date) {
  if (!d) return false
  const now = new Date()
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
}

function fmtDateTime(iso?: string) {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  return d.toLocaleString()
}

async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission !== 'denied') {
    try {
      const p = await Notification.requestPermission()
      return p
    } catch {
      return 'denied'
    }
  }
  return Notification.permission
}

function notifyTask(task: Task) {
  if (!('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false
  try {
    const n = new Notification(`Reminder: ${task.title}`, {
      body: task.notes || 'Tap to open and mark complete',
      tag: task.id,
      requireInteraction: true,
    })
    n.onclick = () => window.focus()
    return true
  } catch {
    return false
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks())
  const [tab, setTab] = useState<'today' | 'all'>('today')
  const [filter, setFilter] = useState<'pending' | 'completed' | 'all'>('pending')
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => saveTasks(tasks), [tasks])

  // Scheduler: check every 30s for due tasks and fire notifications
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      setTasks(prev => {
        let changed = false
        const next = prev.map(t => {
          if (!t.due || t.completed || t.notified) return t
          const dueTs = new Date(t.due).getTime()
          if (dueTs <= now) {
            const sent = notifyTask(t)
            if (sent) {
              changed = true
              return { ...t, notified: true }
            }
          }
          return t
        })
        return changed ? next : prev
      })
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const todayList = useMemo(
    () => tasks.filter(t => isToday(t.due ? new Date(t.due) : undefined)),
    [tasks]
  )

  const visible = useMemo(() => {
    let list = tab === 'today' ? todayList : tasks
    if (filter === 'pending') list = list.filter(t => !t.completed)
    if (filter === 'completed') list = list.filter(t => t.completed)
    if (query.trim()) list = list.filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
    list = [...list].sort((a, b) => {
      if (!a.due && !b.due) return 0
      if (!a.due) return 1
      if (!b.due) return -1
      return new Date(a.due).getTime() - new Date(b.due).getTime()
    })
    return list
  }, [tasks, todayList, tab, filter, query])

  function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const title = ((fd.get('title') as string) || '').trim()
    const notes = ((fd.get('notes') as string) || '').trim()
    const dueStr = ((fd.get('due') as string) || '').trim()
    if (!title) return
    const dueISO = dueStr ? new Date(dueStr).toISOString() : undefined
    const item: Task = {
      id: uid(),
      title,
      notes: notes || undefined,
      due: dueISO,
      completed: false,
      notified: false,
      createdAt: new Date().toISOString(),
    }
    setTasks(prev => [item, ...prev])
    e.currentTarget.reset()
    titleRef.current?.focus()
  }

  function toggleComplete(id: string) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function startEdit(id: string) {
    setEditingId(id)
  }

  function saveEdit(id: string, updates: Partial<Task>) {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)))
    setEditingId(null)
  }

  function resetAll() {
    if (confirm('This will remove ALL tasks. Continue?')) setTasks([])
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function requestNotif() {
    const p = await ensureNotificationPermission()
    if (p !== 'granted') alert("Notifications not enabled. We'll still keep reminders in-app.")
  }

  const TaskRow: React.FC<{ t: Task }> = ({ t }) => {
    const isOverdue = t.due ? new Date(t.due).getTime() < Date.now() && !t.completed : false
    const duePretty = fmtDateTime(t.due)
    return (
      <div className="flex items-start justify-between gap-3 rounded-2xl border p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-gray-300"
            checked={t.completed}
            onChange={() => toggleComplete(t.id)}
            aria-label={`Mark ${t.title} as completed`}
          />
          <div>
            <div className={`font-medium ${t.completed ? 'line-through text-gray-400' : ''}`}>{t.title}</div>
            {t.notes && <div className="text-sm text-gray-600 whitespace-pre-wrap">{t.notes}</div>}
            <div className={`mt-1 text-xs ${isOverdue ? 'font-semibold' : ''}`}>
              Due: {duePretty} {isOverdue && <span className="rounded bg-red-100 px-2 py-0.5 text-red-700">Overdue</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => startEdit(t.id)} aria-label="Edit task">Edit</button>
          <button className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50" onClick={() => removeTask(t.id)} aria-label="Delete task">Delete</button>
        </div>
      </div>
    )
  }

  const EditInline: React.FC<{ t: Task }> = ({ t }) => {
    const [title, setTitle] = useState(t.title)
    const [notes, setNotes] = useState(t.notes || '')
    const [due, setDue] = useState<Date | undefined>(t.due ? new Date(t.due) : undefined)

    function toLocalInputValue(d?: Date) {
      if (!d) return ''
      const pad = (n: number) => String(n).padStart(2, '0')
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const mi = pad(d.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    }

    function onSave() {
      const dueISO = due ? new Date(due).toISOString() : undefined
      saveEdit(t.id, { title: title.trim() || t.title, notes: notes.trim() || undefined, due: dueISO, notified: false })
    }

    return (
      <div className="rounded-2xl border p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm">Title</label>
            <input className="mt-1 w-full rounded-xl border p-2" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm">Notes</label>
            <textarea className="mt-1 w-full rounded-xl border p-2" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Due (date & time)</label>
            <input type="datetime-local" className="mt-1 w-full rounded-xl border p-2" value={toLocalInputValue(due)} onChange={e => setDue(e.target.value ? new Date(e.target.value) : undefined)} />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={onSave}>Save</button>
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={() => setEditingId(null)}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">To‑Do Reminder (MVP)</h1>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={requestNotif}>Enable Notifications</button>
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={exportJSON}>Export JSON</button>
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-50" onClick={resetAll}>Reset All</button>
        </div>
      </header>

      <section className="mb-6 rounded-2xl border p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add Task</h2>
        <form onSubmit={addTask} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-sm">Title *</label>
            <input ref={titleRef} name="title" required className="mt-1 w-full rounded-xl border p-2" placeholder="e.g., Pay electricity bill" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm">Notes</label>
            <textarea name="notes" rows={3} className="mt-1 w-full rounded-xl border p-2" placeholder="Optional details" />
          </div>
          <div>
            <label className="text-sm">Due (date & time)</label>
            <input type="datetime-local" name="due" className="mt-1 w-full rounded-xl border p-2" />
          </div>
          <div className="flex items-end">
            <button className="w-full rounded-xl border px-3 py-2 font-medium hover:bg-gray-50">Save</button>
          </div>
        </form>
      </section>

      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-2xl border p-1">
          <button className={`rounded-2xl px-3 py-1.5 text-sm ${tab === 'today' ? 'bg-gray-100' : ''}`} onClick={() => setTab('today')}>Today</button>
          <button className={`rounded-2xl px-3 py-1.5 text-sm ${tab === 'all' ? 'bg-gray-100' : ''}`} onClick={() => setTab('all')}>All</button>
        </div>

        <div className="flex gap-1 rounded-2xl border p-1">
          {(['pending','completed','all'] as const).map(f => (
            <button key={f} className={`rounded-2xl px-3 py-1.5 text-sm ${filter === f ? 'bg-gray-100' : ''}`} onClick={() => setFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</button>
          ))}
        </div>

        <input className="rounded-2xl border px-3 py-2" placeholder="Search by title…" value={query} onChange={e => setQuery(e.target.value)} />
      </section>

      {visible.length === 0 && (
        <div className="rounded-2xl border p-8 text-center text-gray-600">
          {tasks.length === 0 ? <p>Add your first task above. Title and due time are enough.</p> : <p>No tasks match the current view.</p>}
        </div>
      )}

      <div className="grid gap-3">
        {visible.map(t => (
          <div key={t.id}>{editingId === t.id ? <EditInline t={t} /> : <TaskRow t={t} />}</div>
        ))}
      </div>

      <footer className="mt-8 text-center text-xs text-gray-500">
        <p>Reminders trigger locally in the browser. For best reliability, keep the app open or install it as a PWA (Add to Home Screen). If notifications are blocked, reminders stay in‑app.</p>
      </footer>
    </div>
  )
}
