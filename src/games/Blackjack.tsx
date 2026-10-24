import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import { useWallet } from '../wallet/walletStore'

const DECKS = 6
const RESHUFFLE_AT = 0.25 // reshuffle before a deal when less than 25% of the shoe is left
const DEAL_STAGGER_MS = 160
const DEAL_MS = 380 // matches --animate-deal in index.css
const FLIP_MS = 450
const DRAW_MS = 550

const SUITS = ['♠', '♥', '♦', '♣'] as const
const RANK_LABELS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }

type Suit = (typeof SUITS)[number]
type Card = { id: number; rank: number; suit: Suit; delay: number }
type Phase = 'betting' | 'dealing' | 'player' | 'dealer' | 'done'
type ResultKind = 'blackjack' | 'win' | 'dealerBust' | 'push' | 'lose' | 'bust' | 'dealerBlackjack'
type GameState = {
  phase: Phase
  player: Card[]
  dealer: Card[]
  holeHidden: boolean
  bet: number // total stake, including a double down
  doubled: boolean
  result: { kind: ResultKind; payout: number } | null
}

// Total returned to the player as a multiple of the stake.
const PAYOUT_MULT: Record<ResultKind, number> = {
  blackjack: 2.5,
  win: 2,
  dealerBust: 2,
  push: 1,
  lose: 0,
  bust: 0,
  dealerBlackjack: 0,
}

const RESULT_TEXT: Record<ResultKind, string> = {
  blackjack: 'Blackjack!',
  win: 'You win',
  dealerBust: 'Dealer busts',
  push: 'Push',
  lose: 'Dealer wins',
  bust: 'Bust',
  dealerBlackjack: 'Dealer blackjack',
}

let nextCardId = 1

function buildShoe() {
  const shoe: Omit<Card, 'id' | 'delay'>[] = []
  for (let d = 0; d < DECKS; d++) {
    for (const suit of SUITS) for (let rank = 1; rank <= 13; rank++) shoe.push({ rank, suit })
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

/** Aces count as 11 when that doesn't bust the hand ("soft"), otherwise 1. */
function handValue(cards: Card[]) {
  let total = 0
  let aces = 0
  for (const c of cards) {
    total += Math.min(c.rank, 10)
    if (c.rank === 1) aces++
  }
  const soft = aces > 0 && total + 10 <= 21
  return { total: soft ? total + 10 : total, soft }
}

const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21

function formatTotal(cards: Card[]) {
  const { total, soft } = handValue(cards)
  return soft && total !== 21 ? `${total - 10} / ${total}` : String(total)
}

const INITIAL: GameState = {
  phase: 'betting',
  player: [],
  dealer: [],
  holeHidden: false,
  bet: 0,
  doubled: false,
  result: null,
}

export default function Blackjack({ isActive }: { isActive: boolean }) {
  const coins = useWallet((s) => s.coins)
  const placeBet = useWallet((s) => s.placeBet)
  const payout = useWallet((s) => s.payout)
  const recordRound = useWallet((s) => s.recordRound)
  const { choice, setChoice, amount } = useBet()

  // Game logic reads stateRef (always current); `view` is the same object, for rendering.
  const [view, setView] = useState<GameState>(INITIAL)
  const stateRef = useRef<GameState>(INITIAL)
  const update = (patch: Partial<GameState>) => {
    stateRef.current = { ...stateRef.current, ...patch }
    setView(stateRef.current)
  }

  const [error, setError] = useState<string | null>(null)
  const [shuffling, setShuffling] = useState(false)
  const shoeRef = useRef(buildShoe())
  const tableRef = useRef<HTMLDivElement>(null)
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  // Timed steps (deal, flip, dealer draws). Off-screen they run immediately, so a round always
  // finishes and pays out instead of waiting for the player to swipe back.
  const timers = useRef(new Map<number, () => void>())
  const later = (fn: () => void, ms: number) => {
    if (!isActiveRef.current) return fn()
    const id = window.setTimeout(() => {
      timers.current.delete(id)
      fn()
    }, ms)
    timers.current.set(id, fn)
  }

  useEffect(() => {
    if (isActive) return
    while (timers.current.size) {
      const [id, fn] = timers.current.entries().next().value!
      clearTimeout(id)
      timers.current.delete(id)
      fn()
    }
  }, [isActive])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((_, id) => clearTimeout(id))
  }, [])

  const draw = (delay = 0): Card => {
    if (shoeRef.current.length === 0) shoeRef.current = buildShoe()
    return { ...shoeRef.current.pop()!, id: nextCardId++, delay }
  }

  const settle = (kind: ResultKind) => {
    const { bet } = stateRef.current
    const win = Math.floor(bet * PAYOUT_MULT[kind])
    if (win) payout(win)
    recordRound({ game: 'blackjack', bet, won: win > bet, payout: win })
    update({ phase: 'done', holeHidden: false, result: { kind, payout: win } })

    if (!isActiveRef.current) return
    if (kind === 'blackjack') {
      confetti({
        particleCount: 160,
        spread: 85,
        origin: { y: 0.55 },
        colors: ['#facc15', '#22c55e', '#ffffff'],
        disableForReducedMotion: true,
      })
    } else if (win < bet) {
      tableRef.current?.animate(
        [0, -12, 12, -8, 8, -4, 0].map((x) => ({ transform: `translateX(${x}px)` })),
        { duration: 450, easing: 'ease-out' },
      )
    }
  }

  const revealThenSettle = (kind: ResultKind) => {
    update({ holeHidden: false })
    later(() => settle(kind), FLIP_MS)
  }

  // Dealer draws until 17 or more; stands on soft 17.
  const dealerStep = () => {
    const { dealer, player } = stateRef.current
    const d = handValue(dealer).total
    if (d < 17) {
      update({ dealer: [...dealer, draw()] })
      later(dealerStep, DRAW_MS)
      return
    }
    const p = handValue(player).total
    settle(d > 21 ? 'dealerBust' : p > d ? 'win' : p === d ? 'push' : 'lose')
  }

  const standNow = () => {
    update({ phase: 'dealer', holeHidden: false })
    later(dealerStep, FLIP_MS)
  }

  const deal = () => {
    const { phase } = stateRef.current
    if (phase !== 'betting' && phase !== 'done') return
    if (!placeBet(amount)) {
      setError('Not enough coins for that bet')
      return
    }
    setError(null)
    if (shoeRef.current.length < DECKS * 52 * RESHUFFLE_AT) {
      shoeRef.current = buildShoe()
      setShuffling(true)
      later(() => setShuffling(false), 1500)
    }

    // Deal order: player, dealer, player, dealer (face down).
    const p1 = draw(0)
    const d1 = draw(DEAL_STAGGER_MS)
    const p2 = draw(DEAL_STAGGER_MS * 2)
    const d2 = draw(DEAL_STAGGER_MS * 3)
    update({ phase: 'dealing', player: [p1, p2], dealer: [d1, d2], holeHidden: true, bet: amount, doubled: false, result: null })

    later(() => {
      const { player, dealer } = stateRef.current
      const playerBJ = isBlackjack(player)
      const dealerBJ = isBlackjack(dealer)
      if (playerBJ || dealerBJ) {
        revealThenSettle(playerBJ && dealerBJ ? 'push' : playerBJ ? 'blackjack' : 'dealerBlackjack')
      } else {
        update({ phase: 'player' })
      }
    }, DEAL_STAGGER_MS * 3 + DEAL_MS)
  }

  const hit = () => {
    if (stateRef.current.phase !== 'player') return
    const player = [...stateRef.current.player, draw()]
    const total = handValue(player).total
    // Bust or 21 ends the player's turn (21 stands automatically).
    update({ player, phase: total >= 21 ? 'dealer' : 'player' })
    if (total > 21) later(() => revealThenSettle('bust'), DEAL_MS)
    else if (total === 21) later(standNow, DEAL_MS)
  }

  const stand = () => {
    if (stateRef.current.phase === 'player') standNow()
  }

  const doubleDown = () => {
    const s = stateRef.current
    if (s.phase !== 'player' || s.player.length !== 2 || s.doubled) return
    if (!placeBet(s.bet)) {
      setError('Not enough coins to double')
      return
    }
    setError(null)
    const player = [...s.player, draw()]
    update({ player, bet: s.bet * 2, doubled: true, phase: 'dealer' })
    later(() => (handValue(player).total > 21 ? revealThenSettle('bust') : standNow()), DEAL_MS)
  }

  const { phase, player, dealer, holeHidden, bet, result } = view
  const inRound = phase !== 'betting' && phase !== 'done'
  const canDouble = phase === 'player' && player.length === 2 && !view.doubled
  const dealerShown = holeHidden ? dealer.slice(0, 1) : dealer
  const playerTotal = handValue(player).total

  let message: React.ReactNode
  if (result) {
    const net = result.payout - bet
    const good = result.payout > bet
    message = (
      <span className={`text-2xl font-black ${good ? 'text-win' : result.kind === 'push' ? 'text-white' : 'text-loss'}`}>
        {RESULT_TEXT[result.kind]} · {net > 0 ? `+${net}` : net < 0 ? `−${-net}` : `${bet} back`}
      </span>
    )
  } else if (shuffling) {
    message = <span className="text-lg font-bold text-neon">Shuffling a new shoe…</span>
  } else if (error) {
    message = <span className="text-lg font-bold text-loss">{error}</span>
  } else if (phase === 'player') {
    message = <span className="text-lg text-white/70">Hit, stand or double?</span>
  } else if (inRound) {
    message = <span className="text-lg text-white/50">…</span>
  } else {
    message = <span className="text-lg text-white/60">Beat the dealer to 21. Blackjack pays 3:2.</span>
  }

  const bigBtn = 'min-h-16 rounded-2xl text-2xl font-black transition active:scale-95 disabled:opacity-40'

  return (
    <div
      className={`flex h-dvh w-full flex-col items-center bg-[radial-gradient(circle_at_50%_40%,#0b3a24_0%,#07060b_70%)] px-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+2.75rem)] pt-[calc(max(0.75rem,env(safe-area-inset-top))+6.25rem)] ${
        isActive ? '' : '[&_*]:[animation-play-state:paused]'
      }`}
    >
      <div ref={tableRef} className="flex w-full max-w-sm flex-1 flex-col justify-around">
        <Hand label="Dealer" cards={dealer} hiddenIndex={holeHidden ? 1 : -1} total={dealer.length ? formatTotal(dealerShown) : null} />

        <div aria-live="polite" className="flex min-h-10 items-center justify-center text-center">
          {message}
        </div>

        <Hand
          label={inRound || result ? `You · bet ${bet}` : 'You'}
          cards={player}
          hiddenIndex={-1}
          total={player.length ? formatTotal(player) : null}
          bust={playerTotal > 21}
        />
      </div>

      {/* swiper-no-swiping: drags that start on the controls never move the feed. */}
      <div className="swiper-no-swiping flex w-full max-w-sm flex-col gap-3 pt-3">
        {inRound ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={hit} disabled={phase !== 'player'} className={`${bigBtn} border-2 border-neon bg-neon/15 text-neon`}>
                Hit
              </button>
              <button type="button" onClick={stand} disabled={phase !== 'player'} className={`${bigBtn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}>
                Stand
              </button>
            </div>
            <button
              type="button"
              onClick={doubleDown}
              disabled={!canDouble || coins < bet}
              className="min-h-14 rounded-2xl border-2 border-coin/70 text-xl font-black text-coin transition active:scale-95 disabled:opacity-30"
            >
              Double down {canDouble ? `(+${bet})` : ''}
            </button>
          </>
        ) : (
          <>
            <BetSelector value={choice} onChange={setChoice} />
            <button type="button" onClick={deal} className={`${bigBtn} bg-coin text-black shadow-[0_0_24px_rgba(250,204,21,0.45)]`}>
              Deal for {amount}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Hand({
  label,
  cards,
  hiddenIndex,
  total,
  bust = false,
}: {
  label: string
  cards: Card[]
  hiddenIndex: number
  total: string | null
  bust?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold uppercase tracking-widest text-white/60">{label}</span>
        {total && (
          <span
            className={`rounded-full px-3 py-0.5 text-lg font-black tabular-nums ${
              bust ? 'bg-loss/25 text-loss' : total === '21' ? 'bg-coin/25 text-coin' : 'bg-black/50 text-white'
            }`}
          >
            {bust ? `${total} bust` : total}
          </span>
        )}
      </div>
      <div className="flex h-[104px] items-center">
        {cards.length === 0
          ? [0, 1].map((i) => (
              <div key={i} className={`h-[104px] w-[72px] rounded-xl border-2 border-dashed border-white/15 ${i ? '-ml-[30px]' : ''}`} />
            ))
          : cards.map((card, i) => <PlayingCard key={card.id} card={card} index={i} hidden={i === hiddenIndex} />)}
      </div>
    </div>
  )
}

const isRed = (suit: Suit) => suit === '♥' || suit === '♦'

function PlayingCard({ card, index, hidden }: { card: Card; index: number; hidden: boolean }) {
  const label = RANK_LABELS[card.rank] ?? String(card.rank)
  const color = isRed(card.suit) ? 'text-red-600' : 'text-zinc-900'

  return (
    <div
      className="relative h-[104px] w-[72px] shrink-0 animate-deal"
      style={{ animationDelay: `${card.delay}ms`, marginLeft: index ? -30 : 0, zIndex: index, perspective: '600px' }}
    >
      <div
        className="relative h-full w-full transition-transform ease-out"
        style={{ transformStyle: 'preserve-3d', transform: hidden ? 'rotateY(180deg)' : 'none', transitionDuration: `${FLIP_MS}ms` }}
      >
        <div
          className={`absolute inset-0 flex flex-col justify-between rounded-xl border-2 border-white bg-white p-1.5 shadow-[0_4px_14px_rgba(0,0,0,0.5)] ${color}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className="text-xl font-black leading-none">
            {label}
            <span className="block text-base">{card.suit}</span>
          </span>
          <span className="self-end text-3xl leading-none">{card.suit}</span>
        </div>
        <div
          className="absolute inset-0 rounded-xl border-2 border-white/90 bg-[repeating-linear-gradient(45deg,#7e22ce_0_8px,#a21caf_8px_16px)] shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        />
      </div>
    </div>
  )
}
