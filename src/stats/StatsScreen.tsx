import { useEffect, useMemo, useState } from 'react'
import { games } from '../games/registry'
import { useWallet, type RoundRecord } from '../wallet/walletStore'

// Set when the app first loads, so "this session" means since the page was opened.
const SESSION_START = Date.now()

const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? id

const fmt = (n: number) => Math.abs(n).toLocaleString()
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(n)}` : '0')
const netColor = (n: number) => (n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-white')

function formatDuration(ms: number) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${s}s`
  return `${s}s`
}

type GameStat = { id: string; rounds: number; net: number }

function summarise(history: RoundRecord[]) {
  let wagered = 0
  let net = 0
  let best: RoundRecord | null = null
  let worst: RoundRecord | null = null
  const perGame = new Map<string, GameStat>()

  for (const r of history) {
    const result = r.payout - r.bet
    wagered += r.bet
    net += result
    if (result > 0 && (!best || result > best.payout - best.bet)) best = r
    if (result < 0 && (!worst || result < worst.payout - worst.bet)) worst = r
    const g = perGame.get(r.game) ?? { id: r.game, rounds: 0, net: 0 }
    g.rounds++
    g.net += result
    perGame.set(r.game, g)
  }

  // Registry order first so each game keeps the same row; unknown ids (e.g. test rounds) go last.
  const order = (id: string) => {
    const i = games.findIndex((g) => g.id === id)
    return i === -1 ? games.length : i
  }
  const byGame = [...perGame.values()].sort((a, b) => order(a.id) - order(b.id))
  const favourite = byGame.reduce<GameStat | null>((top, g) => (!top || g.rounds > top.rounds ? g : top), null)

  return { rounds: history.length, wagered, net, best, worst, byGame, favourite }
}

interface Props {
  open: boolean
  onClose: () => void
}

/** Slide-up stats sheet. Stays mounted so it can animate in and out. */
export default function StatsScreen({ open, onClose }: Props) {
  const history = useWallet((s) => s.history)
  const resetWallet = useWallet((s) => s.resetWallet)
  const stats = useMemo(() => summarise(history), [history])
  const [now, setNow] = useState(Date.now())
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) {
      setConfirming(false)
      return
    }
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(id)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const maxAbs = Math.max(1, ...stats.byGame.map((g) => Math.abs(g.net)))

  return (
    <div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open} inert={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Stats"
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-md flex-col rounded-t-3xl border-t border-white/10 bg-casino-card shadow-[0_-10px_40px_rgba(0,0,0,0.6)] transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/20" />
          <h2 className="pt-2 text-2xl font-black text-white">Stats</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close stats"
            className="flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white/70 active:bg-white/10"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-5 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="rounded-2xl bg-white/5 p-4 text-center">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Net result</div>
            <div className={`text-5xl font-black tabular-nums ${netColor(stats.net)}`}>{signed(stats.net)}</div>
            <div className="mt-1 text-sm text-white/50">coins across {stats.rounds.toLocaleString()} rounds</div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Tile label="This session" value={formatDuration(now - SESSION_START)} />
            <Tile label="Rounds played" value={stats.rounds.toLocaleString()} />
            <Tile label="Total wagered" value={fmt(stats.wagered)} valueClass="text-coin" />
            <Tile label="Favourite game" value={stats.favourite ? gameName(stats.favourite.id) : '—'} small />
            <Tile
              label="Best win"
              value={stats.best ? signed(stats.best.payout - stats.best.bet) : '—'}
              sub={stats.best ? gameName(stats.best.game) : undefined}
              valueClass={stats.best ? 'text-win' : undefined}
            />
            <Tile
              label="Biggest loss"
              value={stats.worst ? signed(stats.worst.payout - stats.worst.bet) : '—'}
              sub={stats.worst ? gameName(stats.worst.game) : undefined}
              valueClass={stats.worst ? 'text-loss' : undefined}
            />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/50">Net coins per game</h3>
            {stats.byGame.length === 0 ? (
              <p className="rounded-xl bg-white/5 p-4 text-center text-white/50">Play a round to see stats.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {stats.byGame.map((g) => {
                  const pct = (Math.abs(g.net) / maxAbs) * 50
                  return (
                    <li key={g.id} className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-2">
                      <span className="leading-tight">
                        <span className="block truncate text-sm font-semibold text-white">{gameName(g.id)}</span>
                        <span className="text-xs text-white/40">{g.rounds} rounds</span>
                      </span>
                      <span className="relative h-5">
                        <span className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
                        {g.net !== 0 && (
                          <span
                            className={`absolute inset-y-0 ${g.net > 0 ? 'left-1/2 rounded-r bg-win' : 'right-1/2 rounded-l bg-loss'}`}
                            style={{ width: `${Math.max(pct, 1.5)}%` }}
                          />
                        )}
                      </span>
                      <span className="text-right text-sm font-bold tabular-nums text-white/80">{signed(g.net)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 pt-4">
            {confirming ? (
              <div className="flex flex-col gap-2">
                <p className="text-center text-sm text-white/70">
                  Reset coins to 1,000 and delete all history? This can't be undone.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="min-h-12 rounded-xl bg-white/10 font-bold text-white active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetWallet()
                      setConfirming(false)
                    }}
                    className="min-h-12 rounded-xl bg-loss font-bold text-white active:scale-95"
                  >
                    Yes, reset
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="min-h-12 w-full rounded-xl border-2 border-loss/60 font-bold text-loss active:scale-95"
              >
                Reset wallet
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function Tile({
  label,
  value,
  sub,
  valueClass = 'text-white',
  small = false,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
  small?: boolean
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/50">{label}</div>
      <div className={`truncate font-black tabular-nums ${small ? 'text-lg leading-8' : 'text-2xl'} ${valueClass}`}>
        {value}
      </div>
      {sub && <div className="truncate text-xs text-white/40">{sub}</div>}
    </div>
  )
}
