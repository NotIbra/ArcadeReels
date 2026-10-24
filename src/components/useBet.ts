import { useState } from 'react'
import { useWallet } from '../wallet/walletStore'

export type BetChoice = 10 | 50 | 100 | 'all'

export const BET_CHOICES: BetChoice[] = [10, 50, 100, 'all']

/** Bet state for a game: pass choice/setChoice to <BetSelector />, use `amount` for placeBet. */
export function useBet(initial: BetChoice = 10) {
  const [choice, setChoice] = useState<BetChoice>(initial)
  const coins = useWallet((s) => s.coins)
  const amount = choice === 'all' ? coins : choice
  return { choice, setChoice, amount }
}
