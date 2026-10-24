import { useEffect, useState } from 'react'
import BetSelector from '../components/BetSelector'
import { useBet } from '../components/useBet'
import CoinCounter from './CoinCounter'
import { topUpAvailableIn, useWallet } from './walletStore'

function formatCooldown(ms: number) {
  const secs = Math.ceil(ms / 1000)
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

// Dev-only page (open /#wallet-test) for poking the wallet by hand.
export default function WalletTestPage() {
  const { placeBet, payout, recordRound, claimTopUp, resetWallet, lastTopUpAt, history } = useWallet()
  const { choice, setChoice, amount } = useBet()
  const [pendingBet, setPendingBet] = useState<number | null>(null)
  const [message, setMessage] = useState('Pick a bet and tap Place bet.')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const cooldown = topUpAvailableIn(lastTopUpAt, now)

  const bet = () => {
    if (placeBet(amount)) {
      setPendingBet(amount)
      setMessage(`placeBet(${amount}) → true`)
    } else {
      setMessage(`placeBet(${amount}) → false (balance unchanged)`)
    }
  }

  const settle = (won: boolean) => {
    if (pendingBet === null) return
    const win = won ? pendingBet * 2 : 0
    if (won) payout(win)
    recordRound({ game: 'test', bet: pendingBet, won, payout: win })
    setMessage(won ? `payout(${win}) → net +${pendingBet}` : `Lost ${pendingBet}`)
    setPendingBet(null)
  }

  const topUp = () => setMessage(claimTopUp() ? 'claimTopUp() → true, +500' : 'claimTopUp() → false (cooldown)')

  const reset = () => {
    resetWallet()
    setPendingBet(null)
    setMessage('Wallet reset')
  }

  const btn = 'min-h-12 rounded-xl text-lg font-bold transition active:scale-95 disabled:opacity-30'

  return (
    <main className="flex h-dvh flex-col gap-4 overflow-y-auto bg-casino-bg px-4 pb-8 pt-24">
      <CoinCounter />
      <h1 className="text-center text-2xl font-black text-neon">Wallet test</h1>

      <BetSelector value={choice} onChange={setChoice} disabled={pendingBet !== null} />

      <button className={`${btn} bg-coin text-black`} onClick={bet} disabled={pendingBet !== null}>
        Place bet ({amount})
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button className={`${btn} bg-win text-black`} onClick={() => settle(true)} disabled={pendingBet === null}>
          Win (pay 2×)
        </button>
        <button className={`${btn} bg-loss text-white`} onClick={() => settle(false)} disabled={pendingBet === null}>
          Lose
        </button>
      </div>
      <button className={`${btn} border-2 border-coin text-coin`} onClick={topUp} disabled={cooldown > 0}>
        {cooldown > 0 ? `Free top-up in ${formatCooldown(cooldown)}` : 'Free top-up +500'}
      </button>

      <p className="rounded-xl bg-white/5 p-3 text-center font-mono text-sm text-white/80">{message}</p>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-white/50">
          History ({history.length})
        </h2>
        <ul className="space-y-1 font-mono text-sm">
          {history.slice(-8).reverse().map((r, i) => (
            <li key={`${r.at}-${i}`} className={r.won ? 'text-win' : 'text-loss'}>
              {r.game} · bet {r.bet} · {r.won ? `won, paid ${r.payout}` : 'lost'}
            </li>
          ))}
        </ul>
      </section>

      <button className={`${btn} mt-auto bg-white/10 text-white/70`} onClick={reset}>
        Reset wallet
      </button>
    </main>
  )
}
