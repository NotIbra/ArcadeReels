import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { lossFlicker, spookyBurst } from '../theme/effects'
import { useWallet } from '../wallet/walletStore'

type Side = 'heads' | 'tails'
type Outcome = { side: Side; won: boolean; bet: number }

// "Skull or Bones": heads is the skull side, tails the crossed bones. Display only.
const SIDE_LABEL: Record<Side, string> = { heads: 'Skull', tails: 'Bones' }

const FLIP_MS = 1000
const SPINS = 5

export default function CoinFlip({ isActive }: { isActive: boolean }) {
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  const [pick, setPick] = useState<Side>('heads')
  const [rotation, setRotation] = useState(0)
  const [flipping, setFlipping] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tossRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const flip = () => {
    if (flipping) return
    const bet = amount
    if (!placeBet(bet)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    setOutcome(null)
    setFlipping(true)

    const side: Side = Math.random() < 0.5 ? 'heads' : 'tails'
    // rotation is always a multiple of 180, so this lands exactly on the chosen face.
    setRotation((r) => r - (r % 360) + SPINS * 360 + (side === 'tails' ? 180 : 0))
    tossRef.current?.animate(
      [
        { transform: 'translateY(0) scale(1)' },
        { transform: 'translateY(-90px) scale(1.15)', offset: 0.45 },
        { transform: 'translateY(0) scale(1)' },
      ],
      { duration: FLIP_MS, easing: 'ease-in-out' },
    )

    // Settle even if the card is swiped away mid-flip, so the bet is always resolved.
    timerRef.current = window.setTimeout(() => {
      const won = side === pick
      const win = won ? bet * 2 : 0
      if (won) payout(win)
      recordRound({ game: 'coin-flip', bet, won, payout: win })
      setOutcome({ side, won, bet })
      setFlipping(false)

      if (!isActiveRef.current) return
      if (won) spookyBurst({ particleCount: 40, origin: { y: 0.45 } })
      else lossFlicker()
    }, FLIP_MS)
  }

  const lost = outcome && !outcome.won

  return (
    <div className="flex h-dvh w-full flex-col items-center justify-between bg-[radial-gradient(circle_at_50%_35%,#3a1a08_0%,#0d0614_65%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.5rem)]">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div ref={tossRef} style={{ perspective: '800px' }}>
          <div
            className="relative h-44 w-44"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${rotation}deg)`,
              transition: flipping ? `transform ${FLIP_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)` : 'none',
            }}
          >
            <CoinFace side="heads" ring={lost ? 'loss' : 'coin'} />
            <CoinFace side="tails" ring={lost ? 'loss' : 'coin'} back />
          </div>
        </div>

        <p aria-live="polite" className="h-16 text-center">
          {flipping ? (
            <span className="text-xl font-bold text-white/60">Flipping…</span>
          ) : outcome ? (
            <>
              <span className="block text-sm uppercase tracking-widest text-white/70">{SIDE_LABEL[outcome.side]}</span>
              <span className={`block text-3xl font-black ${outcome.won ? 'text-win' : 'text-loss'}`}>
                {outcome.won ? `+${outcome.bet * 2}` : `−${outcome.bet}`}
              </span>
            </>
          ) : error ? (
            <span className="text-lg font-bold text-loss">{error}</span>
          ) : (
            <span className="text-lg text-white/70">Skull or bones? Win pays 2×.</span>
          )}
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <div role="radiogroup" aria-label="Pick a side" className="grid grid-cols-2 gap-2">
          {(['heads', 'tails'] as const).map((side) => (
            <button
              key={side}
              type="button"
              role="radio"
              aria-checked={pick === side}
              disabled={flipping}
              onClick={() => setPick(side)}
              className={`min-h-14 rounded-xl border-2 text-xl font-black uppercase transition active:scale-95 disabled:opacity-50 ${
                pick === side ? 'border-neon bg-neon/20 text-neon' : 'border-white/15 bg-white/5 text-white/80'
              }`}
            >
              {side === 'heads' ? '💀 ' : '🦴 '}
              {SIDE_LABEL[side]}
            </button>
          ))}
        </div>
        <BetSelector value={choice} onChange={setChoice} disabled={flipping} />
        <button
          type="button"
          onClick={flip}
          disabled={flipping}
          className="min-h-16 rounded-2xl bg-coin text-2xl font-black text-black shadow-[0_0_24px_rgba(255,117,24,0.45)] transition active:scale-95 disabled:opacity-50"
        >
          {flipping ? '…' : `Flip for ${amount}`}
        </button>
      </div>
    </div>
  )
}

function CoinFace({ side, ring, back = false }: { side: Side; ring: 'coin' | 'loss'; back?: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-full border-8 bg-[radial-gradient(circle_at_35%_30%,#ffd9b0,#ff7518_45%,#7c2d12)] text-orange-950 shadow-[inset_0_0_18px_rgba(0,0,0,0.4),0_0_30px_rgba(255,117,24,0.45)] transition-colors ${
        ring === 'loss' ? 'border-blood' : 'border-orange-800'
      }`}
      style={{ backfaceVisibility: 'hidden', transform: back ? 'rotateX(180deg)' : undefined }}
    >
      {side === 'heads' ? (
        <span className="text-7xl leading-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]">💀</span>
      ) : (
        // Crossed bones: two bones rotated across each other.
        <span className="relative block h-20 w-20 drop-shadow-[0_2px_2px_rgba(0,0,0,0.4)]">
          <span className="absolute inset-0 flex rotate-45 items-center justify-center text-6xl">🦴</span>
          <span className="absolute inset-0 flex -rotate-45 items-center justify-center text-6xl">🦴</span>
        </span>
      )}
      <span className="mt-1 text-xs font-black tracking-[0.3em]">{SIDE_LABEL[side].toUpperCase()}</span>
    </div>
  )
}
