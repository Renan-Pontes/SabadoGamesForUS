import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => window.clearInterval(interval)
  }, [intervalMs])

  return now
}

export function useCountdown(deadlineTs?: number | null, intervalMs = 1000) {
  const now = useNow(intervalMs)
  if (!deadlineTs) return null
  const remaining = Math.max(0, Math.ceil(deadlineTs * 1000 - now) / 1000)
  return remaining
}

export function formatSeconds(totalSeconds: number | null) {
  if (totalSeconds === null) return '--:--'
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
