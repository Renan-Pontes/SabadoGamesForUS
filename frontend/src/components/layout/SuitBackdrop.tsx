import type { CSSProperties } from 'react'

type SuitItem = {
  symbol: string
  style: CSSProperties
}

const SUIT_ITEMS: SuitItem[] = [
  {
    symbol: '♠',
    style: {
      top: '-6%',
      left: '-4%',
      fontSize: 'clamp(6rem, 16vw, 18rem)',
      color: 'rgba(245, 245, 245, 0.06)',
      '--rotation': '-12deg',
      '--float-delay': '-2s',
      '--float-duration': '18s',
    } as CSSProperties,
  },
  {
    symbol: '♥',
    style: {
      top: '8%',
      right: '-2%',
      fontSize: 'clamp(5rem, 14vw, 16rem)',
      color: 'rgba(220, 38, 38, 0.08)',
      '--rotation': '8deg',
      '--float-delay': '-6s',
      '--float-duration': '20s',
    } as CSSProperties,
  },
  {
    symbol: '♦',
    style: {
      bottom: '-10%',
      left: '10%',
      fontSize: 'clamp(5rem, 12vw, 14rem)',
      color: 'rgba(251, 191, 36, 0.08)',
      '--rotation': '14deg',
      '--float-delay': '-4s',
      '--float-duration': '22s',
    } as CSSProperties,
  },
  {
    symbol: '♣',
    style: {
      bottom: '4%',
      right: '8%',
      fontSize: 'clamp(4rem, 10vw, 12rem)',
      color: 'rgba(34, 211, 238, 0.07)',
      '--rotation': '-6deg',
      '--float-delay': '-8s',
      '--float-duration': '19s',
    } as CSSProperties,
  },
  {
    symbol: '♠',
    style: {
      top: '36%',
      left: '18%',
      fontSize: 'clamp(3.5rem, 8vw, 10rem)',
      color: 'rgba(245, 245, 245, 0.05)',
      '--rotation': '20deg',
      '--float-delay': '-10s',
      '--float-duration': '24s',
    } as CSSProperties,
  },
  {
    symbol: '♥',
    style: {
      top: '54%',
      right: '22%',
      fontSize: 'clamp(3rem, 7vw, 9rem)',
      color: 'rgba(239, 68, 68, 0.06)',
      '--rotation': '-18deg',
      '--float-delay': '-12s',
      '--float-duration': '21s',
    } as CSSProperties,
  },
]

export default function SuitBackdrop() {
  return (
    <div className="suit-backdrop" aria-hidden="true">
      <div className="suit-backdrop__grid" />
      <div className="suit-backdrop__orb suit-backdrop__orb--red" />
      <div className="suit-backdrop__orb suit-backdrop__orb--gold" />
      <div className="suit-backdrop__orb suit-backdrop__orb--cyan" />
      {SUIT_ITEMS.map((item, index) => (
        <span key={`${item.symbol}-${index}`} className="suit-backdrop__item" style={item.style}>
          {item.symbol}
        </span>
      ))}
    </div>
  )
}
