import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANK_LABELS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }
// Multiplier after 1, 2, 3... correct guesses. Reaching the top rung cashes out automatically.
const LADDER = [1.5, 2, 3, 5, 8, 12, 20, 35, 50, 100]
const FLIP_MS = 500

type Card = { rank: number; suit: (typeof SUITS)[number] }
type Phase = 'idle' | 'playing' | 'revealing' | 'lost' | 'cashed'
type Guess = 'higher' | 'lower'

const drawCard = (): Card => ({
  rank: 2 + Math.floor(Math.random() * 13),
  suit: SUITS[Math.floor(Math.random() * SUITS.length)],
})

export default function HigherLower({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  // Two faces of one card: each flip rotates 180° and reveals the face that was hidden.
  const [faces, setFaces] = useState<[Card | null, Card | null]>([null, null])
  const [flips, setFlips] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [bet, setBet] = useState(0)
  const [streak, setStreak] = useState(0)
  const [history, setHistory] = useState<Card[]>([])
  const [lastResult, setLastResult] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const current = faces[flips % 2]
  const inRound = phase === 'playing' || phase === 'revealing'
  const multiplier = streak > 0 ? LADDER[streak - 1] : 1
  const nextMultiplier = LADDER[Math.min(streak, LADDER.length - 1)]
  const cashOutValue = Math.floor(bet * multiplier)

  const reveal = (next: Card, then: () => void) => {
    const hidden = (flips + 1) % 2
    setFaces((f) => (hidden === 0 ? [next, f[1]] : [f[0], next]))
    setFlips((n) => n + 1)
    setPhase('revealing')
    timerRef.current = window.setTimeout(then, FLIP_MS)
  }

  const cashOut = (atStreak: number) => {
    const win = Math.floor(bet * LADDER[atStreak - 1])
    payout(win)
    recordRound({ game: 'higher-lower', bet, won: true, payout: win })
    setLastResult(win)
    setPhase('cashed')
    if (isActiveRef.current) {
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.45 },
        colors: ['#facc15', '#22c55e', '#ffffff'],
        disableForReducedMotion: true,
      })
    }
  }

  const deal = () => {
    if (inRound) return
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    setBet(amount)
    setStreak(0)
    setHistory([])
    reveal(drawCard(), () => setPhase('playing'))
  }

  const guess = (dir: Guess) => {
    if (phase !== 'playing' || !current) return
    const prev = current
    const next = drawCard()
    setHistory((h) => [...h, prev].slice(-6))
    reveal(next, () => {
      // Equal ranks count as a wrong guess.
      const correct = dir === 'higher' ? next.rank > prev.rank : next.rank < prev.rank
      if (!correct) {
        recordRound({ game: 'higher-lower', bet, won: false, payout: 0 })
        setLastResult(bet)
        setPhase('lost')
        if (isActiveRef.current) {
          cardRef.current?.animate(
            [0, -14, 14, -10, 10, -5, 0].map((x) => ({ transform: `translateX(${x}px)` })),
            { duration: 450, easing: 'ease-out' },
          )
        }
        return
      }
      const newStreak = streak + 1
      setStreak(newStreak)
      if (newStreak >= LADDER.length) cashOut(newStreak)
      else setPhase('playing')
    })
  }

  const higherChance = current ? (14 - current.rank) / 13 : 0
  const lowerChance = current ? (current.rank - 2) / 13 : 0
  const btn = 'rounded-xl font-black transition active:scale-95 disabled:opacity-40'

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-between bg-[radial-gradient(circle_at_50%_35%,#0b2a1a_0%,#07060b_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="flex h-10 items-center gap-1.5" aria-label="Previous cards">
          {history.map((c, i) => (
            <MiniCard key={i} card={c} />
          ))}
        </div>

        <div ref={cardRef} style={{ perspective: '1000px' }}>
          <div
            className="relative h-56 w-40"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${flips * 180}deg)`,
              transition: `transform ${FLIP_MS}ms cubic-bezier(0.3, 0.7, 0.3, 1)`,
            }}
          >
            <CardFace card={faces[0]} lost={phase === 'lost'} />
            <CardFace card={faces[1]} lost={phase === 'lost'} back />
          </div>
        </div>

        <div aria-live="polite" className="h-14 text-center">
          {phase === 'lost' ? (
            <span className="text-3xl font-black text-loss">−{lastResult}</span>
          ) : phase === 'cashed' ? (
            <span className="text-3xl font-black text-win">+{lastResult}</span>
          ) : inRound ? (
            <>
              <span className="block text-3xl font-black tabular-nums text-coin">{multiplier}×</span>
              <span className="text-sm text-white/60">next correct: {nextMultiplier}×</span>
            </>
          ) : error ? (
            <span className="text-lg font-bold text-loss">{error}</span>
          ) : (
            <span className="text-lg text-white/60">Guess right to climb the multiplier.</span>
          )}
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {inRound ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(['higher', 'lower'] as const).map((dir) => {
                const chance = dir === 'higher' ? higherChance : lowerChance
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => guess(dir)}
                    disabled={phase !== 'playing' || chance === 0}
                    className={`${btn} flex min-h-16 flex-col items-center justify-center border-2 border-neon bg-neon/15 text-neon`}
                  >
                    <span className="text-xl uppercase">{dir === 'higher' ? '▲ Higher' : '▼ Lower'}</span>
                    <span className="text-xs font-semibold text-white/60">{Math.round(chance * 100)}%</span>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => cashOut(streak)}
              disabled={phase !== 'playing' || streak === 0}
              className={`${btn} min-h-16 bg-win text-2xl text-black shadow-[0_0_24px_rgba(34,197,94,0.4)]`}
            >
              {streak === 0 ? 'Make a guess' : `Cash out ${cashOutValue}`}
            </button>
          </>
        ) : (
          <>
            <BetSelector value={choice} onChange={setChoice} />
            <button
              type="button"
              onClick={deal}
              className={`${btn} min-h-16 bg-coin text-2xl text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}
            >
              Deal for {amount}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const rankLabel = (rank: number) => RANK_LABELS[rank] ?? String(rank)
const isRed = (card: Card) => card.suit === '♥' || card.suit === '♦'

function CardFace({ card, lost, back = false }: { card: Card | null; lost: boolean; back?: boolean }) {
  const style = { backfaceVisibility: 'hidden' as const, transform: back ? 'rotateY(180deg)' : undefined }

  if (!card) {
    return (
      <div
        className="absolute inset-0 rounded-2xl border-4 border-white/90 bg-[repeating-linear-gradient(45deg,#7e22ce_0_10px,#a21caf_10px_20px)] shadow-xl"
        style={style}
      />
    )
  }

  const color = isRed(card) ? 'text-red-600' : 'text-zinc-900'
  return (
    <div
      className={`absolute inset-0 flex flex-col justify-between rounded-2xl border-4 bg-white p-3 shadow-xl transition-colors ${color} ${
        lost ? 'border-loss' : 'border-white'
      }`}
      style={style}
    >
      <span className="text-3xl font-black leading-none">
        {rankLabel(card.rank)}
        <span className="block text-2xl">{card.suit}</span>
      </span>
      <span className="self-center text-7xl leading-none">{card.suit}</span>
      <span className="rotate-180 text-3xl font-black leading-none">
        {rankLabel(card.rank)}
        <span className="block text-2xl">{card.suit}</span>
      </span>
    </div>
  )
}

function MiniCard({ card }: { card: Card }) {
  return (
    <span
      className={`flex h-10 w-7 flex-col items-center justify-center rounded-md bg-white text-xs font-black leading-none ${
        isRed(card) ? 'text-red-600' : 'text-zinc-900'
      }`}
    >
      {rankLabel(card.rank)}
      <span>{card.suit}</span>
    </span>
  )
}
