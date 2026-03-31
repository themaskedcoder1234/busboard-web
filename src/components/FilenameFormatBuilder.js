'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-browser'

const PARTS = [
  { id: 'reg',      label: 'Registration', example: 'LN66DPU',        always: true },
  { id: 'date',     label: 'Date',         example: '2023-04-05'                   },
  { id: 'location', label: 'Location',     example: 'Oxford-Street-London'         },
  { id: 'company',  label: 'Company',      example: 'Stagecoach'                   },
]

export default function FilenameFormatBuilder({ initialFormat }) {
  const [selected, setSelected] = useState(() => {
    const parts = (initialFormat || 'reg').split('_')
    return PARTS.map(p => ({ ...p, on: parts.includes(p.id) || p.always }))
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const preview = selected
    .filter(p => p.on)
    .map(p => p.example)
    .join('_') + '.jpg'

  const formatString = selected
    .filter(p => p.on)
    .map(p => p.id)
    .join('_')

  function toggle(id) {
    setSelected(prev => prev.map(p =>
      p.id === id && !p.always ? { ...p, on: !p.on } : p
    ))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles')
      .update({ filename_format: formatString })
      .eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Filename format</h2>
        <p className="text-xs text-gray-400">Choose what gets included in each renamed file</p>
      </div>

      {/* Toggle chips */}
      <div className="flex flex-wrap gap-2">
        {selected.map(part => (
          <button
            key={part.id}
            onClick={() => toggle(part.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              ${part.on
                ? 'bg-[#C8102E] text-white border-[#C8102E]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }
              ${part.always ? 'opacity-70 cursor-default' : 'cursor-pointer'}
            `}
          >
            {part.on ? '✓' : '+'} {part.label}
            {part.always && <span className="text-[10px] opacity-70">(required)</span>}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Preview</p>
        <p className="font-mono text-sm text-gray-800 break-all">{preview}</p>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="btn-red text-xs px-4 py-2"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save format'}
        </button>
        <p className="text-xs text-gray-400">
          Applied to all future uploads
        </p>
      </div>
    </div>
  )
}
