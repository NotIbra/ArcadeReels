import { useCallback, useEffect, useState } from 'react'
import BigWinOverlay from './components/BigWinOverlay'
import Splash from './components/Splash'
import { useFeedback } from './components/useFeedback'
import Feed from './feed/Feed'
import StatsScreen from './stats/StatsScreen'
import CoinCounter from './wallet/CoinCounter'
import WalletTestPage from './wallet/WalletTestPage'

function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

// A ?game=<id> link opens straight on that game, without the splash.
const deepLinkGame = new URLSearchParams(window.location.search).get('game')

export default function App() {
  const hash = useHash()
  const [statsOpen, setStatsOpen] = useState(false)
  const [splash, setSplash] = useState(!deepLinkGame)
  const closeStats = useCallback(() => setStatsOpen(false), [])
  useFeedback()
  if (hash === '#wallet-test') return <WalletTestPage />

  return (
    <>
      {/* The game behind the splash or the stats sheet stays paused. */}
      <Feed paused={statsOpen || splash} initialGameId={deepLinkGame} />
      <CoinCounter onOpenStats={() => setStatsOpen(true)} />
      <StatsScreen open={statsOpen} onClose={closeStats} />
      <BigWinOverlay />
      {splash && <Splash onDone={() => setSplash(false)} />}
    </>
  )
}
