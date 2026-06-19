# WHATIF Gallery Performance Plan

最終更新: 2026-06-20

ギャラリー（一覧 `/works/:series` と詳細 `/works/:series/:code`）の表示が重い問題の、原因分析と段階的な改善計画。実装は P0 → P1 → P2 の順で進める。

## 症状（実測）

- 一覧 `/works/episode`: SSR application-code ~1.1–1.9s
- 詳細 `/works/:series/:code`: ~1–6s
- 体感として遷移・スクロールが重い

## 根本原因

### 1. データ取得がリクエスト毎に「全件フルロード」（最大の原因）

- `lib/works.ts` の `getVisibleWorksBySeries` が毎リクエストで **464作品 + 全 variants + 全 offers + feed 画像マップ** を取得。
- `cache()` は React のリクエストスコープのみ。**リクエストをまたいでキャッシュされない**。
- 詳細ページの `getWorkBySeriesAndCode` / `getAdjacentWorks` は **1作品を開くだけで464件全部をロードして `find`/index している**（詳細が重い主因）。

### 2. ページがキャッシュ不能（dynamic 強制）

- 一覧・詳細とも `lib/admin/access.ts` の `getAdminAccess()`（`cookies()` を読む）をページ冒頭で await するため、**ページ全体が動的レンダリング強制**。
- 管理画面には `revalidatePath("/works")` 等が既にあるのに、ページがキャッシュされず毎回フルロード。

### 3. クライアントへの転送量が過大

- `WorksPageClient` に `newestFirst`（464件）と `oldestFirst`（464件・**newest の逆順で完全に冗長**）を両方渡している。
- 各 Work は variants/offers をネストした巨大オブジェクト。無限スクロールは20件表示なのに **全件を RSC ペイロードで送信**。TTFB と hydration を重くしている。

### 健全な点（大きな変更不要）

- 画像は `next/image`（webp/avif・remotePatterns 設定済み）。ただし詳細は feed 画像が無い作品で **原画フル PNG を表示**している点のみ改善余地。

## 改善計画（優先度順）

| 優先 | 施策 | 効果 | 主な変更箇所 |
|---|---|---|---|
| **P0-a** | 公開データ取得を cookie 非依存の anon クライアントに分離し、**永続キャッシュ化**（tag 付き）。管理更新時に `revalidateTag` | DB 全件ロード→キャッシュヒット。一覧・詳細とも劇的高速化 | `lib/works.ts`、管理 actions |
| **P0-b** | admin/auth 判定を **ページ dynamic 化から分離**（Add episode / Edit ボタンを `<Suspense>` の独立 async コンポーネント or クライアント fetch に） | 公開シェルが ISR/静的化可能に | `works/[series]/page.tsx`、`[code]/page.tsx`、小コンポーネント切り出し |
| **P1-a** | 詳細を **単一作品クエリ化**（display_code で1件、adjacent は sequence_number で前後1件ずつ） | 詳細の464件ロード→数件に | `lib/works.ts` |
| **P1-b** | 一覧の転送量削減：`oldestFirst` 廃止（クライアントで reverse）＋ **カード用の軽量 DTO** だけ送る | ペイロード半減〜大幅減、hydration 高速化 | `lib/works.ts`、`WorksPageClient`、`WorkCard` |
| **P2-a** | 詳細画像を原画フル PNG でなくサムネ/feed 優先に | 詳細の画像転送削減 | `lib/work-images.ts` |
| **P2-b** | 公開シェルの **ISR 化**（`revalidate` or PPR、`generateStaticParams` で全 series 事前生成） | 初回以降ほぼ静的配信 | 各 `page.tsx` |

## 着手前の前提確認（チェックリスト）

- [x] **RLS 確認**（完了 / 下記「RLS 確認結果」参照）
- [x] **Next.js 16 のキャッシュ API 確認**（完了 / 下記「キャッシュ方式の決定」参照）
- [ ] **ページ dynamic 回避の作法**: Next 16 における Suspense / PPR を用いた「公開シェルは静的・認証部分のみ動的」の正しい書き方を確認する。

## キャッシュ方式の決定（2026-06-20）

**採用: Path B（`unstable_cache` + `revalidateTag` + 既存 ISR 維持）。**

Next.js 16.2.2 では `'use cache'` / `cacheTag` / `cacheLife` / PPR は単一フラグ **`cacheComponents: true`** で一括有効化されるが、これを有効にすると `export const revalidate` / `dynamic` / `dynamicParams` / `fetchCache` が全ルートで無効化される（既存の `force-dynamic` な API routes 3つに影響）。アプリ全体への波及が大きいため、今回は採用しない。

- `unstable_cache`（`next/cache`）は deprecated だが Next 16 で動作し、**Vercel Data Cache で永続**。影響範囲が最小。
- 無効化は `revalidateTag(tag, 'max')`（**v16 は第2引数必須**。1引数形は非推奨）。
- `cacheComponents` への全面移行は将来の別タスクとする。

## RLS 確認結果（Supabase: BANALIST `rgqduwojvylkulhyodqg`）

| テーブル | anon SELECT | 条件 / 備考 |
|---|---|---|
| `works` | ✅ | `status = 'published'`（または admin） |
| `work_variants` | ✅ | 親 work published かつ status ready/preparing（または admin） |
| `work_offers` | ✅ | 公開条件を満たすもの（または admin） |
| `work_series` | ✅ | `is_public = true`（または admin） |
| `production_projects` | ❌（admin のみ） | 既に `createAdminClient`（service-role）で取得中 |
| `production_outputs` | ❌（admin のみ） | 同上 |

結論:

- works/variants/offers/series は **cookie 非依存の anon クライアント**で取得しキャッシュ可能。公開ページは published のみ取得（クエリで明示フィルタし、RLS だけに依存しない）。
- production_* は引き続き **service-role（cookie 非依存）** で取得し、これもキャッシュ可能。
- 注意: 現状 SSR cookie クライアントでは admin ログイン時に一覧で下書きも見えるが、公開キャッシュは published 固定とする（下書き編集は `/episodes` 経由のため許容）。

## 進め方（サブエージェント運用）

メインはオーケストレーター（計画・前提確認・統合レビュー・デプロイ判断）。各段階の実装は高性能サブエージェントへ委譲し、軽微作業は軽量サブエージェントへ。

1. **前提確認**（RLS / Next16 cache API）を先に完了。
2. **P0-a → P0-b** を実装（最も費用対効果が高い）。各段階で `tsc` / `lint` / 本番 `build` を通し、メインがレビュー。
3. **P1-a → P1-b** を実装。
4. **P2-a → P2-b** を実装。
5. 各段階ごとにコミット。デプロイは段階の区切りでまとめて。

各段階の完了基準:

- `npx tsc --noEmit` と eslint がクリーン
- `npm run build` 成功
- 既存の挙動（無限スクロール、レンジフィルタ、ソート、admin UI、ダウンロード、壁紙導線）を壊さない
- 体感速度の改善を dev ログの application-code 時間で確認

## 効果見積もり

- **P0 完了時点**: ウォーム時は DB アクセス 0 回（キャッシュ配信）、コールド時も詳細は数件クエリ。一覧・詳細とも大幅短縮の見込み。
- **P1 完了時点**: RSC ペイロードが半減〜大幅減し、初期表示・hydration が軽くなる。
- **P2 完了時点**: 公開シェルがほぼ静的配信になり、初回以降の体感が安定。

## リスク・注意

- anon キャッシュは RLS 前提（上記チェックリスト）。anon SELECT 不可のテーブルがあれば、service-role の admin クライアント（`createAdminClient`）でサーバー内取得 + キャッシュに切り替える。
- キャッシュ無効化漏れに注意：管理での作成/編集/削除の全経路で `revalidateTag`（または `revalidatePath`）を確実に呼ぶ。
- 軽量 DTO 化で、カード/詳細が参照していたフィールドの欠落に注意（型で担保する）。

## 実装結果（2026-06-20）

### 完了（コミット済 / デプロイ済）

- **P0-a 公開データキャッシュ**: works/variants/offers/series を cookie 非依存の anon クライアント + `unstable_cache` 化、feed/壁紙は service-role + `unstable_cache`。管理ミューテーションで `revalidateTag(...,'max')`。
  - dev 実測（ウォーム）: 一覧 2.9s→~50ms、詳細 ~1.4s→~40ms（約20〜30倍）。
- **P1-b 転送量削減**: 一覧は `WorkListItem`（8フィールド）の単一配列のみ送信。`oldestFirst` 廃止（クライアントで reverse）。
  - RSC ペイロードの作品フィールド数を約94%削減（2×464×~70 → 1×464×8）。

### 見送り（効果小 or リスク）

- **P1-a 詳細の単一作品クエリ化**: P0-a で詳細も全件キャッシュ共有により ~40ms。単一クエリ化はキャッシュを分断し複雑化する割に効果が薄いため見送り。
- **P0-b ページの静的化（auth 分離）**: データキャッシュ済で dynamic のままでも ~40ms。Path B（cacheComponents 不使用）では PPR が使えず、静的化には admin 判定のクライアント化＋API 追加が必要で、リスク/工数に対し効果が小さい。将来 cacheComponents 移行時に再検討。
- **P2-a 詳細画像のサムネ優先**: 詳細は大きく見せるページで画質が重要。`next/image`（webp/avif）で原画も最適化されるため、画質トレードオフに見合わず見送り。
- **P2-b ISR 化**: P0-b と同様の理由で見送り。

### 結論

P0-a（サーバー時間）と P1-b（クライアント転送）で、ギャラリーの重さの主要因はほぼ解消。残りは効果が小さくリスクのある最適化のため、現時点では見送り。
