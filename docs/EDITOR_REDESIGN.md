# EDITOR_REDESIGN.md — エディタ再設計（安定化 + モバイル「ストーリーズモード」）

作成: 2026-07-04 / 最終更新: 2026-07-05
Status: **E0・E1a・E1b 完了（実装中）。次の起点は §6。**
対象: `src/components/editor/`（統合済みエディタ、119ファイル）
ブランチ: `editor/e0-stability`（origin へ push 済み。未マージ = 本番未反映）
関連: [CONSOLIDATION_PLAN.md](CONSOLIDATION_PLAN.md)（M5/M6は本計画とは独立）/ [PRODUCT_ROADMAP.md](PRODUCT_ROADMAP.md)

---

## 0. 進捗と次セッションの起点（2026-07-05 更新）

> **次に着手すること = §6「E1c 残り」の Konva commit 集約から。** 続けて E2（モバイル・ストーリーズモード）へ。

### 完了済み（ブランチ `editor/e0-stability`・すべて push 済み）

| MS | commit | 内容 | 検証 |
|----|--------|------|------|
| **E0** | `f460b6f` | Canvas単一マウント化 / セーブキュー直列化(`utils/saveQueue.ts`) / batchSave単一update化 / プレビュー生成イベント駆動化 | build緑・Opus差分レビュー済・Vercelプレビューで実機確認済（画像表示OK） |
| **E1a** | `a720e1b` | vitest導入(リポジトリ初テスト) / 読込時migrationを純関数`utils/elementMigration.ts`へバイト一致抽出 / `CURRENT_SCHEMA_VERSION`定数 | build緑・test 10件 |
| **E1b** | `5ccddb1` | 純関数コマンドreducer`utils/documentCommands.ts` / undo/redoをJSONディープクローン→**構造共有+coalesce**化(`hooks/useHistory.ts`書換) / `useElementOperations`を薄いラッパー化 | build緑・test 39件・Opus構造共有安全性レビュー済 |

- テストは `npm test`（vitest run）。純粋ロジックのみ対象（コンポーネント挙動テストは無し＝回帰は手動E2Eで確認する方針）。
- **本番未反映**。プレビューで確認 → 良ければ `main` にマージ、が今後の流れ。

### E1c で見送りを決めた判断（重要・蒸し返さない）

- **ミラーstate廃止（selectedFont等6state）は見送り**。精査の結果これは単なるミラーではなく「次に追加する新規テキストの sticky default」を兼ねており（`BannerEditor.tsx` handleFontChange 系 + handleAddText）、単純に選択要素から derive に置換すると**新規テキストの既定値継承が壊れる**。低価値・挙動変更リスク大のため E1 ではやらない。必要なら E2 のモバイルテキスト編集フロー設計時に、意図的な仕様として作り直す。

### 環境・運用メモ（次セッションで役立つ）

- **Vercelプレビューで画像が枠だけ = R2 CORS×CDNキャッシュ**。R2 `whatif-assets` の CORS AllowedOrigins に `https://*.vercel.app` を追加済み。ただし**CORS修正前にキャッシュされた ACAO 無しレスポンス**が Cloudflare に残ると枠だけになるので、その場合は Cloudflare で**キャッシュパージ**（`whatif-ep.xyz` ゾーン → Purge Everything）。R2は `Vary: Origin` を返すので新規プレビューは以後自動で正しくキャッシュされ再発しない。
- **Cloudflare MCP をユーザースコープで登録済み**（`cloudflare: https://mcp.cloudflare.com/mcp`、全プロジェクト共通）。ただし `Needs authentication`。対話セッションで `/mcp` → cloudflare を認証すれば、次回から Claude がキャッシュパージ等を直接実行可能。
- プレビュー確認URL例: `https://whatif-ep-<hash>-kaya-matsumotos-projects.vercel.app/edit?template=<id>`
- dev: `npm run dev`（http://localhost:3710、スマホ実機は同一LANの `http://<PCのIP>:3710`）。

---

## 1. 背景と目的

統合後のエディタには2つの構造課題がある。

1. **安定性が低い** — 状態管理・保存パス・プレビュー生成に構造的なrace/不定動作の温床がある（§3）。
2. **モバイル操作性が悪い** — デスクトップの自由キャンバスUIをそのまま縮めており、現状は「PC推奨」モーダルで免責している状態。モバイルユーザーは多いのに、実質使い物にならない。

方針（2026-07-04 ユーザー決定）:

- モバイルは**ゼロベースで再設計**する。デスクトップUIの移植ではなく、**Instagramストーリーズ級の制約付き編集**に絞る。
  - できること: テキストの差し替え・編集、要素の移動、スタンプ感覚のライブラリ画像配置、背景変更、エフェクト（プリセット）
  - できないこと（デスクトップ専用のまま）: 精密な数値指定、複数選択、レイヤー詳細操作、テンプレート制作、Admin/Content Factory
- 安定化（ドキュメントモデルの立て直し）とモバイル再設計は**同じ工事**として進める。編集操作をコマンド化した土台の上にモバイルUIを載せる。
- 旧IMAGINE（`imagine/` リポジトリ）のクリーニング、統合M5/M6は**本計画のスコープ外**。

---

## 2. 現状調査サマリ（2026-07-04 実施）

### 2.1 統合の現状

- Gallery+IMAGINE統合は **M1〜M4完了・mainマージ済み・本番カットオーバー済み（2026-07-03）**。エディタ本体は `src/components/editor/` にある。
- 旧 `imagine/` リポジトリと統合版はほぼverbatimコピー（行番号まで一致）。**本計画の作業対象は統合版のみ**。旧リポジトリには手を入れない（M6で凍結予定）。

### 2.2 安定性リスク Top 5（監査結果）

| # | リスク | 根拠 |
|---|--------|------|
| 1 | **Canvas二重マウント + ref共有** — デスクトップ用(`hidden md:flex`)とモバイル用(`flex md:hidden`)の両ツリーが常時マウントされ、2つのKonva Stageが**同じ `canvasRef` を取り合う**。export/サムネ生成が非表示側Stageを掴み得る不定動作＋メモリ二重消費 | `pages/BannerEditor.tsx:1679,1799` |
| 2 | **保存経路の競合** — autosave(3s) / guest(1s) / immediateSave / beforeunload / 読込時migration / 離脱時save が**直列化ガードなしで並走**。`batchSave` は1論理保存を最大3回のupdateに分割発行（部分書き込み・順序逆転の余地） | `BannerEditor.tsx:680-793`, `utils/bannerStorage.ts:345-446` |
| 3 | **プレビュー資産が離脱時のみ・時間依存生成** — thumbnail/fullres は `performSave(true)` を呼ぶ離脱時のみ生成。生成は `setTimeout(100ms)` 待ちハック。クラッシュ/リロードで欠落し、Content Factoryのproduction出力（fullres依存）に波及 | `BannerEditor.tsx:567-590,1568`, `utils/productionOutputBuilder.ts:159` |
| 4 | **バージョニング無きドキュメントモデル** — `CanvasElement` に schemaVersion なし。migrationは読込時useEffectにハードコードされ、オープンごとに書き込みが走り得る。冪等性・追跡性なし | `types/template.ts`, `BannerEditor.tsx:453-514` |
| 5 | **undo/redoの全スナップショット + 巨大コンポーネント** — 1px移動でも elements 全体をディープクローンして履歴push（上限50段）。autosaveは毎レンダー `JSON.stringify` 全比較。BannerEditor は1943行・useState約30・useEffect13・handler66 | `hooks/useHistory.ts:15-35`, `BannerEditor.tsx:704` |

状態の同一データが最大5重に存在する: Konvaノード内部状態 / React state `elements` / history スナップショット / React Query キャッシュ / DB JSONB。同期はすべて手動。

### 2.3 モバイル対応の現状

**既にある資産（流用する）**:

- `MobileToolbar.tsx` — Tool/Layer 2タブ + ドロワー（テキスト・シェイプ・画像・背景色・レイヤー操作）
- `MobileSheet.tsx` — iOS風detent付きボトムシート（peek/0.6/0.9、safe-area対応）
- `PropertyPanel` の `isMobile` モード
- ピンチズーム（`useZoomControl.ts:77-131`）、1本指パン、タップ選択、ピンチ中のドラッグ誤爆防止
- viewport/PWAメタ（ブラウザズーム無効化済み）

**決定的な弱点（再設計で解消する）**:

| 問題 | 実装根拠 |
|------|---------|
| Transformerハンドルが8–10px — 指では実質操作不能 | `components/Canvas.tsx:1091,1117` |
| 回転スナップがShiftキー前提 — モバイルで不可 | `Canvas.tsx:1100` |
| 複数選択・投げ縄がマウスイベント専用 | `Canvas.tsx:818-931` |
| テキスト編集textareaが `visualViewport` 未考慮 — ソフトキーボードで位置ずれ/隠れ | `Canvas.tsx:616-703` |
| 「PC推奨」モーダルで免責 — 幅<768px判定・機能ブロックなし | `components/DesktopRecommendedModal.tsx`, `BannerEditor.tsx:154-161` |

つまり現状は「デスクトップと同じ自由キャンバス操作をモバイルにも許した上で、操作不能なUIを警告モーダルで免責」している。

---

## 3. あるべき姿（To-Be）

### 3.1 設計原則

1. **1つのドキュメントモデル、2つのビュー** — Desktop = Studio（自由キャンバス、現行機能を維持）/ Mobile = ストーリーズモード（制約付き編集）。無理に1UIで両対応しない。
2. **ドキュメントモデルをレンダラーから分離** — バージョン付き正規化スキーマを唯一の正とし、Konvaは純粋な描画層に格下げ。
3. **全編集はコマンド経由** — 状態変更は純関数reducerを通る単一経路のみ。undo/redo・自動保存・モバイルの制約UIはすべてこの上に載る。
4. **保存は単一の直列キュー** — in-flightガード + リビジョン番号。プレビュー生成は保存パイプラインの一部（イベント駆動、setTimeout禁止）。
5. **プレビューと書き出しは同一レンダリングパス**（現状も同一。これを維持する制約として明文化）。
6. **モバイルの制約は品質保証** — 選択肢を減らすことがユーザー体験。フリーパラメータではなくプリセット（S/M/L、配色パターン、エフェクトプリセット）。

### 3.2 コアアーキテクチャ（Document Model v2）

```
┌─────────────────────────────────────────────┐
│ Document (schemaVersion付き正規化JSON)         │  ← 唯一の正
├─────────────────────────────────────────────┤
│ Command Layer (dispatch → pure reducer)      │  ← 全編集の単一経路
│  - undo/redo: コマンド履歴（連続操作はcoalesce）│
│  - autosave: コマンドcommitにフック            │
├─────────────────────────────────────────────┤
│ Save Queue (直列化・revision付き・単一update)  │
│  - preview生成をパイプラインに内包（描画完了イベント駆動）│
├──────────────────────┬──────────────────────┤
│ Studio View (Desktop) │ Stories View (Mobile) │  ← Canvasは単一マウント
│  Konva自由キャンバス    │  制約付き編集UI        │
└──────────────────────┴──────────────────────┘
```

具体的な変更点:

- `types/template.ts` に `schemaVersion` を導入。migrationは独立モジュール（純関数・冪等・バージョン順適用）に隔離し、読込時useEffectハードコードを撤去。
- `BannerEditor.tsx`（1943行）を解体: 状態＋コマンド層（hooks）/ Studio シェル / Stories シェル / 共有Canvas に分割。
- Konva→React の commit 点（`node.scaleX()` 読み出し等）を1モジュールに集約。Star/Circle の座標変換散在を解消。
- 選択テキスト属性のミラーstate（selectedFont等6個）を廃止し、選択要素からのderive に変更。
- Canvas単一マウント化（レイアウトのみレスポンシブ切替）。
- **Konvaは維持する**（描画エンジン差し替えはリスク過大でリターン薄。分離だけ行い、差し替え可能性は結果として残る）。

### 3.3 モバイル「ストーリーズモード」インタラクション仕様

発動: 画面幅 <768px（現行判定を踏襲）。`DesktopRecommendedModal` は**廃止**（免責ではなく専用モードを提供するため）。

**基本レイアウト**:

```
┌──────────────────┐
│ ✕        ↩  完了  │ ← 上部バー（閉じる/undo/保存）
│                  │
│   キャンバス       │ ← 常に全体フィット表示
│   (fit-to-screen) │    キャンバス自体のズーム/パンなし
│                  │
├──────────────────┤
│ [Aa] [🖼] [🎨] [✨] │ ← 追加系: テキスト/スタンプ/背景/エフェクト
└──────────────────┘
```

**操作モデル（Instagramストーリーズ準拠）**:

| 操作 | ジェスチャ | 備考 |
|------|-----------|------|
| 選択 | 要素をタップ | 選択枠表示（ハンドルなし） |
| 移動 | 選択要素をドラッグ | 中央/端スナップガイド表示 |
| 拡大縮小・回転 | 要素上で2本指ピンチ/ツイスト | **Transformerハンドル廃止**。回転は0°/90°に自動スナップ |
| テキスト編集 | テキストをタップ | **全画面編集モード**へ遷移（下記） |
| 削除 | 選択中に表示される削除ボタン、またはドラッグで画面下部のゴミ箱へ | IG方式 |
| 前後関係 | 選択中チップの「前へ/後ろへ」 | レイヤーパネルは出さない |

**全画面テキスト編集モード**（キーボードと共存させる唯一の方法）:

- 暗転オーバーレイ + 中央にテキスト入力（`visualViewport` でキーボード上に配置）
- キーボード上部にフォントカルーセル・カラースウォッチ・サイズ S/M/L
- 右上「完了」で確定。キャンバス上のインラインtextareaオーバーレイ（`Canvas.tsx:616-703`）はモバイルでは使わない

**追加系（下部ボタン → ボトムシート、`MobileSheet` 流用）**:

- **Aa テキスト**: タップで即・全画面テキスト編集モードへ（配置は中央、後でドラッグ）
- **🖼 スタンプ**: 画像ライブラリをステッカーシート（グリッド）で表示 → タップで中央配置。既存のプレミアムガードを踏襲
- **🎨 背景**: 背景色をプリセットスウォッチから選択（カラーピッカーは出さない）
- **✨ エフェクト**: 選択要素へのプリセット適用（影 なし/弱/強 等）。数値スライダーは出さない

**モバイルで出さない機能**: 複数選択・投げ縄、数値指定（座標/px/letter-spacing等）、シェイプ追加（当面）、レイヤーパネル、テンプレート保存、Admin/Content Factory（デスクトップ誘導）。

**テンプレート作者側の制御**: 既存の `locked` フラグを活用し、テンプレートの背景・ロゴ等を作者がロック → モバイルユーザーはタップしても選択されず、壊せない。将来「編集可能スロット」へ発展させる場合もこのフラグが土台になる。

**権限まわり**: ゲスト/free/premium のガード・export権限は PRODUCT_ROADMAP の4層ラダーに従う（本計画では変更しない。ただし handleExport の権限分岐欠如はロードマップ側の課題として認識済み）。

---

## 4. マイルストーン

依存順: **E0 → E1 → E2 → E3 → E4**（E0は独立クイックウィン。E2以降はE1のコマンド層が前提）。
サイズ目安: S=1セッション / M=1–2 / L=2–3。

### E0 — 安定化クイックウィン（S）

再設計を待たずに直せる不定動作の根治。

- [ ] Canvas単一マウント化（`canvasRef` 取り合いの解消）— レイアウト切替はCanvasの外側だけで行う
- [ ] 保存の直列化: 単一セーブキュー（in-flightガード + 後着優先のcoalesce + revision番号）。`batchSave` の複数update分割を単一updateに
- [ ] プレビュー生成のイベント駆動化（Konva描画完了後に生成、`setTimeout` 撤去）＋ 生成タイミングを「離脱時のみ」から「保存パイプライン内（debounce付き）」へ
- **Done基準**: export/サムネが常に表示中Stageから生成される。保存の並走が構造的に不可能。リロードしてもサムネ/fullresが欠落しない

### E1 — Document Model v2 + コマンド層（L）

- [ ] `schemaVersion` 導入 + migrationモジュール分離（純関数・冪等・バージョン順）。読込時useEffectのインラインmigration撤去
- [ ] コマンドdispatch + 純関数reducerへ全編集操作を移行（`useElementOperations` 置換）
- [ ] undo/redoをコマンド履歴ベースに（ドラッグ/連打はcoalesceで1エントリ、全体ディープクローン廃止）
- [ ] 選択テキスト属性ミラーstate廃止（deriveへ）
- [ ] Konva→React commit点の一元化（座標変換含む）
- [ ] `BannerEditor.tsx` 解体（状態コア / Studioシェル / 共有Canvas に分割。目安: 1ファイル500行以下）
- **Done基準**: 全編集がdispatch経由。既存デスクトップ機能の回帰なし（保存・export・Content Factory出力のE2E確認）。undo/redoの粒度が操作単位

### E2 — ストーリーズモード MVP（L）

モバイルの基本操作を差し替える。スコープ: **テキスト差し替え・移動・拡大縮小回転・削除**。

- [ ] <768px でストーリーズモード起動、`DesktopRecommendedModal` 廃止
- [ ] fit-to-screenキャンバス（モバイルのキャンバスズーム/パン廃止）
- [ ] タップ選択 + ドラッグ移動 + スナップガイド
- [ ] 要素上2本指ピンチ/ツイストで拡大縮小・回転（Transformerハンドルはモバイル非表示、回転0°/90°スナップ）
- [ ] 全画面テキスト編集モード（`visualViewport` 対応、フォントカルーセル・色・S/M/L）
- [ ] 削除（選択中ボタン + ゴミ箱ドロップ）・前後チップ
- [ ] `locked` 要素はタップ選択不可
- **Done基準**: 実機（iOS Safari / Android Chrome）で「テンプレを開いて文言を差し替え、位置調整して保存・export」が警告モーダルなしで完了できる

### E3 — スタンプ・背景・エフェクト（M）

- [ ] ステッカーシート（画像ライブラリのグリッドUI、`MobileSheet` 流用、プレミアムガード踏襲）
- [ ] 背景プリセットスウォッチ
- [ ] エフェクトプリセット（影 なし/弱/強 から開始）
- **Done基準**: ストーリーズ感覚で「スタンプを貼る・背景を変える・影をつける」が完結する

### E4 — 磨き込み・計測（M）

- [ ] ジェスチャ調整（実機での誤操作つぶし、ハプティクス的フィードバック）
- [ ] `alert()` 撤去 → トースト化、本番 `console.*` 掃除
- [ ] モバイル利用の計測イベント（どの操作が使われるか → E3以降の優先度判断材料）
- [ ] 実機QAパス（safe-area、キーボード、回転）
- **Done基準**: モバイル導線（Gallery「イラストを編集」→ 編集 → 保存/export）の実機E2Eが安定

### スコープ外（別トラック）

- 統合M5（URL/データ移行・301）/ M6（旧IMAGINE凍結・リポジトリクリーニング）
- アセット参照再設計の残バックフィル（default-images / user-images）
- 権限ラダー変更（PRODUCT_ROADMAP Phase 1側）
- 編集可能スロット方式への本格移行（E2の `locked` 活用を土台に、必要になったら別計画で）

---

## 5. 検証方法

- 実機テスト: `npm run dev`（port 3710）にLAN経由でスマホから接続して確認
- E1完了時の回帰確認: デスクトップの 保存 / undo / export / テンプレ保存 / Content Factory publish をE2Eで通す
- 各マイルストーンのDone基準を満たしてから次へ進む

---

## 6. 残タスクとロードマップ（次セッションはここから）

### いま最初にやること: E1c 残り = Konva→React commit 集約（S・低リスク）

E1c のうち「ミラーstate廃止」は §0 の通り**見送り確定**。「大規模ファイル分割」は §3.1 の方針通り **E2 のモバイルビュー切り出しの中で自然に行う**（単独の churn は避ける）。よって E1c で単独実施するのは **Konva commit 集約のみ**。

- **対象**: `src/components/editor/components/Canvas.tsx` の変形/ドラッグ確定ロジック（`node.scaleX()/width()/rotation()` 等を読み、scale を width に畳み込んで `onElementUpdate`/`onElementsUpdate` でコミットする箇所。旧監査で ~520-560 付近）。Star/Circle の中心↔左上座標変換も各所に散在。
- **やること**: この「Konva ノード読み出し → CanvasElement への変換（scale畳み込み・座標変換）」を**1つの純粋関数モジュール**（例 `utils/konvaCommit.ts`）に集約し、`applyCommand` に渡す updates を作る。挙動不変・build/test 緑・座標変換の純関数にはテストを付ける。
- **なぜ先にやるか**: E2 のモバイルの2本指ピンチ/回転が**同じ commit 経路**を使うため、ここを綺麗にしておくと E2 が楽になる。

### E2 — ストーリーズモード MVP（L・ユーザー価値の本丸）

§3.3 が仕様の正本。要点の再掲:

- <768px で**ストーリーズモード**起動、`DesktopRecommendedModal` 廃止。fit-to-screen キャンバス（モバイルのズーム/パン廃止）。
- タップ選択 + ドラッグ移動 + スナップガイド。**Transformerハンドル廃止 → 要素上の2本指ピンチ/ツイストで拡大縮小・回転**（回転0°/90°スナップ）。
- **全画面テキスト編集モード**（`visualViewport` 対応でソフトキーボード上に配置。フォントカルーセル・色・S/M/L）。既存のインラインtextareaはモバイルでは使わない。
- 追加系4ボタン（Aa テキスト / 🖼 スタンプ=画像ライブラリのステッカーグリッド / 🎨 背景プリセット / ✨ エフェクトプリセット）。
- テンプレ保護は既存 `locked` フラグ活用（ロック要素はタップ選択不可）。
- **この切り出し = BannerEditor の実質的な分割**になる（モバイルビューを独立コンポーネント化）。
- 流用資産: `MobileSheet` / `MobileToolbar` / `PropertyPanel` の isMobile / ピンチズーム基盤（§2.3）。

### E3 — スタンプ・背景・エフェクト（M）

- ステッカーシート（画像ライブラリのグリッドUI、プレミアムガード踏襲） / 背景プリセットスウォッチ / エフェクトプリセット（影 なし/弱/強）。

### E4 — 磨き込み・計測（M）

- ジェスチャ調整（実機の誤操作つぶし） / `alert()`撤去→トースト化・本番`console.*`掃除 / モバイル利用計測 / 実機QA（safe-area・キーボード・回転）。
- **coalesce の既知の軽微点**（E1b）: nudge の coalesceKey が選択変更ではリセットされず、連続する別 nudge セッションが1 undo に merge し得る（非破壊）。気になればここで対応。

### スコープ外（別トラック・本計画では触らない）

- 統合 M5（URL/データ移行・301）/ M6（旧IMAGINE凍結・リポジトリクリーニング）
- アセット参照再設計の残バックフィル（default-images / user-images）
- 権限ラダー変更（PRODUCT_ROADMAP Phase 1）
- 編集可能スロット方式への本格移行（E2 の `locked` を土台に、必要になったら別計画）

### 進め方の合意事項（踏襲すること）

- メインはオーケストレーター、実装は Sonnet サブエージェントへ委譲（トークン効率）。
- 純粋ロジックには vitest を書く。コンポーネント挙動は手動E2E（プレビュー/実機）。
- 各サブステップで build + test 緑を確認 → commit → 必要なら push してプレビュー確認。
- コード内コメントは英語のみ。`root-cause-no-workarounds`（バイパス/フォールバックで誤魔化さない）。
