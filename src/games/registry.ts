import type { ComponentType } from 'react'
import Blackjack from './Blackjack'
import CoinFlip from './CoinFlip'
import Crash from './Crash'
import HigherLower from './HigherLower'
import HorseRacing from './HorseRacing'
import Plinko from './Plinko'
import ScratchCard from './ScratchCard'
import Slots from './Slots'

export interface GameEntry {
  id: string
  name: string
  component: ComponentType<{ isActive: boolean }>
}

// Add one line per game, e.g. { id: 'slots', name: 'Slots', component: Slots },
export const games: GameEntry[] = [
  { id: 'coin-flip', name: 'Coin Flip', component: CoinFlip },
  { id: 'higher-lower', name: 'Higher or Lower', component: HigherLower },
  { id: 'scratch-card', name: 'Scratch Card', component: ScratchCard },
  { id: 'plinko', name: 'Plinko', component: Plinko },
  { id: 'slots', name: 'Slots', component: Slots },
  { id: 'crash', name: 'Crash', component: Crash },
  { id: 'blackjack', name: 'Blackjack', component: Blackjack },
  { id: 'horse-racing', name: 'Horse Racing', component: HorseRacing },
]
