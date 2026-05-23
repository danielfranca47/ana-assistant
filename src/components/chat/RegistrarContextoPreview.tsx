'use client'

import { useState } from 'react'

type Prioridade = 'alta' | 'media' | 'baixa'
type Horizonte = '1m' | '3m' | '6m' | '1y' | '5y'

interface Atividade { name: string; frequency?: string }
interface ProjetoItem { name: string; description?: string; priority: Prioridade; activities?: Atividade[] }
interface ObjetivoItem { title: string; description?: string; horizon: Horizonte }

export interface PreviewInput {
  projetos?: ProjetoItem[]
  objetivos?: ObjetivoItem[]
}

interface Props {
  input: PreviewInput
  onConfirm: (input: Record<string, unknown>) => void
  onCancel: () => void
  executando: boolean
}

const HORIZON_LABEL: Record<Horizonte, string> = {
  '1m': 'Próximo mês', '3m': '3 meses', '6m': '6 meses', '1y': '1 ano', '5y': '5 anos',
}
const PRIORITY_BG: Record<Prioridade, string> = { alta: '#fee2e2', media: '#fef3c7', baixa: '#dcfce7' }
const PRIORITY_COLOR: Record<Prioridade, string> = { alta: '#dc2626', media: '#d97706', baixa: '#16a34a' }
const PRIORITY_LABEL: Record<Prioridade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

const inputCss: React.CSSProperties = {
  width: '100%', padding: '5px 8px', fontSize: 12,
  border: '1px solid var(--ana-border)', borderRadius: 6,
  background: 'white', fontFamily: 'var(--font-dm-sans), sans-serif',
  boxSizing: 'border-box',
}
const cancelBtnCss: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6,
  border: '1px solid var(--ana-border)', background: 'transparent',
  cursor: 'pointer', fontSize: 11, color: '#666',
}
const saveBtnCss: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: '#16a34a', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600,
}
function iconBtn(bg: string, color: string): React.CSSProperties {
  return {
    width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', border: 'none', borderRadius: 4,
    background: bg, color, cursor: 'pointer', fontSize: 11, padding: 0,
  }
}

// ---- Projeto card (modo leitura) ----
function ProjetoCard({ item, onEdit, onRemove }: { item: ProjetoItem; onEdit: () => void; onRemove: () => void }) {
  return (
    <div style={{
      border: '1px solid var(--ana-border)', borderRadius: 8, padding: '9px 12px',
      marginBottom: 5, background: 'var(--ana-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ana-text)' }}>{item.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20,
              background: PRIORITY_BG[item.priority], color: PRIORITY_COLOR[item.priority],
            }}>
              {PRIORITY_LABEL[item.priority]}
            </span>
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{item.description}</div>
          )}
          {item.activities && item.activities.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {item.activities.map((a, i) => (
                <span key={i} style={{ fontSize: 10, background: '#f3f4f6', color: '#555', padding: '1px 6px', borderRadius: 4 }}>
                  {a.name}{a.frequency ? ` (${a.frequency})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onEdit} title="Editar" style={iconBtn('#f3f4f6', '#374151')}>✏</button>
          <button onClick={onRemove} title="Remover" style={iconBtn('#fee2e2', '#dc2626')}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ---- Projeto card (modo edição) ----
function ProjetoEditForm({ item, onSave, onCancel }: { item: ProjetoItem; onSave: (n: ProjetoItem) => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [priority, setPriority] = useState<Prioridade>(item.priority)
  const [activities, setActivities] = useState<Atividade[]>(item.activities ?? [])

  return (
    <div style={{
      border: '1px solid #16a34a', borderRadius: 8, padding: '10px 12px',
      marginBottom: 5, background: 'var(--ana-bg)',
    }}>
      <div style={{ marginBottom: 5 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do projeto" style={inputCss} />
      </div>
      <div style={{ marginBottom: 5 }}>
        <select value={priority} onChange={e => setPriority(e.target.value as Prioridade)} style={inputCss}>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>
      </div>
      <div style={{ marginBottom: 5 }}>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Descrição (opcional)" rows={2}
          style={{ ...inputCss, resize: 'vertical' }}
        />
      </div>
      {activities.length > 0 && (
        <div style={{ marginBottom: 5 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>Atividades:</div>
          {activities.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
              <span style={{ fontSize: 12, flex: 1, color: 'var(--ana-text)' }}>
                {a.name}{a.frequency ? ` (${a.frequency})` : ''}
              </span>
              <button
                onClick={() => setActivities(acts => acts.filter((_, idx) => idx !== i))}
                style={iconBtn('#fee2e2', '#dc2626')}
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtnCss}>Cancelar</button>
        <button
          onClick={() => onSave({ name: name.trim() || item.name, description: description || undefined, priority, activities })}
          style={saveBtnCss}
        >Guardar</button>
      </div>
    </div>
  )
}

// ---- Objetivo card (modo leitura) ----
function ObjetivoCard({ item, onEdit, onRemove }: { item: ObjetivoItem; onEdit: () => void; onRemove: () => void }) {
  return (
    <div style={{
      border: '1px solid var(--ana-border)', borderRadius: 8, padding: '9px 12px',
      marginBottom: 5, background: 'var(--ana-bg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ana-text)' }}>{item.title}</span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: '#e0f2fe', color: '#0369a1' }}>
              {HORIZON_LABEL[item.horizon]}
            </span>
          </div>
          {item.description && (
            <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{item.description}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <button onClick={onEdit} title="Editar" style={iconBtn('#f3f4f6', '#374151')}>✏</button>
          <button onClick={onRemove} title="Remover" style={iconBtn('#fee2e2', '#dc2626')}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ---- Objetivo card (modo edição) ----
function ObjetivoEditForm({ item, onSave, onCancel }: { item: ObjetivoItem; onSave: (n: ObjetivoItem) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description ?? '')
  const [horizon, setHorizon] = useState<Horizonte>(item.horizon)

  return (
    <div style={{
      border: '1px solid #16a34a', borderRadius: 8, padding: '10px 12px',
      marginBottom: 5, background: 'var(--ana-bg)',
    }}>
      <div style={{ marginBottom: 5 }}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título do objetivo" style={inputCss} />
      </div>
      <div style={{ marginBottom: 5 }}>
        <select value={horizon} onChange={e => setHorizon(e.target.value as Horizonte)} style={inputCss}>
          <option value="1m">Próximo mês</option>
          <option value="3m">3 meses</option>
          <option value="6m">6 meses</option>
          <option value="1y">1 ano</option>
          <option value="5y">5 anos</option>
        </select>
      </div>
      <div style={{ marginBottom: 5 }}>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Descrição (opcional)" rows={2}
          style={{ ...inputCss, resize: 'vertical' }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={cancelBtnCss}>Cancelar</button>
        <button
          onClick={() => onSave({ title: title.trim() || item.title, description: description || undefined, horizon })}
          style={saveBtnCss}
        >Guardar</button>
      </div>
    </div>
  )
}

// ---- Componente principal ----
export default function RegistrarContextoPreview({ input, onConfirm, onCancel, executando }: Props) {
  const [projetos, setProjetos] = useState<ProjetoItem[]>(input.projetos ?? [])
  const [objetivos, setObjetivos] = useState<ObjetivoItem[]>(input.objetivos ?? [])
  const [editandoProjeto, setEditandoProjeto] = useState<number | null>(null)
  const [editandoObjetivo, setEditandoObjetivo] = useState<number | null>(null)

  const total = projetos.length + objetivos.length

  function removerProjeto(i: number) {
    setProjetos(p => p.filter((_, idx) => idx !== i))
    if (editandoProjeto === i) setEditandoProjeto(null)
  }

  function removerObjetivo(i: number) {
    setObjetivos(o => o.filter((_, idx) => idx !== i))
    if (editandoObjetivo === i) setEditandoObjetivo(null)
  }

  return (
    <div style={{
      border: '1px solid var(--ana-border)', borderRadius: 12,
      background: 'var(--ana-surface)', padding: 14, maxWidth: 500,
      fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 13,
    }}>
      <div style={{ marginBottom: 10, fontWeight: 600, color: 'var(--ana-text)', fontSize: 13 }}>
        Pré-visualização — {total} item{total !== 1 ? 's' : ''} a registar
      </div>

      {projetos.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            Projetos ({projetos.length})
          </div>
          {projetos.map((p, i) =>
            editandoProjeto === i ? (
              <ProjetoEditForm
                key={i} item={p}
                onSave={novo => { setProjetos(ps => ps.map((x, idx) => idx === i ? novo : x)); setEditandoProjeto(null) }}
                onCancel={() => setEditandoProjeto(null)}
              />
            ) : (
              <ProjetoCard key={i} item={p} onEdit={() => setEditandoProjeto(i)} onRemove={() => removerProjeto(i)} />
            )
          )}
        </div>
      )}

      {objetivos.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            Objetivos ({objetivos.length})
          </div>
          {objetivos.map((o, i) =>
            editandoObjetivo === i ? (
              <ObjetivoEditForm
                key={i} item={o}
                onSave={novo => { setObjetivos(os => os.map((x, idx) => idx === i ? novo : x)); setEditandoObjetivo(null) }}
                onCancel={() => setEditandoObjetivo(null)}
              />
            ) : (
              <ObjetivoCard key={i} item={o} onEdit={() => setEditandoObjetivo(i)} onRemove={() => removerObjetivo(i)} />
            )
          )}
        </div>
      )}

      {total === 0 && (
        <div style={{ color: '#aaa', fontSize: 12, marginBottom: 10 }}>
          Todos os itens foram removidos.
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
        <button
          onClick={onCancel}
          disabled={executando}
          style={{
            padding: '6px 14px', borderRadius: 20, border: '1px solid var(--ana-border)',
            background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#666',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm({ projetos, objetivos })}
          disabled={executando || total === 0}
          style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            background: total === 0 ? '#ccc' : '#16a34a', color: 'white',
            cursor: total === 0 || executando ? 'not-allowed' : 'pointer',
            fontSize: 12, fontWeight: 600, opacity: executando ? 0.7 : 1,
          }}
        >
          {executando ? 'A guardar...' : `Confirmar (${total})`}
        </button>
      </div>
    </div>
  )
}
