import type { Card, HintCard } from '../types/game'

export const OCCUPATION_CARDS: Card[] = [
  { id: 'occ-1', category: 'occupation', name: '医者' },
  { id: 'occ-2', category: 'occupation', name: '弁護士' },
  { id: 'occ-3', category: 'occupation', name: '料理人' },
  { id: 'occ-4', category: 'occupation', name: '美容師' },
  { id: 'occ-5', category: 'occupation', name: '記者' },
  { id: 'occ-6', category: 'occupation', name: '詩人' },
  { id: 'occ-7', category: 'occupation', name: '警察官' },
  { id: 'occ-8', category: 'occupation', name: 'アイドル' },
  { id: 'occ-9', category: 'occupation', name: '絵描き' },
  { id: 'occ-10', category: 'occupation', name: '麻薬仲介人' },
  { id: 'occ-11', category: 'occupation', name: '科学者' },
  { id: 'occ-12', category: 'occupation', name: '音楽家' },
  { id: 'occ-13', category: 'occupation', name: '殺し屋' },
  { id: 'occ-14', category: 'occupation', name: 'モデル' },
  { id: 'occ-15', category: 'occupation', name: '司令' },
  { id: 'occ-16', category: 'occupation', name: '映画監督' },
  { id: 'occ-17', category: 'occupation', name: 'ボクサー' },
  { id: 'occ-18', category: 'occupation', name: 'バーテンダー' },
  { id: 'occ-19', category: 'occupation', name: '野球選手' },
  { id: 'occ-20', category: 'occupation', name: '詐欺師' },
  { id: 'occ-21', category: 'occupation', name: '建築家' },
  { id: 'occ-22', category: 'occupation', name: '歌い手' },
  { id: 'occ-23', category: 'occupation', name: '警護員' },
]

export const WEAPON_CARDS: Card[] = [
  { id: 'wpn-1', category: 'weapon', name: '包丁' },
  { id: 'wpn-2', category: 'weapon', name: '植木鉢' },
  { id: 'wpn-3', category: 'weapon', name: '毒キノコ' },
  { id: 'wpn-4', category: 'weapon', name: 'ネクタイ' },
  { id: 'wpn-5', category: 'weapon', name: '買い物袋' },
  { id: 'wpn-6', category: 'weapon', name: '枕' },
  { id: 'wpn-7', category: 'weapon', name: 'ダイナマイト' },
  { id: 'wpn-8', category: 'weapon', name: '拳銃' },
  { id: 'wpn-9', category: 'weapon', name: 'コート' },
  { id: 'wpn-10', category: 'weapon', name: 'ケーブル' },
  { id: 'wpn-11', category: 'weapon', name: '縄跳び' },
  { id: 'wpn-12', category: 'weapon', name: '便器' },
  { id: 'wpn-13', category: 'weapon', name: 'レンガ' },
  { id: 'wpn-14', category: 'weapon', name: 'リュックサック' },
  { id: 'wpn-15', category: 'weapon', name: '洗濯機' },
  { id: 'wpn-16', category: 'weapon', name: '冷蔵庫' },
  { id: 'wpn-17', category: 'weapon', name: '金槌' },
  { id: 'wpn-18', category: 'weapon', name: 'ハサミ' },
  { id: 'wpn-19', category: 'weapon', name: '手斧' },
  { id: 'wpn-20', category: 'weapon', name: 'トロフィー' },
  { id: 'wpn-21', category: 'weapon', name: 'ゴミ箱' },
  { id: 'wpn-22', category: 'weapon', name: 'テディベア' },
  { id: 'wpn-23', category: 'weapon', name: 'ハイヒール' },
  
]

export const MOTIVE_CARDS: Card[] = [
  { id: 'mtv-1', category: 'motive', name: '脅かし' },
  { id: 'mtv-2', category: 'motive', name: '不倫' },
  { id: 'mtv-3', category: 'motive', name: '遺産' },
  { id: 'mtv-4', category: 'motive', name: '裏切り' },
  { id: 'mtv-5', category: 'motive', name: '借金' },
  { id: 'mtv-6', category: 'motive', name: 'ストーキング' },
  { id: 'mtv-7', category: 'motive', name: '妬み' },
  { id: 'mtv-8', category: 'motive', name: '盗み' },
  { id: 'mtv-9', category: 'motive', name: '戯れ' },
]

export const ALL_TOPIC_CARDS: Card[] = [
  ...OCCUPATION_CARDS,
  ...WEAPON_CARDS,
  ...MOTIVE_CARDS,
]


export const HINT_A_CARDS: HintCard[] = [
  // =========================================================
  // 【本家（新規リスト）にある単語】 (id: 1 〜 44)
  // =========================================================
  { id: 'hint-a-1', group: 'A', name: 'おおきい' },      // 本家
  { id: 'hint-a-2', group: 'A', name: 'あかるい' },      // 本家
  { id: 'hint-a-3', group: 'A', name: 'くらい' },        // 本家
  { id: 'hint-a-4', group: 'A', name: 'しんせつな' },    // 本家
  { id: 'hint-a-5', group: 'A', name: 'ふくざつな' },    // 本家
  { id: 'hint-a-6', group: 'A', name: 'げいじゅつてきな' }, // 本家
  { id: 'hint-a-7', group: 'A', name: 'みじかい' },      // 本家
  { id: 'hint-a-8', group: 'A', name: 'ちいさい' },      // 本家
  { id: 'hint-a-9', group: 'A', name: 'おもい' },        // 本家
  { id: 'hint-a-10', group: 'A', name: 'かるい' },       // 本家
  { id: 'hint-a-11', group: 'A', name: 'むずかしい' },   // 本家
  { id: 'hint-a-12', group: 'A', name: 'うつくしい' },   // 本家
  { id: 'hint-a-13', group: 'A', name: 'やすい' },       // 本家
  { id: 'hint-a-14', group: 'A', name: 'きたない' },     // 本家
  { id: 'hint-a-15', group: 'A', name: 'うるさい' },     // 本家
  { id: 'hint-a-16', group: 'A', name: 'やわらかな' },   // 本家
  { id: 'hint-a-17', group: 'A', name: 'くさい' },       // 本家
  { id: 'hint-a-18', group: 'A', name: 'かってな' },     // 本家
  { id: 'hint-a-19', group: 'A', name: 'ながい' },       // 本家
  { id: 'hint-a-20', group: 'A', name: 'おそい' },       // 本家
  { id: 'hint-a-21', group: 'A', name: 'おろかな' },     // 本家
  { id: 'hint-a-22', group: 'A', name: 'すくない' },     // 本家
  { id: 'hint-a-23', group: 'A', name: 'とうめいな' },   // 本家
  { id: 'hint-a-24', group: 'A', name: 'しずかな' },     // 本家
  { id: 'hint-a-25', group: 'A', name: 'かたい' },       // 本家
  { id: 'hint-a-26', group: 'A', name: 'たいくつな' },   // 本家
  { id: 'hint-a-27', group: 'A', name: 'しっかりした' }, // 本家
  { id: 'hint-a-28', group: 'A', name: 'おおい' },       // 本家
  { id: 'hint-a-29', group: 'A', name: 'たかい' },       // 本家
  { id: 'hint-a-30', group: 'A', name: 'つめたい' },     // 本家
  { id: 'hint-a-31', group: 'A', name: 'あたらしい' },   // 本家
  { id: 'hint-a-32', group: 'A', name: 'ふるい' },       // 本家
  { id: 'hint-a-33', group: 'A', name: 'あつい' },       // 本家
  { id: 'hint-a-34', group: 'A', name: 'うとい' },       // 本家
  { id: 'hint-a-35', group: 'A', name: 'ぜいたくな' },   // 本家
  { id: 'hint-a-36', group: 'A', name: 'かしこい' },     // 本家
  { id: 'hint-a-37', group: 'A', name: 'さびしい' },     // 本家
  { id: 'hint-a-38', group: 'A', name: 'ひくい' },     // 本家
  { id: 'hint-a-39', group: 'A', name: 'かすかな' },     // 本家
  { id: 'hint-a-40', group: 'A', name: 'じょうずな' },   // 本家
  { id: 'hint-a-41', group: 'A', name: 'じゅくれんした' }, // 本家
  { id: 'hint-a-42', group: 'A', name: 'たんなる' },     // 本家
  { id: 'hint-a-43', group: 'A', name: 'あわただしい' }, // 本家
  { id: 'hint-a-44', group: 'A', name: 'はやい' },       // 本家（新追加）

  // =========================================================
  // 【未定枠】 (id: 45)
  // ※全45個にするための残り1枠
  // =========================================================
  // { id: 'hint-a-45', group: 'A', name: 'ひくい' },
];

/** ヒント B群（表示はすべてひらがな） */
export const HINT_B_CARDS: HintCard[] = [
  // =========================================================
  // 【本家（新規リスト）にある単語】 (id: 1 〜 42)
  // ※新規リストにあった単語（全42種類）を優先して配置
  // =========================================================
  { id: 'hint-b-1', group: 'B', name: 'そくど' },        // 本家
  { id: 'hint-b-2', group: 'B', name: 'そうおん' },      // 本家
  { id: 'hint-b-3', group: 'B', name: 'ふゆ' },          // 本家
  { id: 'hint-b-4', group: 'B', name: 'つき' },          // 本家
  { id: 'hint-b-5', group: 'B', name: 'からだ' },        // 本家
  { id: 'hint-b-6', group: 'B', name: 'じかん' },        // 本家
  { id: 'hint-b-7', group: 'B', name: 'くうかん' },      // 本家
  { id: 'hint-b-8', group: 'B', name: 'うみ' },          // 本家
  { id: 'hint-b-9', group: 'B', name: 'きまり' },        // 本家
  { id: 'hint-b-10', group: 'B', name: 'えん' },         // 本家
  { id: 'hint-b-11', group: 'B', name: 'あせ' },         // 本家
  { id: 'hint-b-12', group: 'B', name: 'きんぞく' },     // 本家
  { id: 'hint-b-13', group: 'B', name: 'おもいで' },     // 本家
  { id: 'hint-b-14', group: 'B', name: 'さんかくけい' }, // 本家
  { id: 'hint-b-15', group: 'B', name: 'はなし' },       // 本家
  { id: 'hint-b-16', group: 'B', name: 'きょくせん' },   // 本家
  { id: 'hint-b-17', group: 'B', name: 'くち' },         // 本家
  { id: 'hint-b-18', group: 'B', name: 'あし' },         // 本家
  { id: 'hint-b-19', group: 'B', name: 'ひる' },         // 本家
  { id: 'hint-b-20', group: 'B', name: 'あっぱく' },     // 本家
  { id: 'hint-b-21', group: 'B', name: 'はな' },         // 本家
  { id: 'hint-b-22', group: 'B', name: 'くるしみ' },     // 本家
  { id: 'hint-b-23', group: 'B', name: 'くらし' },       // 本家
  { id: 'hint-b-24', group: 'B', name: 'しかくけい' },   // 本家
  { id: 'hint-b-25', group: 'B', name: 'なつ' },         // 本家
  { id: 'hint-b-26', group: 'B', name: 'あたま' },       // 本家
  { id: 'hint-b-27', group: 'B', name: 'ぎじゅつ' },     // 本家
  { id: 'hint-b-28', group: 'B', name: 'ちょくせん' },   // 本家
  { id: 'hint-b-29', group: 'B', name: 'じゆう' },       // 本家
  { id: 'hint-b-30', group: 'B', name: 'しんどう' },     // 本家
  { id: 'hint-b-31', group: 'B', name: 'き' },           // 本家
  { id: 'hint-b-32', group: 'B', name: 'うで' },         // 本家
  { id: 'hint-b-33', group: 'B', name: 'さわり' },       // 本家
  { id: 'hint-b-34', group: 'B', name: 'め' },           // 本家
  { id: 'hint-b-35', group: 'B', name: 'ほし' },         // 本家
  { id: 'hint-b-36', group: 'B', name: 'よる' },         // 本家
  { id: 'hint-b-37', group: 'B', name: 'かんけい' },     // 本家
  { id: 'hint-b-38', group: 'B', name: 'ち' },           // 本家
  { id: 'hint-b-39', group: 'B', name: 'かわき' },       // 本家
  { id: 'hint-b-40', group: 'B', name: 'あじ' },         // 本家
  { id: 'hint-b-41', group: 'B', name: 'ぐうすう' },     // 本家
  { id: 'hint-b-42', group: 'B', name: 'きすう' },       // 本家
  { id: 'hint-b-43', group: 'B', name: 'はし' },         // 本家
  { id: 'hint-b-44', group: 'B', name: 'れいせい' },       // 本家

  // =========================================================
  // 【既存のみにあった単語（45個埋め用補完）】 (id: 43 〜 45)
  // ※45個にするため既存リストから使いやすい概念・図形語を追加
  // =========================================================
  
  { id: 'hint-b-45', group: 'B', name: 'あさ' },         // 既存のみ
];

export const ALL_HINT_CARDS: HintCard[] = [...HINT_A_CARDS, ...HINT_B_CARDS]
