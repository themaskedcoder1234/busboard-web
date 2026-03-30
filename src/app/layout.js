import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'BusBoard — Bus Photo Reg Renamer',
  description: 'Upload your bus photos and we\'ll read the registration plate, rename the file and tag it with date, time and location.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans bg-cream text-charcoal antialiased`}>
        {children}
      </body>
    </html>
  )
}
