# Image URL 構造リファクタ（次セッション向け）

> Status: TODO（設計のみ）。最終更新: 2026-06-26
> 背景: IMAGINE の画像ストレージを Cloudflare R2 へ移行した際、Gallery 側の URL 生成が
> 複数箇所に散在していたため **1箇所（`wallpaper.ts`）だけ provider 対応が漏れ**、
> R2移行済み作品で削除済みの Supabase URL を返して画像が表示されない不具合が出た。
> 「散在 → 取りこぼし」を構造的に潰すのが本リファクタの目的。

## 1. 完了済み（このセッション 2026-06-26）

- **Vercel Image Optimization をサイト全体で無効化**（`next.config.ts` `images.unoptimized = true`）。
  - 理由: 全画像が R2（egress 無料）にあり適正サイズ済み。最適化は無料枠超過で **402 Payment Required** を返し画像が全滅していた。
  - 以後 `<Image>` は plain `<img>` として R2 から直配信。各コンポーネントの個別 `unoptimized` 指定と `remotePatterns` は不要（現状は残置）。
- `wallpaper.ts` の `buildPublicUrl` を provider 対応化（`storage_provider='r2'` → `assets.whatif-ep.xyz/{bucket}/{path}`）。
- `EpisodeDetailImage` / `WorkCard` にキャッシュ画像の `onLoad` 不発対策（ref + `img.complete`）。

## 2. 残課題：URL生成の一元化（本リファクタ）

### 現状の散在（4ファイル × 保存先3種）

| 場所 | 対象 | 生成先 | provider対応 |
|---|---|---|---|
| `src/lib/images.ts` `buildAssetUrl` | 旧 episode | 旧R2 `pub-…r2.dev`（`NEXT_PUBLIC_R2_BASE_URL`） | なし |
| `src/lib/work-images.ts` `buildAssetUrl` | works / variants | 旧R2 / full-URL passthrough | 部分（http はそのまま使う） |
| `src/lib/wallpaper.ts` `buildPublicUrl` | production_outputs | Supabase または 新R2 `assets.whatif-ep.xyz` | あり（今回追加） |
| `src/lib/club/catalog.ts` | club | R2（`NEXT_PUBLIC_R2_BASE_URL`） | なし |

保存先は **3種混在**: ① Supabase Storage、② 旧R2 `pub-9339….r2.dev`（既存ギャラリー画像）、③ 新R2 `assets.whatif-ep.xyz`（IMAGINE production アセット）。

### あるべき構造

- **単一の provider 対応リゾルバ**（IMAGINE 側 `src/utils/assetUrl.ts` の `resolveAssetUrl(provider, bucket, key, version)` と同思想）に集約する。
- 入力は `{ provider: 'supabase' | 'r2-legacy' | 'r2-assets', bucket, key, version }`、もしくは保存値が full-URL の場合はそのまま通す（後方互換）。
- `images.ts` / `work-images.ts` / `wallpaper.ts` / `club/catalog.ts` の URL 構築をこの 1 関数経由に統一。
- ねらい: 「新しい保存先や provider を足したとき、どこか1箇所で対応漏れ」を原理的に不可能にする。

### 留意点

- 後方互換: 既存DBには full-URL 直書き（旧R2/Supabase）と相対 key が混在。リゾルバは両方を受ける。
- `?v=` キャッシュバストの付与位置を統一（現状 `appendVersionParam` / `versionAssetUrl` が別実装）。
- 移行が進むと Supabase 経路は不要になる（R2 残フェーズ完了後）。

## 3. 関連

- IMAGINE 側 R2 移行の正本: `imagine/docs/R2_MIGRATION.md`（Phase 0/1/2 完了・CLOSED、残フェーズの前提あり）。
- IMAGINE の参考実装: `imagine/src/utils/assetUrl.ts`（`resolveAssetUrl`）。
