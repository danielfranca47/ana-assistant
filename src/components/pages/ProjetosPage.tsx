'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/apiFetch'

interface Activity {
  name:      string
  frequency: string
}

interface Project {
  id:          string
  name:        string
  description: string | null
  priority:    string
  activities:  string
}

interface Objective {
  id:          string
  title:       string
  description: string | null
  horizon:     string
  status:      string
}

const HORIZONS: { key: string; label: string }[] = [
  { key: '1m',  label: 'Próximo mês' },
  { key: '3m',  label: '3 meses' },
  { key: '6m',  label: '6 meses' },
  { key: '1y',  label: '1 ano' },
  { key: '5y',  label: '5 anos' },
]

const PRIORITY_COLORS: Record<string, string> = {
  alta:  '#dc2626',
  media: 'var(--ana-accent)',
  baixa: '#6b7280',
}

const cardStyle: React.CSSProperties = {
  background:   'var(--ana-surface)',
  border:       '0.5px solid var(--ana-border)',
  borderRadius: 'var(--ana-radius)',
  padding:      20,
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily:   'var(--font-cormorant), serif',
  fontSize:     15,
  fontWeight:   600,
  color:        'var(--ana-text)',
  marginBottom: 16,
  display:      'flex',
  alignItems:   'center',
  gap:          7,
}

const inputStyle: React.CSSProperties = {
  background:   'transparent',
  border:       '0.5px solid var(--ana-border)',
  borderRadius: 6,
  padding:      '6px 10px',
  fontSize:     12,
  color:        'var(--ana-text)',
  fontFamily:   'var(--font-dm-sans), sans-serif',
  outline:      'none',
  width:        '100%',
  boxSizing:    'border-box',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding:      '6px 14px',
  background:   'var(--ana-accent)',
  color:        'white',
  border:       'none',
  borderRadius: 6,
  fontSize:     12,
  fontWeight:   500,
  cursor:       'pointer',
  fontFamily:   'var(--font-dm-sans), sans-serif',
  whiteSpace:   'nowrap',
}

const btnGhostStyle: React.CSSProperties = {
  background: 'none',
  border:     'none',
  cursor:     'pointer',
  color:      'var(--ana-muted)',
  padding:    '2px 4px',
  lineHeight: 1,
}

function PriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
  return (
    <span style={{
      fontSize:     10,
      fontWeight:   600,
      padding:      '1px 6px',
      borderRadius: 3,
      border:       `0.5px solid ${PRIORITY_COLORS[priority] ?? 'var(--ana-border)'}`,
      color:        PRIORITY_COLORS[priority] ?? 'var(--ana-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
    }}>
      {labels[priority] ?? priority}
    </span>
  )
}

function ProjectCard({ project, onDelete, onUpdate }: {
  project:  Project
  onDelete: (id: string) => void
  onUpdate: (project: Project) => void
}) {
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [name, setName]           = useState(project.name)
  const [desc, setDesc]           = useState(project.description ?? '')
  const [priority, setPriority]   = useState(project.priority)
  const [activities, setActivities] = useState<Activity[]>(() => {
    try { return JSON.parse(project.activities) } catch { return [] }
  })
  const [saving, setSaving] = useState(false)

  function addActivity() {
    setActivities((prev) => [...prev, { name: '', frequency: '' }])
  }

  function updateActivity(i: number, field: keyof Activity, value: string) {
    setActivities((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  function removeActivity(i: number) {
    setActivities((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const cleanActivities = activities.filter((a) => a.name.trim())
    const res = await apiFetch.patch<Project>(`/api/projects/${project.id}`, {
      name: name.trim(),
      description: desc.trim() || null,
      priority,
      activities: cleanActivities,
    })
    if (res.data) {
      onUpdate(res.data)
      setActivities(cleanActivities)
      setEditing(false)
    }
    setSaving(false)
  }

  const parsedActivities: Activity[] = (() => {
    try { return JSON.parse(project.activities) } catch { return [] }
  })()

  if (editing) {
    return (
      <div style={{ ...cardStyle, padding: 14, marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do projeto"
          />
          <textarea
            style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Descrição (opcional)"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--ana-muted)', flexShrink: 0 }}>Prioridade:</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['alta', 'media', 'baixa'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    ...btnGhostStyle,
                    padding:     '3px 8px',
                    borderRadius: 4,
                    fontSize:    11,
                    border:      `0.5px solid ${priority === p ? PRIORITY_COLORS[p] : 'var(--ana-border)'}`,
                    background:  priority === p ? PRIORITY_COLORS[p] : 'transparent',
                    color:       priority === p ? 'white' : 'var(--ana-muted)',
                    fontFamily:  'var(--font-dm-sans), sans-serif',
                    cursor:      'pointer',
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ana-muted)', marginBottom: 6 }}>Atividades recorrentes:</div>
            {activities.map((act, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 2 }}
                  value={act.name}
                  onChange={(e) => updateActivity(i, 'name', e.target.value)}
                  placeholder="Atividade"
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={act.frequency}
                  onChange={(e) => updateActivity(i, 'frequency', e.target.value)}
                  placeholder="Frequência"
                />
                <button onClick={() => removeActivity(i)} style={btnGhostStyle}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={addActivity}
              style={{ ...btnGhostStyle, fontSize: 12, color: 'var(--ana-accent)', padding: '4px 0' }}
            >
              + Adicionar atividade
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ ...btnGhostStyle, fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--ana-border)', borderRadius: 6, color: 'var(--ana-muted)' }}>
              Cancelar
            </button>
            <button onClick={save} disabled={saving || !name.trim()} style={{ ...btnPrimaryStyle, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ border: '0.5px solid var(--ana-border)', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--ana-surface)' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ ...btnGhostStyle, padding: '2px', color: 'var(--ana-muted)', transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
        <span style={{ fontSize: 13, color: 'var(--ana-text)', fontWeight: 500, flex: 1 }}>{project.name}</span>
        <PriorityBadge priority={project.priority} />
        <button onClick={() => setEditing(true)} style={btnGhostStyle} title="Editar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button onClick={() => onDelete(project.id)} style={btnGhostStyle} title="Apagar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div style={{ padding: '10px 12px 12px', borderTop: '0.5px solid var(--ana-border)', background: 'var(--ana-bg)' }}>
          {project.description && (
            <p style={{ fontSize: 12, color: 'var(--ana-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              {project.description}
            </p>
          )}
          {parsedActivities.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--ana-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Atividades recorrentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {parsedActivities.map((act, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ color: 'var(--ana-text)' }}>{act.name}</span>
                    {act.frequency && (
                      <span style={{ color: 'var(--ana-muted)', fontSize: 11 }}>· {act.frequency}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!project.description && parsedActivities.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--ana-muted)' }}>Sem detalhes. Edite para adicionar.</p>
          )}
        </div>
      )}
    </div>
  )
}

function AddProjectForm({ onAdd }: { onAdd: (p: Project) => void }) {
  const [open, setOpen]         = useState(false)
  const [name, setName]         = useState('')
  const [desc, setDesc]         = useState('')
  const [priority, setPriority] = useState<'alta' | 'media' | 'baixa'>('media')
  const [activities, setActivities] = useState<Activity[]>([])
  const [saving, setSaving]     = useState(false)

  function addActivity() {
    setActivities((prev) => [...prev, { name: '', frequency: '' }])
  }

  function updateActivity(i: number, field: keyof Activity, value: string) {
    setActivities((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  function removeActivity(i: number) {
    setActivities((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const cleanActivities = activities.filter((a) => a.name.trim())
    const res = await apiFetch.post<Project>('/api/projects', {
      name: name.trim(),
      description: desc.trim() || undefined,
      priority,
      activities: cleanActivities,
    })
    if (res.data) {
      onAdd(res.data)
      setName('')
      setDesc('')
      setPriority('media')
      setActivities([])
      setOpen(false)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...btnPrimaryStyle, marginTop: 4, alignSelf: 'flex-start' }}
      >
        + Novo projeto
      </button>
    )
  }

  return (
    <div style={{ ...cardStyle, padding: 14, marginTop: 4 }}>
      <div style={{ fontSize: 12, color: 'var(--ana-text)', fontWeight: 500, marginBottom: 10 }}>Novo projeto</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          style={inputStyle}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do projeto *"
          autoFocus
        />
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Descrição (opcional)"
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ana-muted)', flexShrink: 0 }}>Prioridade:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['alta', 'media', 'baixa'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  ...btnGhostStyle,
                  padding:     '3px 8px',
                  borderRadius: 4,
                  fontSize:    11,
                  border:      `0.5px solid ${priority === p ? PRIORITY_COLORS[p] : 'var(--ana-border)'}`,
                  background:  priority === p ? PRIORITY_COLORS[p] : 'transparent',
                  color:       priority === p ? 'white' : 'var(--ana-muted)',
                  fontFamily:  'var(--font-dm-sans), sans-serif',
                  cursor:      'pointer',
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ana-muted)', marginBottom: 6 }}>Atividades recorrentes:</div>
          {activities.map((act, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                style={{ ...inputStyle, flex: 2 }}
                value={act.name}
                onChange={(e) => updateActivity(i, 'name', e.target.value)}
                placeholder="Atividade"
              />
              <input
                style={{ ...inputStyle, flex: 1 }}
                value={act.frequency}
                onChange={(e) => updateActivity(i, 'frequency', e.target.value)}
                placeholder="Frequência"
              />
              <button onClick={() => removeActivity(i)} style={btnGhostStyle}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          <button
            onClick={addActivity}
            style={{ ...btnGhostStyle, fontSize: 12, color: 'var(--ana-accent)', padding: '4px 0' }}
          >
            + Adicionar atividade
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => setOpen(false)} style={{ ...btnGhostStyle, fontSize: 12, padding: '5px 10px', border: '0.5px solid var(--ana-border)', borderRadius: 6, color: 'var(--ana-muted)' }}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !name.trim()} style={{ ...btnPrimaryStyle, opacity: saving || !name.trim() ? 0.5 : 1 }}>
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ObjectiveRow({ objective, onDelete, onToggle }: {
  objective: Objective
  onDelete:  (id: string) => void
  onToggle:  (id: string, status: string) => void
}) {
  const done = objective.status === 'completed'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '0.5px solid var(--ana-border)' }}>
      <button
        onClick={() => onToggle(objective.id, done ? 'active' : 'completed')}
        style={{ ...btnGhostStyle, marginTop: 1, flexShrink: 0, color: done ? 'var(--ana-accent)' : 'var(--ana-border)' }}
        title={done ? 'Marcar como activo' : 'Marcar como concluído'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={done ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          {done && <polyline points="9 12 11 14 15 10" stroke="white" strokeWidth="2.5" />}
        </svg>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: done ? 'var(--ana-muted)' : 'var(--ana-text)', textDecoration: done ? 'line-through' : 'none', lineHeight: 1.4 }}>
          {objective.title}
        </div>
        {objective.description && (
          <div style={{ fontSize: 11, color: 'var(--ana-muted)', marginTop: 2, lineHeight: 1.4 }}>
            {objective.description}
          </div>
        )}
      </div>
      <button onClick={() => onDelete(objective.id)} style={btnGhostStyle} title="Apagar">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function AddObjectiveInline({ horizon, onAdd }: { horizon: string; onAdd: (o: Objective) => void }) {
  const [title, setTitle]   = useState('')
  const [desc, setDesc]     = useState('')
  const [open, setOpen]     = useState(false)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim()) return
    setSaving(true)
    const res = await apiFetch.post<Objective>('/api/objectives', {
      title: title.trim(),
      description: desc.trim() || undefined,
      horizon,
    })
    if (res.data) {
      onAdd(res.data)
      setTitle('')
      setDesc('')
      setOpen(false)
    }
    setSaving(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...btnGhostStyle, fontSize: 12, color: 'var(--ana-accent)', padding: '6px 0', display: 'block' }}
      >
        + Adicionar objetivo
      </button>
    )
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        style={inputStyle}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Objetivo *"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) save() }}
      />
      <input
        style={inputStyle}
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Detalhes (opcional)"
      />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={() => setOpen(false)} style={{ ...btnGhostStyle, fontSize: 12, padding: '4px 8px', border: '0.5px solid var(--ana-border)', borderRadius: 6, color: 'var(--ana-muted)' }}>
          Cancelar
        </button>
        <button onClick={save} disabled={saving || !title.trim()} style={{ ...btnPrimaryStyle, padding: '4px 10px', opacity: saving || !title.trim() ? 0.5 : 1 }}>
          {saving ? '...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

export default function ProjetosPage() {
  const [projects, setProjects]     = useState<Project[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    Promise.all([
      apiFetch.get<Project[]>('/api/projects'),
      apiFetch.get<Objective[]>('/api/objectives'),
    ]).then(([resP, resO]) => {
      if (resP.data) setProjects(resP.data)
      if (resO.data) setObjectives(resO.data)
    }).finally(() => setCarregando(false))
  }, [])

  async function deleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
    await apiFetch.delete(`/api/projects/${id}`)
  }

  function updateProject(updated: Project) {
    setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p))
  }

  async function deleteObjective(id: string) {
    setObjectives((prev) => prev.filter((o) => o.id !== id))
    await apiFetch.delete(`/api/objectives/${id}`)
  }

  async function toggleObjective(id: string, status: string) {
    setObjectives((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
    await apiFetch.patch(`/api/objectives/${id}`, { status })
  }

  if (carregando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--ana-bg)' }}>
        <span style={{ color: 'var(--ana-muted)', fontSize: 13 }}>A carregar...</span>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto h-full" style={{ background: 'var(--ana-bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Card: Projetos */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Projetos
            </h3>

            {projects.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--ana-muted)', marginBottom: 12 }}>
                Nenhum projeto registado. Adicione abaixo.
              </p>
            )}

            <div>
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  onDelete={deleteProject}
                  onUpdate={updateProject}
                />
              ))}
            </div>

            <AddProjectForm onAdd={(p) => setProjects((prev) => [...prev, p])} />
          </div>

          {/* Card: Objetivos */}
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ana-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
              Objetivos
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {HORIZONS.map((h) => {
                const items = objectives.filter((o) => o.horizon === h.key)
                const active = items.filter((o) => o.status === 'active')
                const done   = items.filter((o) => o.status === 'completed')
                return (
                  <div key={h.key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ana-text)' }}>{h.label}</span>
                      {active.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--ana-muted)' }}>({active.length} activo{active.length !== 1 ? 's' : ''})</span>
                      )}
                    </div>
                    {active.map((o) => (
                      <ObjectiveRow key={o.id} objective={o} onDelete={deleteObjective} onToggle={toggleObjective} />
                    ))}
                    {done.map((o) => (
                      <ObjectiveRow key={o.id} objective={o} onDelete={deleteObjective} onToggle={toggleObjective} />
                    ))}
                    {items.length === 0 && (
                      <p style={{ fontSize: 11, color: 'var(--ana-muted)', marginBottom: 4 }}>Sem objetivos.</p>
                    )}
                    <AddObjectiveInline
                      horizon={h.key}
                      onAdd={(o) => setObjectives((prev) => [...prev, o])}
                    />
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
