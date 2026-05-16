import type { Metadata } from 'next'
import { DM_Sans, Cormorant_Garamond } from 'next/font/google'
import { dbInit } from '@/lib/db-init'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  variable: '--font-cormorant',
})

export const metadata: Metadata = {
  title: 'Ana — Assistente Pessoal',
  description: 'Assistente pessoal de produtividade',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await dbInit()
  return (
    <html lang="pt-BR">
      <body className={`${dmSans.variable} ${cormorant.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
