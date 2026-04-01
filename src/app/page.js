import Link from 'next/link'

// ── Destination Blind component ───────────────────────────────────────────────
function DestinationBlind({ route, text, sub }) {
  return (
    <div className="inline-flex items-stretch rounded-lg overflow-hidden border-2 border-[#1A1A1A] shadow-sm">
      <div className="bg-[#F5C518] text-[#1A1A1A] font-black text-sm px-3 flex items-center font-mono tracking-wider border-r-2 border-[#1A1A1A]">
        {route}
      </div>
      <div className="bg-[#1A1A1A] px-4 py-1.5">
        <div className="text-[#F5F0E8] font-bold text-sm tracking-widest uppercase">{text}</div>
        {sub && <div className="text-[#F5F0E8]/50 text-[10px] tracking-widest uppercase">{sub}</div>}
      </div>
    </div>
  )
}

// ── Step number in route number style ─────────────────────────────────────────
function StepNumber({ n }) {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#C8102E] flex items-center justify-center flex-shrink-0">
      <span className="text-white font-black text-base font-mono">{n}</span>
    </div>
  )
}

// ── Livery stripe decoration ───────────────────────────────────────────────────
function LiveryStripe() {
  return (
    <div className="flex w-full h-2 overflow-hidden rounded-full">
      <div className="flex-1 bg-[#C8102E]" />
      <div className="w-3 bg-[#F5C518]" />
      <div className="flex-1 bg-[#1A1A1A]" />
    </div>
  )
}

// ── Fake plate display ─────────────────────────────────────────────────────────
function Plate({ reg, type = 'rear' }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border-2 font-mono font-black tracking-[0.18em] text-sm
      ${type === 'front'
        ? 'bg-white border-gray-300 text-[#1A1A1A]'
        : 'bg-[#F5C518] border-[#D4A800] text-[#1A1A1A]'}`}>
      <span className="w-2 h-full rounded-sm bg-[#003399] opacity-80 text-[8px] text-white flex items-center justify-center" style={{minWidth:'8px'}}>GB</span>
      {reg}
    </div>
  )
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FDF6EE]">

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav className="bg-[#C8102E] px-4 sm:px-8 h-14 flex items-center gap-3 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🚌</span>
          </div>
          <span className="text-white font-black tracking-widest text-lg font-mono">BUSBOARD</span>
        </div>
        <span className="flex-1" />
        <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors hidden sm:block">
          Log in
        </Link>
        <Link href="/signup" className="bg-white text-[#C8102E] font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-[#FDF6EE] transition-colors">
          Sign up free
        </Link>
      </nav>

      {/* ── Destination strip ─────────────────────────────────────────────────── */}
      <div className="bg-[#1A1A1A] px-4 sm:px-8 py-2 flex items-center gap-3">
        <div className="bg-[#F5C518] text-[#1A1A1A] font-black text-xs px-2 py-0.5 rounded font-mono tracking-wider border border-[#D4A800]">
          BB1
        </div>
        <span className="text-[#F5F0E8]/50 text-xs tracking-widest uppercase font-mono">
          <strong className="text-[#F5F0E8]/90">BusBoard</strong>&nbsp;·&nbsp;Spot it · Snap it · Save it right
        </span>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">

        {/* Livery accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="w-3/4 bg-[#C8102E]" />
          <div className="w-4 bg-[#F5C518]" />
          <div className="flex-1 bg-[#1A1A1A]" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-16 pb-20">
          <div className="flex flex-col lg:flex-row items-start gap-12">

            {/* Left — text */}
            <div className="flex-1">
              <div className="mb-6">
                <DestinationBlind route="1" text="Terminal · All stops" />
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#1A1A1A] leading-[1.05] mb-6">
                Your bus photos,<br />
                <span className="text-[#C8102E]">perfectly organised.</span>
              </h1>

              <p className="text-[#7A7068] text-lg leading-relaxed mb-8 max-w-lg">
                Upload your bus and coach photos. BusBoard reads every registration plate, renames each file, tags it with date, time and GPS location, then sends it straight to Flickr.
              </p>

              <div className="flex gap-3 flex-wrap mb-10">
                <Link href="/signup"
                  className="bg-[#C8102E] hover:bg-[#9B0B22] text-white font-bold text-base px-7 py-3.5 rounded-xl transition-all inline-flex items-center gap-2">
                  Get started free
                  <span className="text-white/70">→</span>
                </Link>
                <Link href="/login"
                  className="bg-white border-2 border-[#E8DDD8] hover:border-[#C8102E]/30 text-[#1A1A1A] font-semibold text-base px-7 py-3.5 rounded-xl transition-all">
                  Log in
                </Link>
              </div>

              {/* Social proof strip */}
              <div className="flex items-center gap-4 flex-wrap">
                {['500 photos per batch', 'JPEG & HEIC', 'Flickr integration', 'Free to use'].map(tag => (
                  <div key={tag} className="flex items-center gap-1.5 text-xs text-[#7A7068]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#C8102E]" />
                    {tag}
                  </div>
                ))}
              </div>
            </div>

            {/* Right — mock result card */}
            <div className="lg:w-80 w-full">
              <div className="bg-white rounded-2xl border-2 border-[#E8DDD8] overflow-hidden shadow-sm">
                {/* Card header — destination blind style */}
                <div className="bg-[#1A1A1A] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-[#F5F0E8] text-xs font-mono tracking-wider">BATCH COMPLETE</span>
                  </div>
                  <span className="text-[#F5C518] text-xs font-mono">4/5 found</span>
                </div>
                {/* Photo results */}
                <div className="p-4 space-y-3">
                  {[
                    { reg: 'LN66 DPU', date: '12 Oct 2021', loc: 'Oxford', status: 'done' },
                    { reg: 'YN16 NZC', date: '5 Apr 2023', loc: 'Folkestone', status: 'done' },
                    { reg: 'GE20 GWE', date: '25 Jul 2023', loc: 'Oxfordshire', status: 'done' },
                    { reg: 'FJ11 MKE', date: '16 Jun 2023', loc: 'Kent', status: 'done' },
                    { reg: '???', date: '—', loc: '—', status: 'failed' },
                  ].map((p, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border
                      ${p.status === 'done'
                        ? 'bg-[#FDF6EE] border-[#E8DDD8]'
                        : 'bg-gray-50 border-gray-200 opacity-50'}`}>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'done' ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-mono font-bold text-sm tracking-widest ${p.status === 'done' ? 'text-[#1A1A1A]' : 'text-gray-400'}`}>{p.reg}</p>
                        {p.status === 'done' && <p className="text-[10px] text-[#7A7068]">{p.date} · {p.loc}</p>}
                      </div>
                      {p.status === 'done' && (
                        <div className="bg-[#F5C518] text-[#1A1A1A] text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                          .jpg
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="pt-1">
                    <div className="bg-[#C8102E] text-white text-xs font-bold px-4 py-2 rounded-lg text-center tracking-wide">
                      💾 Download ZIP
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-[#E8DDD8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
          <div className="mb-10">
            <DestinationBlind route="2" text="How it works" sub="Four stops" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { n: '01', title: 'Upload your photos', desc: 'Drop up to 500 JPEG or HEIC photos into BusBoard in one go. Add more before you start.' },
              { n: '02', title: 'AI reads the plates', desc: 'Claude AI scans every photo for UK registration plates, looking at all angles and lighting conditions.' },
              { n: '03', title: 'Tags are added', desc: 'Each photo gets the date, time, GPS coordinates and location written into the filename and metadata.' },
              { n: '04', title: 'Download or upload', desc: 'Get a ZIP with renamed and unprocessed folders, or send directly to Flickr in dated albums.' },
            ].map(s => (
              <div key={s.n} className="group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 bg-[#C8102E] rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-black text-xs font-mono">{s.n}</span>
                  </div>
                  <div className="h-px flex-1 bg-[#E8DDD8] group-last:hidden" />
                </div>
                <h3 className="font-bold text-[#1A1A1A] mb-2 text-sm">{s.title}</h3>
                <p className="text-[#7A7068] text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 py-16">
        <div className="mb-10">
          <DestinationBlind route="3" text="Features" sub="All stops" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              icon: '🔍',
              title: 'Smart plate recognition',
              desc: 'Two-pass AI reading with format validation. Handles obscured, dark, or angled plates. Distinguishes 0/O, 1/I, 8/B automatically.',
            },
            {
              icon: '📍',
              title: 'Precise GPS tagging',
              desc: 'Parses EXIF degrees/minutes/seconds correctly and reverse geocodes to street level using OpenStreetMap.',
            },
            {
              icon: '✏️',
              title: 'Custom filenames',
              desc: 'Choose exactly what goes in each filename — registration, date, location, operator — in any combination.',
            },
            {
              icon: '📸',
              title: 'Flickr direct upload',
              desc: 'Connect your account once. Photos go into dated albums with titles, descriptions and tags filled automatically.',
            },
            {
              icon: '🏢',
              title: 'Operator detection',
              desc: 'Identifies the bus company from the livery and includes it in the filename and Flickr metadata.',
            },
            {
              icon: '🗂️',
              title: 'Organised ZIP',
              desc: 'Download a ZIP with two folders — renamed photos with plates found, and unprocessed ones to review manually.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white border border-[#E8DDD8] rounded-xl p-5 hover:border-[#C8102E]/30 transition-colors">
              <div className="w-10 h-10 bg-[#FDF6EE] rounded-lg flex items-center justify-center mb-4 text-xl border border-[#E8DDD8]">
                {f.icon}
              </div>
              <h3 className="font-bold text-[#1A1A1A] mb-2 text-sm">{f.title}</h3>
              <p className="text-[#7A7068] text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Plate showcase ─────────────────────────────────────────────────────── */}
      <section className="bg-[#1A1A1A] py-12 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <p className="text-[#F5F0E8]/40 text-xs font-mono tracking-widest uppercase mb-6">Plates we've read today</p>
          <div className="flex flex-wrap gap-3">
            {['LN66 DPU', 'YN16 NZC', 'GE20 GWE', 'FJ11 MKE', 'SN65 OAA', 'LJ20 BKA', 'YN71 ZTF', 'M40 TUD', 'R123 ABC', 'AB12 CDE'].map(reg => (
              <div key={reg} className="bg-[#F5C518] border-2 border-[#D4A800] text-[#1A1A1A] font-mono font-black tracking-[0.18em] text-sm px-3 py-1.5 rounded">
                {reg}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="bg-[#C8102E] py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 text-center">
          <div className="mb-6 flex justify-center">
            <DestinationBlind route="4" text="All aboard" sub="Final stop" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
            Stop renaming files by hand.
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-lg mx-auto">
            Join the bus enthusiasts who are already saving hours every week with BusBoard.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/signup"
              className="bg-white text-[#C8102E] font-black text-base px-8 py-3.5 rounded-xl hover:bg-[#FDF6EE] transition-all inline-flex items-center gap-2">
              Create free account →
            </Link>
            <Link href="/login"
              className="bg-white/10 border border-white/20 text-white font-semibold text-base px-8 py-3.5 rounded-xl hover:bg-white/20 transition-all">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="bg-[#1A1A1A] px-4 sm:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          {/* Livery stripe */}
          <div className="flex h-1 mb-6 rounded overflow-hidden">
            <div className="flex-1 bg-[#C8102E]" />
            <div className="w-8 bg-[#F5C518]" />
            <div className="w-16 bg-[#9B0B22]" />
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[#F5F0E8] font-black tracking-widest font-mono">BUSBOARD</span>
                <div className="bg-[#F5C518] text-[#1A1A1A] text-[10px] font-black px-1.5 py-0.5 rounded font-mono">BB1</div>
              </div>
              <p className="text-[#F5F0E8]/40 text-xs">Built for the bus obsessed</p>
            </div>
            <div className="flex gap-6">
              <Link href="/login" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Log in</Link>
              <Link href="/signup" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Sign up</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
