# ダンジョンサバイバーズ

小学校高学年向けの、スマホで遊べるローグライク・サバイバーゲームです。ブラウザだけで動きます。

- 公開URL: https://daisuke-awaji.github.io/dungeon-survivors/
- 計画書: [docs/PLAN.md](docs/PLAN.md)

## あそびかた

- 画面をドラッグするとキャラクターが動きます。こうげきは自動です。
- てきをたおして経験値ジェムを集めるとレベルアップし、3つの中からスキルを1つ選べます。
- 5分間生き残ればクリア。最後に出てくるドラゴンをたおすと完全クリアです。
- 面1「ダンジョン」のドラゴンをたおすと、もっと強いてきが出る面2「氷のどうくつ」で遊べるようになります。
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

### ブラウザでの動作確認

ヘッドレス Chromium（`playwright-core`。このリポジトリの依存には入れていません）を使うスクリプトです。
先に `npm run build && npx vite preview --port 4173` を起動しておきます。

```bash
node scripts/smoke.mjs            # スマホ画面サイズで一通り操作し、shots/ に画面を保存
sh scripts/balance.sh 0.5 0 2     # 自動プレイ（うまさ 0〜1、永続強化レベル、回数）で難易度の目安を見る
STAGE=iceCave sh scripts/balance.sh 0.5 2 2   # 面2で同じことをする
```

### キャラクターの絵を作り直す

`art/source/` の5枚（マゼンタ背景）から1体ずつ切り抜き、`src/assets/sprites/` に書き出します。Python 3 と Pillow・numpy が必要です。
元の絵を作ったプロンプトは [art/PROMPTS.md](art/PROMPTS.md) にあります。

```bash
python3 scripts/art/cut.py
```

## 技術構成

- Phaser 3 + TypeScript + Vite
- キャラクター18体の絵は生成AIでかいたもの（`src/assets/sprites/`）。ほかの絵と効果音はコードで生成（Canvas 2D / Web Audio）
- セーブは localStorage。通信・広告・課金なし
- GitHub Actions で lint・テスト・ビルドを実行し、GitHub Pages にデプロイ

## ライセンス

MIT
