# 完成画像から既存の壁紙下書きを更新する

## 一括の素材準備（2026-10-03追加）

ユーザー外出中は未提供作品のローカル素材準備を順次進める。アップロード・公開はしない。
再開時は `../wallpaper/preparation/README.md` と `queue.json`、各作品の
`../wallpaper/episode/NNNN/preparation/manifest.json` を読む。
公開カードAPIの469作品中399作品が壁紙offerなし。0455は下書き済みとして重複制作しない。
素材を目視して必要な分だけ生成し、元絵・生成指示・出力実寸・検品所見を保持する。
正確なHD/QHDへの通常リサイズと登録は後工程。生成素材を公開済みと記録しない。

`npm run wallpaper -- ...` は、合成済み画像を既存の Content Factory に渡す補助CLI。
エディター・DBスキーマ・公開処理は変更しない。新しいプロジェクトの作成、公開済み作品の
差し替え、メタデータ更新、削除はこの初版の対象外。既存の自分の `draft` に限る。

## オフラインで制作

`sources.json` の例（パスはこのJSONからの相対パス、または絶対パス）:

```json
{
  "version": 1,
  "series": "episode",
  "workNumber": 458,
  "variant": 1,
  "sources": {
    "portrait": "portrait-hd.png",
    "landscape": "landscape-hd.png",
    "feed": "credited-feed.png"
  }
}
```

```sh
npm run wallpaper -- prepare --manifest /absolute/sources.json --out /absolute/new-package
npm run wallpaper -- validate --package /absolute/new-package/package.json
```

- 縦9:16、横16:9、フィード4:5を画像の実寸で検証。入れ違い・自動クロップは拒否。
- EXIF回転を反映して検証。アニメーションや複数ページも拒否。
- 縦1440×2560、横2560×1440、フィード1080×1350へ通常リサイズ。QHDは拡大でよい。
- 画像とサムネイルのSHA-256を保存。登録前に寸法とチェックサムを再検証する。
- 出力ディレクトリは新規に限る。元画像は変更しない。
- フィードは完成済みのクレジット入り画像を渡す。追加の文字は重ねない。

## 接続と事前確認

リポジトリの `AGENTS.md` / `docs/AGENT_TOOLING.md` が優先。
エージェントはリモート read / apply の前に `supabase_banalist.get_project_url` で
`https://rgqduwojvylkulhyodqg.supabase.co` との完全一致を確認する。
CLI自身のURL検証はこのMCP確認の代用にならない。接続がなければオフライン制作までに留める。

CLIは `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、
`WHATIF_USER_ACCESS_TOKEN` を環境から受け取る。最後の値は管理者ユーザーの短命な
Supabaseアクセストークンであり、Supabase管理API用PATではない。
ブラウザから資格情報を抽出したり、トークンを会話・コミット・引数へ貼らない。
既に承認された秘密情報の供給方法を使う。service-role権限を使わず、ユーザーのRLSと
管理者ロール、自分が所有する制作プロジェクトとバナーを確認する。

```sh
# デフォルトは読み取りだけ。UUIDは接続確認後に対象作品から取得する。
npm run wallpaper -- import --package /absolute/new-package/package.json --project <project-uuid>

# 変更計画と接続先を確認し、適用の承認を得てから実行する。
npm run wallpaper -- import --package /absolute/new-package/package.json --project <project-uuid> --apply --backup /absolute/new-backup.json
```

## 変更範囲と公開

1. 作品番号と枝番が一致する自分のdraft、3種類各1件のリンクを検証する。
2. 変更前のproject・links・bannersをローカルに保存（0600、既存ファイルは上書きしない）。
3. 6画像を既存の `r2-presign` 経由でアップロード。キーは内容ハッシュ付きで旧画像を保持する。
4. エディターと同じ `save_banner_document` / `finalize_banner_preview` RPCで3下書きを更新。
   各下書きには対応する画像1枚をキャンバス全面に置く。プレビューも同じ画像で即時作成する。
5. Content Factoryを開き直して3枠を確認し、既存のPublishを使う。
   HD/QHD・フィード・サムネイル・表紙・Gallery連携・テンプレート昇格は既存処理が担当する。

作品のタグ・説明・公開日、元の公式素材台帳、既存出力、提供設定はimportでは変更しない。
途中失敗で公開は行わない。完了済みの同一画像は再実行でスキップされる。
新しいバックアップ先を指定して再実行すること。失敗時のアップロード済みオブジェクトは
参照されないまま残る場合があるが、自動削除はしない。

**3枠をまとめたDBトランザクションではない。** 途中失敗では一部だけ更新されうる。
登録中は同じプロジェクトを別のUI/セッションから編集・公開しない。事前のrevisionチェックと
RPCのpreview revision検証はあるが、他セッションとの全体排他を保証するものではない。
復旧時はバックアップを参照し、3枠の検証が済むまでPublishしない。
全体トランザクション・自動公開・新規作成は、実運用を確認してから別途設計する。

## 0458

素材指定: `../wallpaper/episode/0458/sources.json`

- 縦: Desktop/EPISODE #0458.png
- 横: Desktop/EPISODE #0458 (1).png
- フィード: _feed/0458_001.png（既にクレジット入り）

本番のimport / publish実行状況はチャットの結果を確認する。ローカルprepareの成功は本番登録を意味しない。

## 配布ZIPの現物確認（2026-10-03）

ログイン済みの `/works/episode/0469/wallpaper` からダウンロードして確認。
保存先は Desktop（Downloads ではない）。`whatif-0469-1-pack (2).zip` は
10,536,677 bytes、ZIP全エントリのCRC検証に成功した。

| ファイル | 実寸 |
| --- | --- |
| mobile-hd.png | 1080×1920 |
| mobile-qhd.png | 1440×2560 |
| pc-hd.png | 1920×1080 |
| pc-qhd.png | 2560×1440 |
| package-cover.png | 1600×1600 |

同梱説明書は `README_EN.txt`、`README_JA.txt`、`README_ZH-CN.txt`、
`README_ZH-TW.txt`、`README_KO.txt`。UTF-8テキスト、CRLF改行。
フィード画像は配布ZIPに含まれず、別のproduction outputとして登録される。

コードの確認先:

- `src/components/editor/utils/productionOutputBuilder.ts`: サイズ派生、フィード、表紙、公開処理。
- `src/lib/wallpaper.ts`: 公開プロジェクトのready/currentな配布画像を選択。
- `src/app/api/works/[series]/[code]/wallpaper/download/route.ts`: 認可後のZIP生成。
- `src/lib/wallpaper-manual.ts`: 作品情報を入れた5言語README生成。

確認した既存の不一致（この調査では変更していない）:

- READMEは表紙を `cover.png` と説明するが、実物は `package-cover.png`。
- 日本語READMEはAIアップスケール・ノイズ除去等を実施したと説明する。
  0458の今回の工程は通常リサイズのみなので、工程に合わせた説明の検討が必要。

0458のローカル3画像は寸法・SHA-256検証に成功。CLIの10テストも成功。
2026-10-03に権限解消後、ブラウザUIで横・フィードを登録し、旧レイヤーを非表示にした。
縦・横・フィードの3枠を検品して既存Publish処理が完了。
公開URL: https://whatif-ep.xyz/works/episode/0458/wallpaper
Desktop/whatif-0458-1-pack.zip を実際に取得して、CRC、4画像の寸法、1600×1600表紙、
5言語READMEすべての0458表記を確認。PC HDの横構図も目視検品済み。
今回の本番登録はUI経由。CLIのリモートimport自体は未実行のため、本番実績とは扱わない。

## 人による仕上げ・再公開（2026-10-03更新）

ユーザー指定: 今後は素材登録と3種類の下書き作成・配置まで進め、Content Factoryの
制作一覧で停止する。ユーザーがサイズ・位置を調整し、確定する前に自動Publishしない。

公開済みプロジェクトは消えず、一覧の初期フィルターがdraftなので見えなくなる。
`/mydesign/factory` の Published または「すべて」を選び、既存プロジェクトの
Portrait / Landscape / Feed を開いて編集・保存する。その後同じカードのRepublishで
配布画像・表紙を再生成する。新規作成やOfficial Asset IntakeのOverwriteは不要。
0456と0458がPublished一覧にあり、RepublishボタンがあることをUIで確認済み。

## 構図・再開メモ（2026-10-03 15:10のユーザー修正を反映）

- 0458: 完成済み縦横素材を個別に使用し、フィードは既存のクレジット入り画像。公開・ZIP検証済み。
- 0456: 透過キャラクターを登録する方法。公開・ZIP検証後にユーザーが横型の構図を修正。
  ユーザーは2件目として完了と報告。修正後のRepublish実施はエージェント側では未検証。
- 背景が単色で人物中心の横型は、人物全体を小さく収めることを優先しない。
  中央付近にバストアップ寄りに大きく配置し、顔・手・肩と左右余白のバランスを優先する。
  頭頂や服の下側が枠外に出ること自体は不合格ではない。顔が切れる自動cover配置は避ける。
- 正本の参考画像: ../wallpaper/episode/0456/user-approved-landscape-reference.png
  以前のlandscape-centered.pngはユーザー調整前で、以後の構図基準として使わない。
- 0456の切り抜きは組み込みimage_genによる生成編集でありPython背景除去ではない。
  出力1088×1445・alphaあり。元1856×2464より小さく色味も変化したが、ユーザーは今回の
  仕上がりを許容した。正確なモデル名はツールが示しておらずGPT-Image 2.5と断定しない。
- 構図に必要な部分が欠けている場合は、先に周囲をアウトペインティングしてから切り抜く。
  元画像の顔・手・衣服を維持して検品する。既存素材で成立する場合は不要な生成をしない。
- 次候補0455: 前回一覧確認では壁紙なし。_feed/0455_001_raw.png〜0455_004.png、
  _feed/1x/0455_001.png〜0455_004.pngが存在。原画は各928×1232。4図柄の選定と
  サイト上の枝番確認が必要。001は白髪・輪・翼の人物で、翼は人物と一緒に残す候補。未登録。

### 0455-1 制作中（2026-10-03）

001原画を選び、組み込みimage_genで右翼先端を補完後、輪・翼ごと透過抽出。
正本素材と全生成指示は `../wallpaper/episode/0455/provenance.json` に保存。
`0455_character_cutout_v1.png`（1089×1445、alphaあり）をUIから登録し、
3下書きと3プレビューの作成成功を確認。公開はしていない。
生成プレビューでは縁に色のノイズが見えるが、エディターの灰色背景上では目立たない。
修正版v2は肌色変化が大きいため未採用。

- Portrait: `/edit/633851a5-1424-4d6e-a0db-24e33980ccf9` — 手・翼を収め、上に時計用余白。
- Landscape: `/edit/e957fc6a-5415-450f-93bc-782d8c85e11e` — 中央大きめ、輪・翼・手を保持。
- Feed: `/edit/680e99ed-3658-45af-b2b0-6c367d77a5d0` — 初期配置で輪・手・翼が収まり、既存クレジット入り。目視確認済み。
- タグ: Sky, Serene, Cold, Dreamy, 👼?👿??。リリース日2026-10-03。
- 登録素材role: Character Cutout、asset tag: Character。Summary空欄。
- 3枠を保存済み。`/mydesign/factory` のDraftでユーザーに引き継ぐ。Publish未実行。

再開時はこの文書を読み、対象作品と素材・下書き・公開状態を照合する。
既存プロジェクトを勝手に重複作成しない。3種類の下書きとプレビューを作ったら
制作一覧でユーザーへ渡して止める。新しい公開指示が出るまではPublish/Republishしない。
キャッシュにより一覧サムネイル・壁紙バッジが遅れて反映されうるため、表示遅延だけで
登録不足と判断しない。CLIはローカルprepare/validateと10テストまで検証済みで、
リモートimportは未実行。MCP接続・認証の制約は同文書の接続節とAGENTS.mdに従う。
