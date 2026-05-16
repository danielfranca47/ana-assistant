import { NextResponse } from 'next/server'

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ data, error: null }, { status })
}

export function err(message: string, status = 500) {
  return NextResponse.json({ data: null, error: message }, { status })
}

export function parseUTCDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}
