import { useState } from 'react'
import { GameStateProvider, useGameState } from './hooks/useGameState'
import { SetupScreen } from './components/SetupScreen'
import { SecretCheckModal } from './components/SecretCheckModal'
import { MainGameScreen } from './components/MainGameScreen'
import { TitleScreen, type PlayMode } from './components/TitleScreen'
import { OnlineModeScreen } from './components/OnlineModeScreen'
import { isSupabaseConfigured } from './lib/supabase'
import { loadStoredSession } from './utils/onlineSessionStore'

function GameRouter({ onBackToTitle }: { onBackToTitle: () => void }) {
  const { state } = useGameState()

  switch (state.phase) {
    case 'setup':
      return <SetupScreen onBackToTitle={onBackToTitle} />
    case 'secret_check':
      return (
        <>
          <MainGameScreen />
          <SecretCheckModal />
        </>
      )
    case 'victim_hint':
    case 'deduction':
    case 'result':
    case 'gameover':
    case 'victory':
      return <MainGameScreen />
    default: {
      const _exhaustive: never = state.phase
      return <p>未知のフェーズ: {_exhaustive}</p>
    }
  }
}

function App() {
  const [mode, setMode] = useState<PlayMode | null>(() =>
    isSupabaseConfigured && loadStoredSession() ? 'online' : null,
  )
  const backToTitle = () => setMode(null)

  switch (mode) {
    case null:
      return <TitleScreen onSelectMode={setMode} />
    case 'local':
      return (
        <GameStateProvider>
          <GameRouter onBackToTitle={backToTitle} />
        </GameStateProvider>
      )
    case 'online':
      return <OnlineModeScreen onBackToTitle={backToTitle} />
  }
}

export default App
