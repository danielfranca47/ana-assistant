'use client'

const OPCOES = [
  { value: 'daily',    label: 'Diariamente' },
  { value: 'weekly',   label: 'Semanalmente' },
  { value: 'weekdays', label: 'Dias úteis' },
  { value: 'custom',   label: 'Personalizado' },
]

const DIAS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface RecurrenceFieldsProps {
  recurrence: string       // '' | 'daily' | 'weekly' | 'weekdays' | 'custom'
  recurrenceDays: number[] // [0-6]
  recurrenceEnd: string    // YYYY-MM-DD ou ''
  onChange: (field: 'recurrence' | 'recurrenceDays' | 'recurrenceEnd', value: string | number[]) => void
  compact?: boolean
}

export default function RecurrenceFields({
  recurrence,
  recurrenceDays,
  recurrenceEnd,
  onChange,
  compact = false,
}: RecurrenceFieldsProps) {
  const ativo = recurrence !== ''

  function toggleDia(dow: number) {
    const nova = recurrenceDays.includes(dow)
      ? recurrenceDays.filter(d => d !== dow)
      : [...recurrenceDays, dow].sort((a, b) => a - b)
    onChange('recurrenceDays', nova)
  }

  const inputClass = compact
    ? 'w-full text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400'
    : 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500'

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {/* Toggle Repetir */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange('recurrence', ativo ? '' : 'daily')}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            ativo ? 'bg-gray-700' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={ativo}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
              ativo ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
        <span className={compact ? 'text-xs text-gray-600' : 'text-sm text-gray-700'}>
          Repetir
        </span>
      </div>

      {ativo && (
        <>
          {/* Opções de padrão */}
          <div className={`flex flex-wrap gap-1 ${compact ? '' : 'gap-1.5'}`}>
            {OPCOES.map(op => (
              <button
                key={op.value}
                type="button"
                onClick={() => onChange('recurrence', op.value)}
                className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  recurrence === op.value
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {op.label}
              </button>
            ))}
          </div>

          {/* Seletor de dias — apenas para 'custom' */}
          {recurrence === 'custom' && (
            <div className="flex gap-1">
              {DIAS_LABEL.map((label, dow) => (
                <button
                  key={dow}
                  type="button"
                  onClick={() => toggleDia(dow)}
                  className={`flex-1 rounded border py-0.5 text-xs transition-colors ${
                    recurrenceDays.includes(dow)
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Data de fim */}
          <div className="flex items-center gap-2">
            <span className={compact ? 'text-xs text-gray-500 shrink-0' : 'text-sm text-gray-500 shrink-0'}>
              Até:
            </span>
            <input
              type="date"
              value={recurrenceEnd}
              onChange={e => onChange('recurrenceEnd', e.target.value)}
              className={inputClass}
            />
          </div>
        </>
      )}
    </div>
  )
}
