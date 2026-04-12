'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const ALBUM_FORMATS = [
  { id: 'date',     label: 'Date taken',    example: 'Tuesday, 12 October 2021' },
  { id: 'operator', label: 'Operator name', example: 'Stagecoach' },
  { id: 'location', label: 'Location',      example: 'Oxford' },
  { id: 'custom',   label: 'Custom name',   example: 'My bus photos' },
]

const TITLE_FORMATS = [
  { id: 'reg',          label: 'Registration only',    example: 'LN66DPU' },
  { id: 'reg_operator', label: 'Reg + Operator',       example: 'LN66DPU — Stagecoach' },
  { id: 'reg_date',     label: 'Reg + Date',           example: 'LN66DPU — 12 Oct 2021' },
]

const DESC_FORMATS = [
  { id: 'full',    label: 'Full details', example: 'Reg, date, location, GPS' },
  { id: 'basic',   label: 'Basic',        example: 'Reg and date only' },
  { id: 'minimal', label: 'Minimal',      example: 'Registration only' },
]

export default function FlickrSettings({ initialSettings }) {
  const [autoUpload,       setAutoUpload]       = useState(initialSettings?.flickr_auto_upload        || false)
  const [albumFormat,      setAlbumFormat]      = useState(initialSettings?.flickr_album_format       || 'date')
  const [albumCustomName,  setAlbumCustomName]  = useState(initialSettings?.flickr_album_custom_name  || '')
  const [titleFormat,      setTitleFormat]      = useState(initialSettings?.flickr_title_format       || 'reg')
  const [descFormat,       setDescFormat]       = useState(initialSettings?.flickr_description_format || 'full')
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      flickr_auto_upload:          autoUpload,
      flickr_album_format:         albumFormat,
      flickr_album_custom_name:    albumCustomName,
      flickr_title_format:         titleFormat,
      flickr_description_format:   descFormat,
    }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-0.5">Flickr settings</h2>
        <p className="text-xs text-gray-400">Customise how photos are uploaded to your Flickr account</p>
      </div>

      {/* Auto upload toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Auto-upload to Flickr</p>
          <p className="text-xs text-gray-400">Automatically upload when processing completes</p>
        </div>
        <button
          onClick={() => setAutoUpload(!autoUpload)}
          className={`relative w-10 h-6 rounded-full transition-colors ${autoUpload ? 'bg-[#C8102E]' : 'bg-gray-200'}`}>
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoUpload ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Album format */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Album naming</p>
        <div className="space-y-1.5">
          {ALBUM_FORMATS.map(f => (
            <label key={f.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
              ${albumFormat === f.id ? 'border-[#C8102E] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="album" value={f.id} checked={albumFormat === f.id}
                onChange={() => setAlbumFormat(f.id)} className="accent-[#C8102E]" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{f.label}</p>
                {f.id !== 'custom' && <p className="text-xs text-gray-400 font-mono">{f.example}</p>}
                {f.id === 'custom' && albumFormat === 'custom' && (
                  <input
                    type="text"
                    value={albumCustomName}
                    onChange={e => setAlbumCustomName(e.target.value)}
                    onClick={e => e.preventDefault()}
                    placeholder="e.g. My bus photos"
                    className="mt-1.5 w-full text-xs px-2 py-1.5 rounded border border-gray-300 focus:outline-none focus:border-[#C8102E] bg-white text-gray-700"
                  />
                )}
                {f.id === 'custom' && albumFormat !== 'custom' && (
                  <p className="text-xs text-gray-400 font-mono">{f.example}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Title format */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photo title</p>
        <div className="space-y-1.5">
          {TITLE_FORMATS.map(f => (
            <label key={f.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
              ${titleFormat === f.id ? 'border-[#C8102E] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="title" value={f.id} checked={titleFormat === f.id}
                onChange={() => setTitleFormat(f.id)} className="accent-[#C8102E]" />
              <div>
                <p className="text-sm font-medium text-gray-700">{f.label}</p>
                <p className="text-xs text-gray-400 font-mono">{f.example}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Description format */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photo description</p>
        <div className="space-y-1.5">
          {DESC_FORMATS.map(f => (
            <label key={f.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all
              ${descFormat === f.id ? 'border-[#C8102E] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="desc" value={f.id} checked={descFormat === f.id}
                onChange={() => setDescFormat(f.id)} className="accent-[#C8102E]" />
              <div>
                <p className="text-sm font-medium text-gray-700">{f.label}</p>
                <p className="text-xs text-gray-400">{f.example}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="btn-red text-xs px-4 py-2">
        {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Flickr settings'}
      </button>
    </div>
  )
}
