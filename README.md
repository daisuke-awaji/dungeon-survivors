# ダンジョンサバイバーズ

小学校高学年向けの、スマホで遊べるローグライク・サバイバーゲームです。ブラウザだけで動きます。

- 公開URL: https://daisuke-awaji.github.io/dungeon-survivors/
- 計画書: [docs/PLAN.md](docs/PLAN.md)

## あそびかた

- 画面をドラッグするとキャラクターが動きます。こうげきは自動です。
- てきをたおして経験値ジェムを集めるとレベルアップし、3つの中からスキルを1つ選べます。
- 5分間生き残ればクリア。最後に出てくるドラゴンをたおすと完全クリアです。
- 集めたコインで、次のプレイからずっと有効な強化やキャラクターを買えます。

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm run lint       # ESLint
npm run typecheck  # tsc
npm test           # Vitest
npm run build      # dist/ に出力
```

## 技術構成

- Phaser 3 + TypeScript + Vite
- 画像・音声ファイルは使わず、すべてコードで生成（Canvas 2D / Web Audio）
- セーブは localStorage。通信・広告・課金なし
- GitHub Actions で lint・テスト・ビルドを実行し、GitHub Pages にデプロイ

## ライセンス

MIT
