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

// Add one line per game, e.g. { id: 'slots', name: 'Haunted Slots', component: Slots },
export const games: GameEntry[] = [
  { id: 'coin-flip', name: 'Skull or Bones', component: CoinFlip },
  { id: 'higher-lower', name: 'Higher or Lower', component: HigherLower },
  { id: 'scratch-card', name: 'Tombstone Scratch', component: ScratchCard },
  { id: 'plinko', name: 'Pumpkin Drop', component: Plinko },
  { id: 'slots', name: 'Haunted Slots', component: Slots },
  { id: 'crash', name: "Witch's Flight", component: Crash },
  { id: 'blackjack', name: 'Bone Jack', component: Blackjack },
  { id: 'horse-racing', name: 'Headless Horse Derby', component: HorseRacing },
]
