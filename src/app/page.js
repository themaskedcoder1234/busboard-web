import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* Nav */}
      <nav className="bg-[#C8102E] px-6 py-0 flex items-center gap-3 h-14">
        <span className="text-white font-bold tracking-widest text-xl" style={{fontFamily:'monospace'}}>
          🚌 BUSBOARD
        </span>
        <span className="flex-1" />
        <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
          Log in
        </Link>
        <Link href="/signup" className="bg-white text-[#C8102E] font-semibold text-sm px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
          Sign up free
        </Link>
      </nav>

      {/* Destination strip */}
      <div className="bg-[#9B0B22] px-6 py-2 flex items-center gap-3">
        <span className="bg-[#F5C518] text-black font-bold text-sm px-2.5 py-0.5 rounded font-mono tracking-wider">15</span>
        <span className="text-white/60 text-xs tracking-widest uppercase">
          <strong className="text-white/90">BusBoard</strong> &nbsp;·&nbsp; Spot it · Snap it · Save it right
        </span>
      </div>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 text-[#9B0B22] text-xs font-semibold px-3 py-1.5 rounded-full mb-6 tracking-wide uppercase">
          AI-Powered Plate Recognition
        </div>
        <h1 className="text-5xl font-bold text-[#1A1A1A] mb-4 leading-tight">
          Your bus photos,<br />
          <span className="text-[#C8102E]">perfectly organised.</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mb-8 leading-relaxed">
          Upload up to 500 photos at once. BusBoard reads each registration plate,
          renames the file, tags it with the date, time and location, then lets you
          download a ZIP or upload straight to Flickr.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/signup" className="btn-red text-base px-7 py-3">
            Get started free →
          </Link>
          <Link href="/login" className="btn-ghost text-base px-7 py-3">
            Log in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20 max-w-3xl w-full text-left">
          {[
            { icon: '🔍', title: 'AI plate reading', desc: 'Claude vision reads UK registration plates automatically from any angle.' },
            { icon: '📍', title: 'Date & location tags', desc: 'EXIF GPS data is reverse geocoded to a full address and written into every file.' },
            { icon: '📸', title: 'Flickr upload', desc: 'Connect your Flickr account and photos go straight into dated albums.' },
          ].map(f => (
            <div key={f.title} className="card">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#6B0718] px-6 py-4 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0">
          <div className="w-2.5 h-0.5 bg-white rounded" />
        </div>
        <span className="text-white/40 text-xs tracking-widest uppercase">
          Built for the <strong className="text-white/60">bus obsessed</strong>
        </span>
      </footer>

    </div>
  )
}
