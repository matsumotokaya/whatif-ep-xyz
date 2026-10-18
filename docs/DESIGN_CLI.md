# AI下書きCLI — AIと人間が同じレイヤー付きデザインを編集する

最終更新: 2026-10-18

AIが本人のアカウントでレイヤー付きの下書き（`public.banners`）を作り、人間が通常のエディタ `/edit/{id}` で同じ下書きを開いて仕上げる経路。読み取り専用の Ref Library（[REF_LIBRARY.md](./REF_LIBRARY.md)）に対する、書き込み側の正本。

- 実装: [scripts/design.mjs](../scripts/design.mjs)（CLI）、[scripts/lib/design-draft.mjs](../scripts/lib/design-draft.mjs)（保存・revision・プレビュー確定）、[src/components/editor/RenderBridge.tsx](../src/components/editor/RenderBridge.tsx)（描画ブリッジ `/edit/render`）
- 背景の依頼: [MCP_CONSUMER_FEEDBACK.md](./MCP_CONSUMER_FEEDBACK.md) 2026-10-18 節

## 設計の要点

| 論点 | 決定 | 理由 |
|---|---|---|
| 認証 | 本人の Supabase セッション（RLS ＋ `auth.uid()` のRPC ＋ ユーザー別の `r2-presign`） | エディタと同じ権限境界。所有者はトークンからだけ決まり、CLIの入力では指定できない。service role は使わない |
| 経路 | ローカルCLI。`/api/mcp` は読み取り専用・認証なしのまま | 公開Refを匿名書き込みに広げない。トークン配布と書き込みMCPは「今後」 |
| 文書形式 | エディタの `CanvasElement[]` をそのまま使う（`types/template.ts`）。正規化はエディタの `migrateElements` | 独自JSONを並立させない |
| 描画 | エディタ／Content Factory と同じ `renderBannerPreviewAssets` を、ヘッドレス Chromium で `/edit/render` 上で実行 | 別レンダラを作らない。人間がエディタで見る絵と一致する |
| プレビュー確定 | エディタの `batchSave` と同じ手順。revision入りの不変キーへアップロードし、`finalize_banner_preview` で同じrevisionのときだけ確定する。失敗時は `fail_banner_preview` を呼ぶ | ready は「その revision の画像がある」ときだけ |
| 重複防止 | 下書きIDは `uuidV5(ユーザーID, --key)`、素材IDは `uuidV5(ユーザーID, sha256)` | 再試行しても同じ行・同じキーになる |
| 競合 | `update` は `document_revision = 読んだ値` を条件に UPDATE する（CAS）。0行なら競合として止まる | 人間の新しい保存を古い状態で上書きしない |

`update` の列への効果は `save_banner_document` と同じ（revisionを+1、preview を pending）。RPCに期待revisionの引数が無いため、CLIは同じ UPDATE を条件付きで発行している。

## 前提

- 接続先は BANALIST（`https://rgqduwojvylkulhyodqg.supabase.co`）。`.env.local` の `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を読み、URLが完全一致しなければ止まる
- 描画ブリッジ: 既定は `http://localhost:3710/edit/render`（`npm run dev`）。開発サーバーを起動しない場合は、`WHATIF_RENDER_BASE_URL=https://whatif-ep.xyz` で本番の `/edit/render` を使う（2026-10-18 デプロイ済み・ドライランで確認）。ローカルで描画処理を変えたときは、その変更を反映した開発サーバーで描く。ブリッジは資格情報もデータも持たず、渡された文書を描いて JPEG を返すだけ
- Chromium は `@playwright/test` のものを使う

### ログイン（本人が一度だけ、ターミナルで）

```sh
npm run design -- login            # メールとパスワード（入力は表示されない）
npm run design -- login --otp      # メールに届くコードで入る（パスワードの無いGoogleログインのアカウント向け。メールのテンプレートにコードが必要）
npm run design -- whoami
```

セッションは `~/.config/whatif/design-session.json`（0600）に保存され、期限が切れると refresh token で更新される。`npm run design -- logout` で消す。AIにパスワードやトークンを渡さない。短命トークンを環境変数 `WHATIF_USER_ACCESS_TOKEN` で渡す方法も使える（壁紙CLIと同じ）。

## 使い方

```sh
npm run design -- presets                                   # エディタのサイズプリセット
npm run design -- create --doc draft.json --key <一意キー> --preview /tmp/p.jpg          # 検証＋ローカルプレビューのみ（書き込みなし）
npm run design -- create --doc draft.json --key <一意キー> --preview /tmp/p.jpg --apply  # 素材登録・下書き作成・プレビュー確定
npm run design -- get <id> --out current.json               # 人間の変更後の最新版を取得（documentRevision つき）
npm run design -- update <id> --doc current.json --preview /tmp/p.jpg --apply           # 取得した版に対する変更だけを書く
npm run design -- render <id> --preview /tmp/p.jpg          # 現在の revision を描いて full-res を確定（人間の保存後など）
npm run design -- status <id>                               # revision・プレビュー状態・full-res の実寸
```

`--apply` を付けない `create` と `update` は、何も書き込まない。ローカルの画像は data URL として描画ブリッジに渡し、エディタと同じ描画で `--preview` に書き出す。

### 文書ファイル

```jsonc
{
  "name": "EPISODE 0402-1 まだ温かい YouTube Thumbnail",
  "work": { "series": "episode", "number": 402, "variant": 1 },   // 任意。登録する素材に作品を紐付ける
  "preset": "yt-thumb",                     // または "template": { "width": 1920, "height": 1080 }
  "canvasColor": "#1a1030",
  "elements": [                             // 0番が最背面、最後が最前面
    { "id": "bg", "type": "image", "src": "file:/abs/path/sky.png", "assetRole": "background",
      "x": 0, "y": 0, "width": 1920, "height": 1080 },
    { "id": "title", "type": "text", "text": "まだ温かい", "x": 110, "y": 300,
      "fontSize": 170, "fontFamily": "Noto Serif JP", "fontWeight": 900, "fill": "#ffffff", "letterSpacing": 6 }
  ]
}
```

- 画像の `src` には次のどれかを指定する。`--apply` の時点で、ローカルファイルは本人のアップロード素材として登録され、キーに置き換わる。
  - `file:` のローカルファイル
  - 既存の素材キー（`user-images/{uid}/…`、`default-images/…`）。公式素材は Ref の `list_assets` で探す
  - 外部 URL
- 登録先は次のとおり。エディタのアップロードタブに表示される。同じ内容は再登録しない。
  - 原画: `user-images/{uid}/uploads/{id}.{ext}`
  - 400px のサムネイル
  - `user_images`（`source_context='automation'`）の行
- `assetRole` は登録時の分類にだけ使う。透過があれば `character_cutout`、無ければ `background` が既定。要素には保存されない。
- `get --out` の出力には `documentRevision` が入る。そのファイルを直して `update` に渡す。

## 共同編集の手順と制限

1. AIが `create --apply` し、返ってきた `editUrl` を人間に渡す。
2. 人間はログイン済みのブラウザで `editUrl` を開き、調整して保存する（自動保存。離脱時に full-res も更新される）。
3. AIは `get --out` で最新版を取り直してから `update` する。古いファイルで `update` すると `conflict` で止まり、何も書かない。
4. 最終画像は `status` で確認する。`fullres: "ready"` は `preview_revision == document_revision` かつ画像があることを意味する。`stale` / `missing` / `failed` のときは `render` で生成し直す。`measured` は、実際に取得した画像の実寸。

制限（2026-10-18時点）:

- **エディタを開いたままのタブは、AIの更新を検知しない。** エディタは開いている間ローカルの状態を保ち、次の自動保存で丸ごと保存する（`BannerEditor.tsx`）。AIが `update` するのは、人間がその下書きを閉じている間に限る。エディタ側の revision 確認は今後の課題。
- フォントはエディタが読み込む Google Fonts（Noto Sans JP、Noto Serif JP、Bebas Neue ほか。`lib/fonts.ts`）と、システムフォントだけが使える。描画できなかったフォントは `unresolvedFonts` に出る。`fontWeight` は Konva の `fontStyle` に丸められる（700以上は bold = 700、300以下は lighter）。
- 文書にはクロップもレイヤー名も無い。テキストには幅の枠が無い（`\n` で改行する）。効果は影・ぼかし（画像）・線だけ。
- full-res は JPEG（品質 0.88）で、ドキュメント寸法ちょうどの大きさになる。PNG 出力は Ref の「今後」を参照。

## 検証記録

- 2026-10-18: 単体テスト（`scripts/lib/design-draft.test.mjs`）と全テストが通過した。EP0402 の素材で、書き込みなしのプレビュー（1920×1080）を目視で確認した。
- 同じ確認の中で、既存の描画処理の不具合を2件直した。
  - `resolveElementSrc` が data:/blob: に `?v=` を付けて壊していた（`src/lib/asset.ts`）。
  - 文字の Web フォントを、空白1文字ぶんのサブセットだけ・数値ウェイトのまま読み込んでいた。日本語と太字が既定フォントにフォールバックしていた（`bannerPreviewRenderer.ts`）。
- 2026-10-18 適用: 管理者アカウント（Google/Apple SSO、`login --otp` でメールのコードによりログイン）で EP0402 の横長下書き `610fb4e2-…`（1920×1080）を作成した。
  - 同じ `--key` で再実行しても重複しなかった。古い revision での `update` は `conflict` で止まり、何も書かなかった。
  - ユーザーがエディタで調整・保存した版（rev27）を `get` で読み戻した。エディタが作った同じ revision の full-res が ready で、実寸 1920×1080 だった。
  - その版をもとに縦カバー `a5f4fb01-…`（1080×1920）を作成した。登録済みの素材キーを再利用し、ready を実寸で確認した。
  - 公開 MCP の `get_design` でも `previewStatus: ready` / `stale: false` / `url` ありを確認した。記録は制作側の `2026-10-17_mada-atatakai-mv/release/asset-sources.json`。
