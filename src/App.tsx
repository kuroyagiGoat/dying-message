import { GameStateProvider, useGameState } from './hooks/useGameState'
import { SetupScreen } from './components/SetupScreen'
import { SecretCheckModal } from './components/SecretCheckModal'
import { MainGameScreen } from './components/MainGameScreen'

function GameRouter() {
  const { state } = useGameState()

  switch (state.phase) {
    case 'setup':
      return <SetupScreen />
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
  return (
    <GameStateProvider>
      <GameRouter />
    </GameStateProvider>
  )
}

export default App
