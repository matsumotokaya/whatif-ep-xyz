# Content Factory：枝番・投稿順の変更

2026-11-14 ユーザー依頼 → 同日実装・DB関数を本番適用済み（MCP `apply_migration`、ユーザー承認）。

## 決定事項
- 下書き・公開済みを問わず、作品の全画像を一括で付け替える（ユーザー決定）。公開済みの `?variant=N` / 壁紙URLは新しい番号に従う。
- 入れ替えは挿入方式（移動先以降を繰り下げ、重複なし）。

## 実装
- DB関数 `public.reorder_production_variants(series, work_number, project_ids[])`：`supabase/migrations/20261114_reorder_production_variants.sql`
  - production_projects（番号・タイトル）、default_images.variant_number、banners / templates の名前、work_variants（番号・display_code・sort_order・is_primary）、wallpaper offer の target_url を1トランザクションで更新。
  - 作品の行を FOR UPDATE でロック、送られた project 集合が現状と違えば拒否（stale）。ユニーク制約は upsert で使われているため deferrable にせず、一時番号（99-N+1〜99）経由で付け替え。
  - 番号が変わる画像に壁紙購入があれば拒否（課金データは書き換えない）。
- 出力ファイルは `production/<project_id>/` 保存なので移動不要。画像内クレジットは `EP0473` のみで枝番を含まない。
- UI：`/mydesign/factory` の各カードのタイトル横に「枝番」セレクト（`FactoryProjectManager.tsx`）。処理は `moveProductionProjectVariant`（`productionProjects.ts`）。
- 実行後 `/api/admin/gallery/revalidate`（管理者のみ）で works / production キャッシュを即時失効。

## 残り
- 適用後に EP0473 で「6番→1番」をロールバック前提で試験実行し、番号・代表画像・壁紙URLの追従を確認済み（データは変更なし）。画面からの実操作の確認はまだ。
- 未対応：`user_images.variant_number`（ユーザーが作った派生デザインの参照番号）は追従しない。`gallery-thumbs/v1/<code>.webp`（一覧用の旧サムネ。feed_thumb が無い時だけ使うフォールバック）は代表画像変更に追従しない。

## 現状メモ（2026-11-14 調査）
- EP0473 は6件中5件が公開済み、0473-3 のみ作業中（in_progress / work_variants は preparing）。ハンドオフ作成時の「6件とも下書き」から変わっている。
- 複数枚の公開作品（0469〜0473）に壁紙購入は0件。
