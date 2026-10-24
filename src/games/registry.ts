import type { ComponentType } from 'react'
import CoinFlip from './CoinFlip'

export interface GameEntry {
  id: string
  name: string
  component: ComponentType<{ isActive: boolean }>
}

// Add one line per game, e.g. { id: 'slots', name: 'Slots', component: Slots },
export const games: GameEntry[] = [
  { id: 'coin-flip', name: 'Coin Flip', component: CoinFlip },
]
