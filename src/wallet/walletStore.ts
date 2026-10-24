import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const STARTING_COINS = 1000
export const TOP_UP_AMOUNT = 500
export const TOP_UP_COOLDOWN_MS = 5 * 60 * 1000
/** The free top-up button appears when the balance drops below this. */
export const LOW_BALANCE = 10
/** A single payout of at least this many times the bet triggers the big-win celebration. */
export const BIG_WIN_MULT = 10
/** Wins in a row needed before the flame badge shows. */
export const STREAK_BADGE_AT = 3
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

export interface BigWin extends RoundRecord {
  mult: number
}

interface WalletState {
  coins: number
  history: RoundRecord[]
  lastTopUpAt: number | null
  /** Rounds won in a row; any loss resets it to 0. */
  winStreak: number
  /** Set by recordRound for a payout ≥ BIG_WIN_MULT × bet; cleared by dismissBigWin. Not persisted. */
  bigWin: BigWin | null
  /** Deducts the bet. Returns false (and changes nothing) if the amount is invalid or there aren't enough coins. */
  placeBet: (amount: number) => boolean
  /** Adds winnings to the wallet. */
  payout: (amount: number) => void
  /** Appends a finished round to the history and updates the win streak / big win. */
  recordRound: (round: Round) => void
  /** Gives TOP_UP_AMOUNT free coins. Returns false if still on cooldown. */
  claimTopUp: () => boolean
  /** Back to STARTING_COINS with empty history and the top-up cooldown cleared. */
  resetWallet: () => void
  dismissBigWin: () => void
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
      winStreak: 0,
      bigWin: null,
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
        set((s) => {
          const record = { ...round, at: Date.now() }
          const mult = round.bet > 0 ? round.payout / round.bet : 0
          return {
            history: [...s.history, record].slice(-MAX_HISTORY),
            winStreak: round.won ? s.winStreak + 1 : 0,
            bigWin: mult >= BIG_WIN_MULT ? { ...record, mult } : s.bigWin,
          }
        }),
      claimTopUp: () => {
        if (topUpAvailableIn(get().lastTopUpAt) > 0) return false
        set((s) => ({ coins: s.coins + TOP_UP_AMOUNT, lastTopUpAt: Date.now() }))
        return true
      },
      resetWallet: () =>
        set({ coins: STARTING_COINS, history: [], lastTopUpAt: null, winStreak: 0, bigWin: null }),
      dismissBigWin: () => set({ bigWin: null }),
    }),
    {
      name: 'scroll-casino-wallet',
      partialize: ({ coins, history, lastTopUpAt, winStreak }) => ({ coins, history, lastTopUpAt, winStreak }),
    },
  ),
)
