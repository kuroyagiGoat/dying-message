import { isSupabaseConfigured } from '../lib/supabase'
import './online-screen.css'

export type PlayMode = 'local' | 'online'

interface TitleScreenProps {
  onSelectMode: (mode: PlayMode) => void
}

export function TitleScreen({ onSelectMode }: TitleScreenProps) {
  return (
    <section className="online-screen">
      <h1 className="online-screen__title">ダイイングメッセージ</h1>
      <p className="online-screen__subtitle">遊び方を選んでください</p>

      <div className="online-screen__mode-list">
        <button
          type="button"
          className="online-screen__mode-card"
          onClick={() => onSelectMode('local')}
        >
          <span className="online-screen__mode-name">1台の端末で遊ぶ（ローカル）</span>
          <span className="online-screen__mode-desc">1台の端末を回しながらプレイします。</span>
        </button>

        <button
          type="button"
          className="online-screen__mode-card"
          onClick={() => onSelectMode('online')}
          disabled={!isSupabaseConfigured}
        >
          <span className="online-screen__mode-name">各端末で遊ぶ（オンライン）</span>
          <span className="online-screen__mode-desc">
            {isSupabaseConfigured
              ? 'ルームコードで部屋を作成・参加し、それぞれの端末でプレイします。'
              : 'Supabase の接続情報が未設定のため利用できません。'}
          </span>
        </button>
      </div>
    </section>
  )
}
