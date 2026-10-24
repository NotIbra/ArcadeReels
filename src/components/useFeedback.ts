import { useEffect } from 'react'
import { useWallet } from '../wallet/walletStore'
import { HAPTICS, playSound, unlockAudio, useSound, vibrate } from './feedback'

/**
 * App-wide sound + haptics, driven by the wallet so every game gets them without extra code:
 * a bet (placeBet) plays "spin", a recorded win/loss plays "win"/"lose".
 */
export function useFeedback() {
  useEffect(() => {
    const unsubscribe = useWallet.subscribe((s, prev) => {
      const last = s.history[s.history.length - 1]
      const prevLast = prev.history[prev.history.length - 1]
      if (last && last !== prevLast) {
        if (last.won) {
          playSound('win')
          vibrate(s.bigWin && s.bigWin !== prev.bigWin ? HAPTICS.bigWin : HAPTICS.win)
        } else {
          playSound('lose')
          vibrate(HAPTICS.lose)
        }
      } else if (s.coins < prev.coins && s.history === prev.history) {
        playSound('spin')
        vibrate(HAPTICS.bet)
      }
    })

    // If sound was left on last visit, start audio on the first tap (browsers block it before that).
    const onFirstTap = () => {
      if (!useSound.getState().muted) void unlockAudio()
    }
    window.addEventListener('pointerdown', onFirstTap, { once: true })

    return () => {
      unsubscribe()
      window.removeEventListener('pointerdown', onFirstTap)
    }
  }, [])
}
