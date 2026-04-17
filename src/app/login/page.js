import Link from 'next/link'
import LoginForm from './LoginForm'

export default function LoginPage({ searchParams }) {
  const redirectTo = searchParams?.redirect || '/dashboard'

  return (
    <div className="min-h-screen flex flex-col bg-[#FDF6EE]">
      <nav className="bg-[#C8102E] px-4 sm:px-8 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-white text-base">🚌</span>
          </div>
          <span className="text-white font-black tracking-widest text-lg font-mono">BUSBOARD</span>
        </Link>
      </nav>
      <div className="bg-[#1A1A1A] px-4 sm:px-8 py-2 flex items-center gap-3">
        <div className="bg-[#F5C518] text-[#1A1A1A] font-black text-[10px] px-2 py-0.5 rounded font-mono tracking-wider border border-[#D4A800]">BB1</div>
        <span className="text-[#F5F0E8]/40 text-[10px] tracking-widest uppercase font-mono">
          <strong className="text-[#F5F0E8]/80">BusBoard</strong>&nbsp;·&nbsp;Spot it · Snap it · Save it right
        </span>
      </div>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <LoginForm redirectTo={redirectTo} />
        </div>
      </main>
    </div>
  )
}
