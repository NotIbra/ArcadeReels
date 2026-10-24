import { useWallet } from '../wallet/walletStore'
import { BET_CHOICES, type BetChoice } from './useBet'

interface Props {
  value: BetChoice
  onChange: (choice: BetChoice) => void
  disabled?: boolean
}

/** Shared bet picker: 10 / 50 / 100 / All in. Options the wallet can't cover are greyed out. */
export default function BetSelector({ value, onChange, disabled = false }: Props) {
  const coins = useWallet((s) => s.coins)

  return (
    <div role="radiogroup" aria-label="Bet amount" className="grid w-full grid-cols-4 gap-2">
      {BET_CHOICES.map((choice) => {
        const affordable = choice === 'all' ? coins > 0 : coins >= choice
        const selected = value === choice
        return (
          <button
            key={choice}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || !affordable}
            onClick={() => onChange(choice)}
            className={`min-h-12 rounded-xl border-2 text-lg font-bold transition active:scale-95 disabled:opacity-30 ${
              selected
                ? 'border-coin bg-coin text-black shadow-[0_0_16px_rgba(250,204,21,0.5)]'
                : 'border-white/15 bg-white/5 text-white'
            }`}
          >
            {choice === 'all' ? 'All in' : choice}
          </button>
        )
      })}
    </div>
  )
}
