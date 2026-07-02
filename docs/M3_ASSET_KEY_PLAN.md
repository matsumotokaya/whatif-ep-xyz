# M3 実装計画: アセット参照の key 方式化

最終更新: 2026-07-02（実データ調査に基づく計画確定版）
Status: **計画確定・実装前**
設計正本: `imagine/docs/ASSET_REFERENCE_REDESIGN.md`（統合アプリ内で1回だけ実装する）
Supabase project: `rgqduwojvylkulhyodqg`

## 0. 現状実測サマリ（2026-07-02 read-only MCP 確認）

### 0.1 DB 実データの分布

| 格納先 | 形態 | 件数 |
|---|---|---|
| `banners.thumbnail_url` | full URL (Supabase/user-images) | 376（null 147） |
| `banners.fullres_url` | full URL (Supabase/user-images) | 79（null 444） |
| `templates.thumbnail_url` | Supabase full URL 180 ＋ assets.whatif-ep.xyz 71 | 251 |
| `banners.elements[].src` | Supabase full URL 1309 ＋ R2 full URL 416 | 1725 |
| `templates.elements[].src` | Supabase full URL 242 ＋ R2 full URL 192 | 434 |
| `user_images.storage_path` | bare key（バケット接頭辞なし・provider列なし） | 140 |
| `default_images.storage_path/thumbnail_path` | bare key ＋ `storage_provider='r2'` | 112 |
| `production_outputs` | provider='r2' / bucket / bare path（健全形） | 591 |
| `club_items` / `work_variants` / `episodes` | bare key（r2-legacy 配信・健全） | — |
| `profiles.avatar_url` | 外部 OAuth URL 67 ＋ bare 1 ＋ null 29 → passthrough 対象 | 97 |

重要事実:

- Supabase Storage に残る実ファイルは **`user-images` バケットのみ（846 オブジェクト / 526MB）**。`default-images` のオブジェクトは 0（R2 移行済み）。
- 全 full URL の接頭辞は **2種類だけ**（`https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/` と `https://assets.whatif-ep.xyz/`）。%エンコード・クエリ・空白を含む値は 0 件 → **DML は単純文字列置換で安全（冪等）**。
- `templates.thumbnail_url` の Supabase 分 180 件は user-images バケットを指す（ファイル現存）。

### 0.2 書き込みパスの現状（要修正箇所）

| 経路 | 場所 | 問題 |
|---|---|---|
| バナーサムネ/フルレス自動保存 | `editor/utils/bannerStorage.ts` `saveThumbnail`/`batchSave` | Supabase アップ → full URL 保存（**地雷を毎日増殖中**） |
| エディタ画像追加/ドロップ/シャドウ | `editor/pages/BannerEditor.tsx`（3箇所） | Supabase アップ → full URL を `elements[].src` に |
| 手動「テンプレートとして保存」 | `BannerEditor.tsx` + `templateStorage.createTemplate` | **Supabase の default-images バケット（実体0）へ書込。壊れている疑い → Phase 0 で実測** |
| Publish（WORKS昇格） | `templateStorage.upsertTemplateFromProductionProject` | バナーの full URL サムネをコピー |
| Content Factory ドラフト生成 | `editor/utils/productionProjects.ts` `buildCenteredImageElement` | 解決済み絶対URLを `elements[].src` に保存（R2 full URL の発生源） |
| ライブラリアップロード | `editor/components/ImageLibraryModal.tsx` | default タブ=R2 presign（健全）/ user タブ=Supabase アップ |
| 削除 | `bannerStorage.delete` / `productionProjects.ts` | R2 上の production_outputs を削除できていない **silent no-op（既存バグ）** |

### 0.3 読み取りパス

- Gallery: `src/lib/asset-url.ts` `resolveAssetUrl`（3 provider + passthrough）
- エディタ: `editor/utils/assetUrl.ts`（2 provider、`TODO(M3)` 注記あり）。`ImageRenderer.tsx` は src を絶対URLとして直接ロード（Supabase URL は CORS 回避の blob 迂回あり）
- banners/templates のサムネURLを読むのは**エディタ配下のみ** → 影響はエディタに閉じる
- presign Edge Function `r2-presign` の権限チェックは M3 キー規約と整合済み
- 注意: `src/lib/r2.ts` は**別バケット `whatif-ep-xyz`（r2-legacy）**。`whatif-assets`（assets.whatif-ep.xyz）と混同禁止

## 1. 単一 asset モジュール設計

- **新設 `src/lib/asset.ts`**（client/server 両用）: キー規約・解決・キー生成を集約。`asset-url.ts` は Gallery レガシー用に残し、最終的に r2-assets 系を吸収
- **正本の参照表現 = 論理バケット接頭辞付き相対キー1本**（`user-images/...` / `default-images/...`）。provider 列は最終廃止
- `AssetKey` brand 型で絶対URL混入を型レベルで遮断
- 決定的キー生成（上書き運用・`{rev}` 乱数廃止・キャッシュバストは `?v=updated_at`）:
  - `user-images/{uid}/banners/{bannerId}/thumb.jpg` / `full.png`
  - `user-images/{uid}/uploads/{assetId}.{ext}`（+ `.thumb.jpg`）
  - `default-images/templates/{templateId}/thumb.jpg`
  - `default-images/library/{assetId}.{ext}`
- 移行期フォールバック: full URL / data: / blob: → passthrough。bare key + `legacyBucket` ヒント（user-images→Supabase、default-images→R2）
- `r2Upload.ts` は「key を受け取り key を返す」`uploadAsset` / `deleteAssets` に改修。`getPublicUrl()` の戻り値を DB に入れる経路を全廃
- `editor/utils/assetUrl.ts` は re-export シム化（Phase 4 で削除）
- **エディタ state 内の `element.src` はキーのまま保持**し、変換は実ロード箇所（ImageRenderer / imageShadow / レイヤーパネル / ImageLibraryModal）に限定

## 2. 変更対象ファイル

書き込み: `editor/utils/r2Upload.ts` / `storage.ts` / `bannerStorage.ts` / `templateStorage.ts` / `libraryAssets.ts` / `productionProjects.ts` / `pages/BannerEditor.tsx` / `components/ImageLibraryModal.tsx`
読み取り: `src/lib/asset.ts`（新規）/ `editor/utils/assetUrl.ts`（シム）/ `canvas/ImageRenderer.tsx` / `utils/imageShadow.ts` / `Sidebar.tsx` / `MobileToolbar.tsx`
スコープ外: `src/lib/images.ts` / `work-images.ts` / `club/catalog.ts`（r2-legacy 系・健全）。`wallpaper.ts` は M4/M5 で。
**注意: editor 配下は並行作業により変わるため、実装時に必ず最新を再確認。**

## 3. DDL/DML 草案（ユーザー手動実行・冪等）

### Stage A: key 列追加（コードデプロイ前・非破壊）

```sql
alter table public.banners
  add column if not exists thumbnail_key text,
  add column if not exists fullres_key  text;
alter table public.templates
  add column if not exists thumbnail_key text;
```

### Stage C: バックフィル DML（Phase 1 の R2 複製完了 + Phase 2 デプロイ後）

```sql
begin;

-- (1) ライブラリ2表: bare path → バケット接頭辞付きフルキー
update public.default_images
   set storage_path = 'default-images/' || storage_path
 where storage_path not like 'default-images/%' and storage_path not like 'http%';
update public.default_images
   set thumbnail_path = 'default-images/' || thumbnail_path
 where thumbnail_path is not null
   and thumbnail_path not like 'default-images/%' and thumbnail_path not like 'http%';

update public.user_images
   set storage_path = 'user-images/' || storage_path
 where storage_path not like 'user-images/%' and storage_path not like 'http%';
update public.user_images
   set thumbnail_path = 'user-images/' || thumbnail_path
 where thumbnail_path is not null
   and thumbnail_path not like 'user-images/%' and thumbnail_path not like 'http%';

-- (2) banners/templates のURL列 → key 列
update public.banners set thumbnail_key = replace(replace(thumbnail_url,
    'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/', ''),
    'https://assets.whatif-ep.xyz/', '')
 where thumbnail_url is not null and thumbnail_key is null;
update public.banners set fullres_key = replace(replace(fullres_url,
    'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/', ''),
    'https://assets.whatif-ep.xyz/', '')
 where fullres_url is not null and fullres_key is null;
update public.templates set thumbnail_key = replace(replace(thumbnail_url,
    'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/', ''),
    'https://assets.whatif-ep.xyz/', '')
 where thumbnail_url is not null and thumbnail_key is null;

-- (3) JSONB elements[].src の key 化（冪等）
update public.banners set elements = replace(replace(elements::text,
    'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/', ''),
    'https://assets.whatif-ep.xyz/', '')::jsonb
 where elements::text like '%rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/%'
    or elements::text like '%assets.whatif-ep.xyz/%';
update public.templates set elements = replace(replace(elements::text,
    'https://rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/', ''),
    'https://assets.whatif-ep.xyz/', '')::jsonb
 where elements::text like '%rgqduwojvylkulhyodqg.supabase.co/storage/v1/object/public/%'
    or elements::text like '%assets.whatif-ep.xyz/%';

commit;
```

検証（すべて 0 になること）:

```sql
select
 (select count(*) from banners  where thumbnail_url is not null and thumbnail_key is null) a,
 (select count(*) from banners  where elements::text like '%/storage/v1/object/public/%'
                                or elements::text like '%assets.whatif-ep.xyz/%') b,
 (select count(*) from templates where elements::text like '%/storage/v1/object/public/%'
                                or elements::text like '%assets.whatif-ep.xyz/%') c,
 (select count(*) from user_images where storage_path not like 'user-images/%') d,
 (select count(*) from default_images where storage_path not like 'default-images/%') e;
```

### Stage D: 破壊的片付け（全画面検証後・1〜2週間の安定確認後）

```sql
alter table public.banners   drop column thumbnail_url, drop column fullres_url;
alter table public.templates drop column thumbnail_url;
alter table public.default_images drop column storage_provider;
-- Supabase Storage user-images 原本の全削除（復元不能なので最後）
```

**先送り（M4/M5）**: `production_outputs` の `storage_key` 集約は writer（`productionOutputBuilder.ts`）がまだ imagine repo 側にあるため Content Factory 移植と同時に。`club_items` の列名変更は任意で M5。

## 4. 実施順序

- **Phase 0** — 実装時再確認: editor 配下の最新 grep、件数SQL再実行、手動テンプレ保存の壊れ疑い実測
- **Phase 1** — Stage A DDL ＋ Supabase `user-images` 846オブジェクト/526MB を R2 `whatif-assets/user-images/{元パス}` へ複製（コピーのみ・原本温存・ユーザー実行スクリプト）。検証は認証付き S3 HEAD を正とする（Cloudflare ネガティブキャッシュ対策）
- **Phase 2** — コード変更一式（新規書込の key 化 + 読み取り両対応）。検証: 新規保存で key 列に入り URL 列が増えない / 旧データ表示回帰 / ゲストフロー / エクスポート成功まで
- **Phase 3** — Stage C バックフィル → 検証SQL全ゼロ → 全画面目視
- **Phase 4** — Stage D 破壊的片付け、passthrough の dev 警告化、シム削除、CI/grep ガード

ロールバック: Phase 3 まで旧カラム・旧ファイルを消さないため各段階で復旧可能。不可逆は Phase 4 のみ。

## 5. リスクと未確定事項

1. editor 配下の並行編集 → 実装時に必ず再確認
2. **手動テンプレ保存が現在壊れている疑い**（Supabase default-images 実体0への書込）→ Phase 0 で実測、必要なら先行ホットフィックス
3. **M3完了〜M4 の間に imagine 側で Publish すると full URL 行が再発** → 運用ルール「M3 後は imagine での Content Factory 操作を凍結」または M4 を直後に実施
4. CORS / canvas 汚染: assets.whatif-ep.xyz の crossOrigin ロード＋toDataURL はエクスポート成功まで検証
5. Publish 時のテンプレサムネは「テンプレ自身のキーへ複製」方式を推奨（バナー削除との結合を切る）
6. `user_images` は provider 列を追加せず「値の形」で新旧判別（bare=Supabase旧 / 接頭辞付き=R2新）
7. Cloudflare ネガティブキャッシュ → 検証は認証 S3 HEAD
8. `src/lib/r2.ts`（r2-legacy）と混同しない
9. 細部: `profiles.avatar_url` bare 1件 / ゲスト localStorage 旧データ / `user_images.thumbnail_path` null 16件

---

## 6. 実施記録

### 2026-07-02 Phase 0〜2 実装（コミット前・レビュー待ち）

**Phase 0 再確認（read-only MCP）**

- 件数は §0.1 と一致: banners.thumbnail_url=376 / null=147、fullres_url=79、templates.thumbnail_url=251、user_images=140、default_images=112。elements[].src: banners Supabase 1309 + R2 416 + bare 0、templates Supabase 242 + R2 192 + bare 0。
- Supabase Storage 実体は `user-images` のみ（**846 オブジェクト / 約 526MB**、実測 551,677,494 bytes）。`default-images` は 0（R2 移行済み）。
- **Stage A の key 列は追加済みを確認**: `banners.thumbnail_key` / `banners.fullres_key` / `templates.thumbnail_key` が information_schema に存在（ユーザー実行済み）。
- 手動テンプレ保存の「壊れ疑い」実測: `storage.buckets` に `default-images`（public）が存在し RLS も admin INSERT/SELECT あり。実体は 0 だが**書込先バケット自体は存在**するため、旧コードは「アップロードは成功するが Wave A の原本削除で 404」になる構造。M3 で `default-images/templates/{id}/thumb.jpg`（R2）へ切替え、key 保存に修正した。

**Phase 2 実装ファイル（新規1・変更13）**

- 新規 `src/lib/asset.ts`: `AssetKey` brand 型 / `isFullUrl` / `isInlineData` / `isAssetKey` / `asAssetKey` / `resolveAsset`（passthrough + logical-prefix→R2 + bare+legacyBucket フォールバック）/ `resolveElementSrc` / `appendCacheBust`（asset-url.ts の appendVersion を共用）/ 決定的キー生成（`buildBannerThumbKey`/`buildBannerFullKey`/`buildUserUploadKey`/`buildTemplateThumbKey`/`buildLibraryAssetKey`/`toDefaultImageKey`）。
- `editor/utils/assetUrl.ts`: src/lib/asset.ts への re-export シム化（StorageProvider 型のみ互換保持）。
- `editor/utils/r2Upload.ts`: `uploadAsset(key)→key` / `deleteAssets(keys)` / `deleteAsset(key)` に改修（URL を返さない）。
- `editor/utils/storage.ts`: `{r2}` オプトインと uploadBlobToR2 依存を削除。appendCacheBust は @/lib/asset から再輸出。
- `editor/utils/bannerStorage.ts`: サムネ/フルレスを固定キー（thumb.jpg/full.png）上書きで R2 アップロード、`thumbnail_key`/`fullres_key` 保存。読みは key 優先→URL フォールバック。delete は key→R2 / URL→Supabase 振り分け。旧リビジョン方式・stale 掃除を撤去。
- `editor/utils/templateStorage.ts`: 読みは thumbnail_key 優先。createTemplate は thumbnailKey を受ける形へ。`setTemplateThumbnailKey` 追加。Publish はテンプレ自身のキーへサムネ複製（失敗時は banner key 参照の非致命フォールバック）。
- `editor/utils/productionProjects.ts`: `buildCenteredImageElement` は `default-images/{path}` の**キーを src に保存**。banner サムネ読みを key 優先へ。production_outputs 削除の **R2 silent no-op を修正**（provider を見て r2=deleteAssets / supabase=removeFilesFromBucket）。deleteBannerRecords も key/URL 振り分け。
- `pages/BannerEditor.tsx`: 画像追加/ドロップ/シャドウ生成の 3 アップロードを `uploadAsset(buildUserUploadKey)` に、`element.src` にキー保存、user_images にフルキー insert。シャドウ元は resolveElementSrc 経由。手動テンプレ保存は create→キーへ upload→setTemplateThumbnailKey の順。
- `components/ImageLibraryModal.tsx`: 両タブとも R2 presign アップロード。グリッドは resolveAsset。選択時は**キー**を返す（default は `default-images/` 前置、user は storage_path そのまま）。削除は R2/Supabase 振り分け。
- 読み取り: `canvas/ImageRenderer.tsx`（ロード直前 resolveElementSrc、Supabase blob 迂回は温存）/ `Sidebar.tsx`・`MobileToolbar.tsx`（レイヤー名は resolveElementSrc 後に URL パース）。
- 型: `types/template.ts`（Banner に thumbnailKey/fullresKey）/ `types/production-project.ts`（ProductionBannerSummary に thumbnail_key/fullres_key）。
- **エディタ state の element.src はキーのまま保持**。

**Phase 1 納品物**

- `scripts/migrate-user-images-to-r2.mjs`: Supabase `user-images` 全オブジェクトを R2 `whatif-assets/user-images/{元パス}` へ複製。コピーのみ（原本温存）・冪等（認証付き S3 HEAD で既存スキップ）・進捗表示・list() 再帰ページング。env は既存 .env.local のキー名。`node --env-file=.env.local scripts/migrate-user-images-to-r2.mjs`（--apply で実行）。**実行はユーザー**。

**検証**

- `npm run build`: 成功（TS 型チェック通過）。
- dev(3710): `/edit?template=ed2f8904…`=200 / `/mydesign`=200 / `/works/episode`=200。
- headless Chrome で `/edit?template=`: `konvajs-content` + `<canvas>` マウント確認。dev.log にエラー無し。当該テンプレの element.src は全て full Supabase URL → passthrough で従来どおり表示。
- resolver 分岐のユニット確認: 7 ケース PASS（full passthrough / prefixed→R2 / bare user→Supabase / bare default→R2 / null / data:）。

**Stage C の前提**: Stage A 適用済み。残る前提は **Phase 1 スクリプトの実行（846 個の R2 複製）**。完了後に §3 Stage C の DML を実行可。

**未解決リスク・TODO**

- レガシー bare user-images 行をライブラリ選択→新規保存すると element.src が bare キーになり Supabase 解決（Stage D で原本削除するまでは表示可）。新規アップロード分は full prefixed key で R2 直参照のため影響なし。恒久解決は M4 で判断。
- Publish のサムネ複製は fetch(assets.whatif-ep.xyz)→R2 PUT をブラウザで実行。CORS 不可時は banner key 参照へ非致命フォールバック。
- リスク #3（M3〜M4 間の imagine Publish で full URL 再発）は据え置き。
