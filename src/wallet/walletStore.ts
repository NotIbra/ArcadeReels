import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const STARTING_COINS = 1000
export const TOP_UP_AMOUNT = 500
export const TOP_UP_COOLDOWN_MS = 5 * 60 * 1000
// Keeps localStorage small; the stats screen only needs recent history.
const MAX_HISTORY = 500

export interface Round {
  game: string
  bet: number
  won: boolean
  payout: number
}

export interface RoundRecord extends Round {
  at: number
}

interface WalletState {
  coins: number
  history: RoundRecord[]
  lastTopUpAt: number | null
  /** Deducts the bet. Returns false (and changes nothing) if the amount is invalid or there aren't enough coins. */
  placeBet: (amount: number) => boolean
  /** Adds winnings to the wallet. */
  payout: (amount: number) => void
  /** Appends a finished round to the history. */
  recordRound: (round: Round) => void
  /** Gives TOP_UP_AMOUNT free coins. Returns false if still on cooldown. */
  claimTopUp: () => boolean
}

const isValidAmount = (amount: number) => Number.isFinite(amount) && amount > 0

/** Milliseconds until the free top-up can be claimed again (0 = available now). */
export function topUpAvailableIn(lastTopUpAt: number | null, now = Date.now()) {
  if (lastTopUpAt === null) return 0
  return Math.max(0, lastTopUpAt + TOP_UP_COOLDOWN_MS - now)
}

export const useWallet = create<WalletState>()(
  persist(
    (set, get) => ({
      coins: STARTING_COINS,
      history: [],
      lastTopUpAt: null,
      placeBet: (amount) => {
        if (!isValidAmount(amount) || amount > get().coins) return false
        set((s) => ({ coins: s.coins - amount }))
        return true
      },
      payout: (amount) => {
        if (!isValidAmount(amount)) return
        set((s) => ({ coins: s.coins + amount }))
      },
      recordRound: (round) =>
        set((s) => ({ history: [...s.history, { ...round, at: Date.now() }].slice(-MAX_HISTORY) })),
      claimTopUp: () => {
        if (topUpAvailableIn(get().lastTopUpAt) > 0) return false
        set((s) => ({ coins: s.coins + TOP_UP_AMOUNT, lastTopUpAt: Date.now() }))
        return true
      },
    }),
    { name: 'scroll-casino-wallet' },
  ),
)
