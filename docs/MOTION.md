# Motion（ショート動画）の登録

この文書が答える問い: 過去のリール動画をギャラリーに載せる手順 / 音楽はどうするか / 動画はどこに保存されるか

- シリーズ `motion`（`/works/motion`）。2026-11-14 に作品0件だった `reel` を改名して作成。
- 登録は `npm run motion -- add <動画ファイル> [--title "..."] [--released YYYY-MM-DD] [--poster-at 秒] [--keep-audio] [--draft] [--dry-run]`（`scripts/motion.mjs`、認証情報は `.env.r2backfill.local`）。
  - 音声は既定で削除する（楽曲の権利）。ユーザーが「音声アリ」と指定した動画だけ `--keep-audio`。詳細用の動画に音声を残し `video_has_audio = true`、詳細画面は無音で自動再生して音声オンボタンを出す。
  - 詳細用 1080px（crf 23）と、カード用 540px（crf 30、常に無音・先頭10秒・30fps以下）の H.264 と、ポスター WebP を作り、R2 `whatif-assets` の `works/motion/<番号>/1/` に上げる。
  - ポスターは12コマから最も描き込みの多いコマを自動選択。合わなければ `--poster-at`。
  - 同じ元ファイル（SHA-256）は二重登録しない。番号は連番で自動採番、タイトル既定は `MOTION <番号>`、公開日の既定は元ファイルの更新日。
  - まず `--dry-run` で変換結果を確認してから本登録する。本番 DB に直接登録されるので、公開状態で登録するとすぐ本番に出る（キャッシュで最大5分〜1時間遅れる）。
- DB: `work_variants.variant_type = 'video'`、`video_storage_key`（詳細用）/ `video_preview_storage_key`（カード用）/ `video_has_audio`。`width` / `height` はギャラリーのカードの縦横比（タイル状の並び）に使う。ポスターは `original_storage_key` / `thumbnail_storage_key` に入れるので、画像しか扱わない処理（OG画像・Ref Library）もそのまま動く。
- 対象ファイルはユーザーが指定する（`/Volumes/ESD-EH/whatif/_reels` には素材・途中書き出しも混在）。

## 登録済み（2026-11-14）

| 番号 | 元ファイル（`/Volumes/ESD-EH/whatif/_reels/` 以下） | 音声 |
|---|---|---|
| 0001 | `parapara-manga_004/exp_anime_002_AME/コンポ 1_15.mp4` | 削除 |
| 0002 | `luma_AESPA/wip_001_AME/2.mp4` | 削除 |
| 0003 | `7days/My project-1_4.mp4` | 削除 |
| 0004 | `angel_002/003_AME/001.mp4` | 削除 |
| 0005 | `City-intro-773579/Aftereffects/City Intro (変換済み)_AME/コンポ 1_3.mp4` | 削除 |
| 0006 | `DMM-Voice/all_1.mp4` | あり |
| 0007 | `descending_001/ae_002_AME/004_1_10.mp4` | あり |
