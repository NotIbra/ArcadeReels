import { useEffect, useState } from 'react'
import Feed from './feed/Feed'
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

export default function App() {
  const hash = useHash()
  if (hash === '#wallet-test') return <WalletTestPage />

  return (
    <>
      <Feed />
      <CoinCounter />
    </>
  )
}
