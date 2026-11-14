# Experiment（静止画）の登録

この文書が答える問い: Experiment に画像を載せる手順 / Remix はどこへ行ったか / タグの付け方

- シリーズ `experiment`（`/works/experiment`）。2026-11-15 に作品0件の `remix` シリーズを削除し、リミックス作品は Experiment にタグ「Remix」で入れる（ユーザー決定）。
- 登録は `npm run still -- add <画像> --series experiment --title "..." --tag "Remix" --summary "..." [--released YYYY-MM-DD] [--draft] [--dry-run]`（`scripts/still.mjs`、認証情報は `.env.r2backfill.local`）。Episode は Content Factory 経由なので対象外。
  - 元画像と 720px WebP サムネイルを R2 `whatif-assets` の `works/<series>/<番号>/1/` に上げ、works / work_variants を作る。カードはこのサムネイル、詳細は元画像。
  - `--tag` は既存タグを再利用、無ければ tag_type `general` で作る。シリーズ一覧のタグ行にそのまま出る。
  - 番号は連番で自動採番、同じ元ファイル（SHA-256）は二重登録しない。公開日の既定は元ファイルの更新日。
- 詳細画面: IMAGINE テンプレートが無いので「イラストを編集（準備中）」は出さない。ダウンロードは Episode と同じく可能（クレジット入り画像）。

## 登録済み（2026-11-15、元ファイルは `/Volumes/ESD-EH/whatif/_feed/`）

| 番号 | 元ファイル | タイトル | タグ |
|---|---|---|---|
| 0001–0008 | `wtf-exp-0001.jpg` 〜 `wtf-exp-0008_001.jpg` | WTF EXPERIMENTS 0001–0008 | WTF Experiments |
| 0009 | `wtf-moment-0001_001.jpg` | WTF MOMENT 0001 | WTF Moment |
| 0010–0016 | `RMX_357_001.jpg`, `rmx-139/159/0174/0198/0225/0240_001.jpg` | EP-357 / 139 / 159 / 174 / 198 / 225 / 240 RMX | Remix |
| 0017–0019 | `whatis_001/003/006.jpg` | WHAT IS 001 / 003 / 006 | What Is |
