# Ref Library — サイトの画像を外部から参照する

最終更新: 2026-09-04

## 目的

サイトが持つ画像を、外から**URLだけで**参照できるようにする。対象は MCP クライアント
（Claude Code 等）、CLI/curl、Remotion、画像URLを受け取る動画生成AI API。
ファイルをダウンロードしてローカルパスを指す運用を廃止し、
常に最新のR2 URLを直接渡せるようにするのが狙い。

🔴 **参照できる対象（kind）は2種類ある。** 片方だけを見て設計判断をしないこと。

| kind | 実体 | 中身 | 公開範囲 |
|---|---|---|---|
| **designs** | `public.banners` | IMAGINE で保存したデザイン（ユーザーの私物・保存時にレンダリング） | **id指定=全アカウント / 列挙=オーナー範囲** |
| **assets** | `public.default_images` | サイト公式のキュレーション素材ライブラリ（キャラクター切り抜き・一般アート） | **完全公開**（id指定も列挙もスコープ無し） |

## 設計判断

**なぜダウンロード不要か**: 画像実体はすでにR2 (`assets.whatif-ep.xyz`) に公開・CORS開放で
置かれている。DBの行から公開URLを解決して返すだけで、コピーもエクスポートも不要になる
（`/api/lab/assets` と同じ発想。[docs/LAB.md](./LAB.md) 参照）。

**なぜ公開読み取りか — デザインの uuid が実質的なアクセス権**: 認証トークンを
CLI・Remotion・外部APIに配り歩く運用コストの方が、実害より大きい。代わりに
**「id を知っていること」自体を権限として扱う**。画像実体であるR2オブジェクトは
すでに誰でも読める（キーを知っていれば取得できる = obscurity ベース）ので、
解決できる id が、そのキーより秘密である必要はない。したがって
**id を指定すれば、どのアカウントのデザインでも参照できる**。ユーザーは自分のデザインの
id / ref URL を動画生成AIやCLI、あるいは他人に渡せる。

**一方で「列挙」はオーナー範囲に限定する**: obscurity は id が推測不能である限りしか
守ってくれない。一覧・検索を全アカウントに開くと、1リクエストで全ユーザーの全デザインの
id を収集できてしまい、上のモデルが根本から崩れる。そのため一覧・検索は
`REF_OWNER_USER_IDS`（未設定時は admin）の範囲に限定する。

🔴 **この非対称性（id指定=全体 / 列挙=オーナー範囲）が設計の要**であり、実装漏れではない。
「id 側にもオーナー絞り込みを足す」「一覧側の絞り込みを外して簡素化する」はどちらも
契約の片側を壊す。[designs.ts](../src/lib/ref/designs.ts) では
この2経路を別名の関数（`getRefDesignsByIds` / `listRefDesigns`）に分離しており、
フラグ1つでスコープが変わる構造は意図的に避けている。

**なぜIDベースか**: 検索・一覧は名前で行い、実際の参照は不変の`id`で固定する。名前は
リネームされるが`id`は変わらないため、動画生成AIへの入力やRemotionのコードに焼き込む
参照として安定する。

🔴 **`url` はfull-resレンダリングだけを指す。サムネイルには絶対に落とさない**:
以前は full-res が無いデザインで `url` がサムネイルにフォールバックしていたが、
`width` / `height` はドキュメント寸法（例: 1080×1350）を申告し続けていた。
結果として利用側は「1080×1350 の画像だ」と信じて **実体399×499のサムネイル**を掴み、
そのまま有料の動画生成API（1本 $0.32〜$1.20）に投入できてしまった。
MiniMax の入力制約は256〜5760pxなので**API側も弾かず、生成後まで気づけない**。
現在は2つの画像を明確に分離している:

- `url` = full-res レンダリングのみ。無ければ `null`（`urlKind` も `null`）
- `width` / `height` = **`url` が指す画像の実寸そのもの**。`url` が `null` なら両方 `null`
- `docWidth` / `docHeight` = デザインのドキュメント寸法。**レンダリングの有無に関わらず常に入る**
- `thumbnailUrl` = 小さいプレビュー。**別名の別フィールド**として残す

**なぜサムネイルの寸法を返さないか**: サムネイルの生成器が複数あり
（`Canvas.tsx` の exportThumbnail と `bannerPreviewRenderer.ts`）、さらに旧キー形式
（`user-images/{uid}/thumbnails/{id}-{ts}.jpg`）の遺産もあるため、**実寸が一意に決まらない**
（1080×1350のドキュメントが399×499になる）。**推測して申告するくらいなら申告しない**
というのが #1 の教訓そのものなので、`thumbnailUrl` の寸法は返さず
「おおよそ400px幅・正確なサイズは保証しない」とだけ書く。

**フラグは将来**: 「このデザインは参照させない」という非公開フラグはv1にはない。
何もしなければ id を知っている人は誰でも参照できる、という単純なモデルを先に置き、
必要になった時点で opt-out フラグを追加する（[今後](#今後)参照）。
現状、一度配ったURLを**後から無効化する手段はない**。

### assets（公式素材ライブラリ）には、なぜスコープが一切無いのか

`default_images` は**サイト自身が公開しているキュレーション済みライブラリ**であり、
行にオーナーが存在しない。designs の列挙をオーナー範囲に絞るのは
「他人の私物の id を1リクエストで収穫させない」ためだが、assets にはそもそも
私物が無いので、列挙しても漏れるものが無い。**ライブラリは閲覧されるために在る**ので、
ここに後からオーナー絞り込みを足すのは、存在意義である利用側から隠すだけになる。

このため assets 側は `listRefAssets` / `getRefAssetsByIds` の**両方がスコープ無し**で、
designs 側のような非対称性を持たない（[assets.ts](../src/lib/ref/assets.ts) 冒頭に同じ説明がある）。

**認証情報も anon クライアントを使う**（designs は service-role）。この表の SELECT は
RLS で anon / authenticated に `true` で開いており、RLSを回避する必要がそもそも無い。
**仕事を果たせる最弱の資格情報を使う**という原則に加え、将来 RLS で
「未公開フラグ」等を足したときに、黙って迂回されず自動的に効くようにするため。

🔴 **assets の `width` / `height` は信用できる**: designs は「レンダリング済みか」で
実寸の申告可否が変わったが、assets は**全130行が `storage_path`（フルサイズ）と
`width`/`height` を持っている**。したがって
「`width`/`height` は `url` が指す画像の実寸そのもの」という designs で苦労して守った規則が、
assets では**例外なく成立する**。`thumbnail_path` も全行にあるが、
サムネイルの実寸は記録が無いので designs と同じく**申告しない**。

なお `aspect` は約分した比だが、素材は手作業でクロップされているため
`"1223:2063"` のような値になるのが普通で、`"4:5"` のように整った値にはまずならない。
**形の目安であって、等値でフィルタする用途には使えない**（designs の `aspect` とは性格が違う）。

## 対象と範囲

### designs（`public.banners`）

- **`id` を指定するアクセスにはアカウント制限がない**。`/ref/{id}` と
  `/api/ref/designs?id=...`、MCP `get_design` は、どのアカウントが保存したデザインでも
  id が正しければ解決する
- 環境変数 `REF_OWNER_USER_IDS`（カンマ区切りのuser id）は
  **一覧・検索に出るアカウントの指定だけ**を行う。`id` 指定のアクセスには一切影響しない。
  未設定時は `profiles.role = 'admin'` の全アカウントにフォールバックする
- **一覧・検索はユーザー向け機能として公開していない**（フッターのMCPヘルプにも載せない）。
  オーナーが自分のデザインをMCP・CLIから探すための補助であり、そのため
  `REF_OWNER_USER_IDS` は**未設定のままでよい**（admin へのフォールバックで足りる）
- したがって「一覧に出ない」≠「参照できない」。オーナー範囲外のデザインは一覧・検索には
  現れないが、id を知っていれば参照・ダウンロードできる

### assets（`public.default_images`）

- **一覧・検索・id指定のすべてが公開**。`REF_OWNER_USER_IDS` は一切関与しない
- 130行すべてが**フルサイズ画像＋実寸＋サムネイル**を持つ。
  `url: null` になる行は現状存在しない（designs の「full-res 未生成」に相当する状態が無い）
- `asset_role` は `character_cutout`（81件・全件に `work_number` あり・34件にタグ）と
  `general`（49件）。幅は 480〜4096px
- 素材そのものはすでに `/api/lab/assets` で公開済み。Ref Library はそこに
  **id指定取得・`count`/`total`・`fields`・恒久リンク**という参照用の意味付けを足したもの

### 2つの kind の比較

| | designs | assets |
|---|---|---|
| テーブル | `public.banners` | `public.default_images` |
| 一覧の範囲 | オーナー範囲のみ | **全件（公開）** |
| id指定の範囲 | 全アカウント | 全件（公開） |
| Supabaseクライアント | service-role（RLS迂回） | **anon**（RLSに従う） |
| `url` | full-res レンダリングのみ。無ければ `null` | フルサイズ画像。**全行に存在** |
| `width`/`height` | `url` の実寸。`url` が無ければ `null` | `url` の実寸。**全行に記録あり** |
| `aspect` | ドキュメント寸法の比（`"4:5"` 等の整った値） | 実寸の比（`"1223:2063"` 等・等値フィルタ不可） |
| 恒久リンク | `/ref/{id}` | `/ref/asset/{id}` |
| MCPツール | `list_designs` / `get_design` | `list_assets` / `get_asset` |
| キャッシュ | `s-maxage=60` | `s-maxage=300` |
| 更新頻度 | 保存のたび | まれ（キュレーション時のみ） |

まだ含まないもの: テンプレート（`public.templates`）とアップロード素材（`user_images`）。
[今後](#今後)を参照。

## API リファレンス

| エンドポイント | kind | 用途 | 範囲 |
|---|---|---|---|
| `GET /api/ref/designs?id=...` | designs | ID指定取得（**フルレコード**） | **全アカウント** |
| `GET /api/ref/designs`（一覧パラメータ） | designs | 一覧・検索（**コンパクトレコード**） | オーナー範囲のみ |
| `GET /ref/{id}` (`/ref/{id}.jpg` も可) | designs | 現在のfull-resレンダリングへ302リダイレクト | **全アカウント** |
| `GET /api/ref/assets?id=...` | assets | ID指定取得（**フルレコード**） | 公開 |
| `GET /api/ref/assets`（一覧パラメータ） | assets | 一覧・検索（**コンパクトレコード**） | 公開 |
| `GET /ref/asset/{id}` (`.jpg`/`.png` も可) | assets | フルサイズ画像へ302リダイレクト | 公開 |
| `POST /api/mcp` | 両方 | MCP (Streamable HTTP) エンドポイント | ツールごと（下記） |

`/ref/asset/...` は静的セグメントなので、Next.js のルーティング上
**動的な `/ref/[id]` より優先**される（同じ深さでは静的が動的に勝つ）。
したがって assets を足しても designs の `/ref/{id}` は一切影響を受けない。

### `GET /api/ref/designs`

| パラメータ | 例 | 意味 | 範囲 |
|---|---|---|---|
| `search` | `夏祭り` | 名前の部分一致 | オーナー範囲のみ |
| `limit` | `50`（デフォルト50、最大200） | **返す件数（ウィンドウの幅）** | オーナー範囲のみ |
| `offset` | `200`（デフォルト0） | ウィンドウの開始位置 | オーナー範囲のみ |
| `renderedOnly` | `true` | full-resレンダリングがあるものだけ | オーナー範囲のみ |
| `minWidth` | `2000` | `width` がこの値以上のものだけ（**`renderedOnly` を含意**） | オーナー範囲のみ |
| `fields` | `id,name,aspect,url` / `all` | **指定した項目だけ**を返す（`id` は常に付く）。未指定なら一覧はコンパクトレコード、`id` 指定時はフルレコード | 両方 |
| `id` | `a,b,c` | 指定したIDを**指定順どおり**に返す（最大200件） | **全アカウント** |

`id` を付けた時点で他のパラメータは無視され、ID指定取得（全アカウント・既定はフルレコード）になる。
**例外は `fields`** で、`?id=...&fields=id,name` は指定どおりに絞る
（黙って無視するのは、この API がやめようとしている失敗そのものだから）。

`renderedOnly` は SQL 側で `fullres_key IS NOT NULL OR fullres_url IS NOT NULL`
（PostgREST の `.or()`）として適用される。
`minWidth` はドキュメント寸法が `template` jsonb の中にあり、PostgREST は
`template->>width` を**テキスト比較**してしまう（`"900" >= "2000"` が真になる）ため、
**SQLでは表現せず JS 側でフィルタしている**。その代わり該当クエリは条件に合う行を先に
全件（最大1000行）取得してから絞り、`total` とウィンドウ（`limit`/`offset`）を
フィルタ後の集合に対して正しく適用する。件数が1000を超えるまではこの挙動で正確
（実データはオーナー全体で345件）。

```bash
curl -s "https://whatif-ep.xyz/api/ref/designs?search=夏祭り&limit=10" | jq .
curl -s "https://whatif-ep.xyz/api/ref/designs?renderedOnly=true&minWidth=2000" | jq .
curl -s "https://whatif-ep.xyz/api/ref/designs?limit=50&offset=50" | jq .
curl -s "https://whatif-ep.xyz/api/ref/designs?id=<uuid-a>,<uuid-b>" | jq .
```

#### レスポンス

`{ count, total, designs, missing? }`

| フィールド | 意味 |
|---|---|
| `count` | **このレスポンスに入っている件数**（`designs.length` と同じ） |
| `total` | **`limit` / `offset` を無視した、条件に一致する総件数**（Supabase の exact count） |
| `missing` | `id=` 指定時のみ。存在しないID・uuid形式でない文字列・200件の上限を超えた分。500にはならない |

🔴 `count < total` なら **`limit` で打ち切られている**。以前は `count` しか無く
「limit=200 で 200件返ってきたとき、打ち切られたのか、ちょうど200件なのか判別できない」
状態だった。ページングは `offset` を進める。

`offset` が総件数を超えた場合は **200 + 空配列**（`{count: 0, total: N, designs: []}`）を返す。
PostgREST は範囲外レンジに 416 (`PGRST103`) を返すため、実装側で握って空ページに変換している
（古い `total` を持ったままページングした利用側が500を踏まないように）。

#### `RefDesign`（フルレコード）

`GET /api/ref/designs?id=...` と MCP `get_design` が返す形。

```ts
type RefDesign = {
  id: string;
  name: string;
  episode: string | null;     // "0313-1" — 名前からのベストエフォート抽出
  variant: "Feed" | "Landscape" | "Portrait" | "Cover" | null;
  aspect: string | null;      // "4:5" — docWidth/docHeight をGCDで約分

  // 🔴 url が指す画像の実寸そのもの。url が null なら両方 null
  width: number | null;
  height: number | null;
  // デザインのドキュメント寸法。レンダリングが無くても常に入る
  docWidth: number | null;
  docHeight: number | null;

  url: string | null;         // 🔴 full-resレンダリングのみ。無ければ null
  urlKind: "full" | null;     // "thumb" は廃止。url がサムネイルになることはない
  thumbnailUrl: string | null; // 小さいプレビュー（おおよそ400px幅・正確なサイズは保証しない）

  refUrl: string;             // 常に https://whatif-ep.xyz/ref/{id}
  editUrl: string;            // 常に https://whatif-ep.xyz/edit/{id}
  updatedAt: string;
  previewStatus: "pending" | "ready" | "failed" | null;
  stale: boolean;             // レンダリングが保存済みドキュメントより古い
};
```

`urlKind` は `"full"` か `null` しか取らなくなったが、**フィールド自体は残す**
（既存の利用側が読んでいるため）。

`stale` は full-res だけでなく**サムネイルしか無いデザインでも判定する**
（`url` ではなく「何らかのレンダリングがあるか」を見る）。
何もレンダリングされていなければ `false`（`url: null` の方が信号）。

#### 一覧のコンパクトレコードと `fields`

一覧（`id=` 指定でない呼び出し）は**既定でコンパクトレコード**を返す。

```
id, name, aspect, width, height, docWidth, docHeight, url, urlKind, stale
```

除外されるのは `refUrl` / `editUrl` / `thumbnailUrl` / `previewStatus` / `updatedAt`。
理由は応答サイズで、limit=200 のとき従来のフルレコードは **183,584バイト（約46,000トークン）**
あり、LLMクライアントは1回呼ぶだけでコンテキストの相当量を失っていた。
膨張の主因は1件あたり4本のURL（`url` / `thumbnailUrl` / `refUrl` / `editUrl`）で、
同じuuidが4回、R2の長いパス（約200文字）＋URLエンコード済み `?v=` 付きで並んでいた。

**`refUrl` と `editUrl` は `id` から機械的に作れるので、そもそも要求する必要がない**:

```
refUrl  = https://whatif-ep.xyz/ref/{id}
editUrl = https://whatif-ep.xyz/edit/{id}
```

🔴 **`fields` は「絞り込み」である（2026-09-04 に破壊的変更）。**
以前は「コンパクトの10項目＋指定項目」という**追加**専用で、
`fields=id,name,aspect,url` と指定しても `docWidth`/`docHeight`/`urlKind`/`stale` が付いてきた。
つまり**レコードを小さくする手段が存在しなかった**（利用側の実測で200件17,536トークン）。
現在は**指定した項目だけ**を返す。`id` は指定しなくても必ず入る
（id の無いレコードは再取得も `/ref/{id}` URL の組み立てもできず、使い道が無いため）。

| 指定 | 結果 |
|---|---|
| なし | コンパクトレコード（10項目） |
| `fields=id,name,aspect,url` | **その4項目だけ** |
| `fields=name` | `id,name`（`id` は常に付く） |
| `fields=all` | フルレコード |
| `fields=nope,name` | 未知の項目名は**無視**（エラーにしない）→ `id,name` |
| `fields=nope` | 認識できる項目が1つも無いので `id` だけ。これもエラーにしない |

項目名の大文字小文字は無視する。キーの並び順は指定順ではなく常に正準順。
MCP では**配列でも渡せる**（`fields: ["id","name"]`。[MCP 節](#post-apimcp)参照）。

実測（limit=200・オーナー345件。**2026-09-04 時点のスナップショット**であり、
デザインを保存するたびに動く。この数値そのものを契約として扱わないこと）:

| 形 | バイト数 | 概算トークン |
|---|---|---|
| 既定（コンパクト） | 54,979 | 約 13,700 |
| `fields=id,name,aspect,url` | 37,011 | 約 9,300 |
| `fields=id,name` | 15,200 | 約 3,800 |
| `fields=all` | 147,729 | 約 36,900 |
| 変更前（フルレコードのみ・コンパクト化前） | 183,584 | 約 45,900 |

`url` はR2の長いパス（約200文字）なので、`url` を含む限り1件あたりのコストは下限が決まる。
探索フェーズで比率だけ見るなら `fields=id,name,aspect` が一番安い。

ヘッダー: `Access-Control-Allow-Origin: *`、
`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

実装: [src/app/api/ref/designs/route.ts](../src/app/api/ref/designs/route.ts)
（本体は [src/lib/ref/designs.ts](../src/lib/ref/designs.ts) の
`listRefDesigns`＝オーナー範囲 / `getRefDesignsByIds`＝全アカウント）

### `GET /ref/{id}`

デザインIDに対する**恒久リンク**。常に現時点の最新レンダリングへ302リダイレクトするため、
「デザインを更新したら参照先も自動で新しくなってほしい」用途（`refUrl` として配る先）に使う。

- `/ref/{id}` → 現在の **full-res** R2 URLへリダイレクト。🔴 **サムネイルへのフォールバックはしない**
- `/ref/{id}.jpg` → 同上（拡張子は見た目上のヒントとして許容するだけで、実体の形式には影響しない）
- `?size=thumb` → thumbnailへリダイレクト。`?size=full`（既定と同じ）も明示的に受ける。
  🔴 **`thumb` / `full` 以外の値は 400**（`?size=small` のようなタイポで
  黙ってfull-resを返していたのをやめた）
- **どのアカウントのデザインでも**、id が正しければ解決する（id 自体がアクセス権）

#### 🔴 変換系クエリは 400 で弾く（2026-09-04 追加）

このエンドポイントは**保存済みの画像をそのまま返すだけ**で、リサイズ・クロップは
一切行わない（[今後](#今後)の動的リサイズは費用判断待ちで未実装）。
以前は `?w=1920` や `?ar=16:9` を**黙って無視して原寸へ302**していたため、
利用側は「リサイズが効いた」と誤認し、**1本ごとに課金される動画生成API**に
1200×630のまま投入して、課金後に気づくという事故が起きた。
そのため実装されるまでは、変換を約束するクエリは**明示的に 400 を返す**。

弾くパラメータ（`src/lib/ref/common.ts` の `REF_TRANSFORM_PARAMS` が正本。
パラメータ名の大文字小文字は無視する）:

```
w, h, width, height, ar, aspect, fit, crop, dpr, q, quality, format, fm, resize
```

🔴 **これは「機能のホワイトリスト」ではなく「嘘をつかないためのガード」**。
逆に**それ以外のパラメータは弾かない**（キャッシュバスター `cb` / `v`、
アナリティクスの `utm_*` など）。これらのURLは人の手でコピーして貼られるので、
無害な付加パラメータで 400 にすると普通のリンクが壊れる。

400 の本文は「原寸のまま返すエンドポイントである」「唯一のパラメータは `size=thumb|full`」
「リサイズは利用側で行うこと」「原寸は API の `width`/`height` で分かること」を明記する。
CORS ヘッダーは 400 でも付ける（ブラウザから叩いた利用側が本文を読めるように）。

```bash
curl -s "https://whatif-ep.xyz/ref/<uuid>?w=1920"     # 400 + 上記の本文
curl -s "https://whatif-ep.xyz/ref/<uuid>?size=bogus" # 400
curl -sI "https://whatif-ep.xyz/ref/<uuid>?cb=123"    # 302（無関係なので通す）
```

404 になるケースと本文:

| 状況 | 本文 |
|---|---|
| 存在しないID・uuid形式でないID | `Design not found` |
| full-res未生成（`?size=thumb` なし） | `This design has no full-resolution render yet. Open it in the IMAGINE editor and save it to produce one. Add ?size=thumb to this URL to get the small preview instead (roughly 400px wide; exact size not guaranteed).` |
| `?size=thumb` でサムネイルも無い | `This design has no thumbnail yet. Open it in the IMAGINE editor and save it to produce one.` |

full-res未生成のときに**サムネイルを黙って返さない**のが変更点。
「デザインのURL」と称して400pxの画像を配ると、利用側は気づけないまま課金される。

```bash
curl -sI "https://whatif-ep.xyz/ref/<uuid>"            # 302 → full-res / 404
curl -sI "https://whatif-ep.xyz/ref/<uuid>?size=thumb" # 302 → thumbnail
```

実装: [src/app/ref/[id]/route.ts](../src/app/ref/%5Bid%5D/route.ts)

### `GET /api/ref/assets`

公式素材ライブラリ（`public.default_images`）の一覧・検索・ID指定取得。**全経路が公開**。

| パラメータ | 例 | 意味 |
|---|---|---|
| `search` | `0313` | 名前（ファイル名）の部分一致 |
| `role` | `character_cutout` / `general` | `asset_role` の完全一致 |
| `tag` | `Character` / `character` | `tags` 配列に含まれるもの（1タグ・**大文字小文字を区別しない**） |
| `work` | `313` | `work_number` の完全一致 |
| `minWidth` | `2000` | `width` がこの値以上のものだけ |
| `limit` | `50`（デフォルト50、最大200） | 返す件数（ウィンドウの幅） |
| `offset` | `100`（デフォルト0） | ウィンドウの開始位置 |
| `fields` | `id,name,url` / `all` | **指定した項目だけ**を返す（`id` は常に付く） |
| `id` | `a,b,c` | 指定したIDを**指定順どおり**に返す（最大200件・フルレコード） |

designs 側と挙動を揃えてある: `id` を付けた時点で他のパラメータは無視される
（`fields` だけは例外で、指定すれば `id` 指定取得でも絞れる）。
`count` / `total` / `missing` の意味も同じ。`offset` が総件数を超えた場合も同様に
**200 + 空配列**（PostgREST の 416 = `PGRST103` を握って空ページに変換）。

🔴 **`minWidth` は designs と違い SQL 側で適用する**（`.gte("width", n)`）。
こちらの `width` は**普通の integer 列**なので数値比較が正しく効く。
designs が JS でフィルタしているのは、寸法が `template` jsonb の中にあり
PostgREST がテキスト比較してしまうからで、**その制約はこの表には無い**。

🔴 **`tag` だけは JS 側でフィルタする（2026-09-04）**。`tags` は `text[]` で、
PostgREST の `contains` は要素を**完全一致**で比べ、case を畳む手段が無い。
そして**データ側が揺れている**（2026-09-04 時点で `Character` 33件・`character` 1件）ため、
完全一致だとどちらの綴りで検索しても**片方を黙って取りこぼす**。
そこで designs の `minWidth` と同じ形にしてある: 条件に合う行を先に全件
（最大1000行・ライブラリは約130行）取得してから JS で case-insensitive に絞り、
`total` と `limit`/`offset` はフィルタ後の集合に対して正しく適用する。
実測: `tag=character` / `tag=Character` / `tag=CHARACTER` はいずれも `total=34`
（変更前は 1 と 33 に割れていた）。
**データ側の1件も直すべき**で、そのSQLは[今後](#今後)に置いてある。

並び順は `created_at desc`、同着は `id desc` で決定的にしてある
（無いと `offset` ページングで行の取りこぼし・重複が起きる）。

```bash
curl -s "https://whatif-ep.xyz/api/ref/assets?limit=3" | jq .
curl -s "https://whatif-ep.xyz/api/ref/assets?role=character_cutout&minWidth=2000" | jq .
curl -s "https://whatif-ep.xyz/api/ref/assets?work=313&fields=all" | jq .
curl -s "https://whatif-ep.xyz/api/ref/assets?id=<uuid-a>,<uuid-b>" | jq .
```

#### `RefAsset`（フルレコード）

`GET /api/ref/assets?id=...` と MCP `get_asset` が返す形。

```ts
type RefAsset = {
  id: string;
  name: string;              // ライブラリ上のファイル名
  role: string;              // asset_role: "character_cutout" | "general"
  tags: string[];
  workNumber: number | null; // 作品(エピソード)番号。character_cutout は全件持つ
  seriesSlug: string | null;
  variantNumber: number | null;

  aspect: string | null;     // 実寸の約分比。"1223:2063" のような値が普通
  // 🔴 url が指す画像の実寸そのもの。全130行に記録がある
  width: number | null;
  height: number | null;

  url: string | null;        // フルサイズ画像（公開R2）。全行に存在する
  thumbnailUrl: string | null; // 小さいプレビュー（実寸は記録が無いので申告しない）

  refUrl: string;            // 常に https://whatif-ep.xyz/ref/asset/{id}
  fileSize: number | null;
  createdAt: string;
};
```

designs との違いは `docWidth`/`docHeight`・`urlKind`・`stale`・`previewStatus`・`editUrl`
が**無い**こと。いずれも「レンダリングされた成果物」という designs 固有の概念で、
素材ライブラリには対応するものが無い（素材は最初からフルサイズで存在する）。

#### 一覧のコンパクトレコードと `fields`

一覧（`id=` 指定でない呼び出し）は既定でコンパクトレコードを返す。

```
id, name, role, tags, workNumber, aspect, width, height, url
```

除外されるのは `seriesSlug` / `variantNumber` / `thumbnailUrl` / `refUrl` / `fileSize` / `createdAt`。
理由は designs と同じで応答サイズ。`refUrl` は `id` から機械的に作れるので要求不要:

```
refUrl = https://whatif-ep.xyz/ref/asset/{id}
```

`fields` の規則も designs と同一（**指定した項目だけ**を返す＋`id` は常に付く・
`all` でフルレコード・未知の項目名は無視・項目名の大文字小文字は無視・
キーは常に正準順・MCP では配列も可）。

ヘッダー: `Access-Control-Allow-Origin: *`、
`Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`
（designs の60秒より長い。素材はキュレーション時にしか変わらないため）

実装: [src/app/api/ref/assets/route.ts](../src/app/api/ref/assets/route.ts)
（本体は [src/lib/ref/assets.ts](../src/lib/ref/assets.ts)）

🔴 **`/api/lab/assets` は別物として残す**。同じテーブルを読むが、
lab のプロトタイプと Remotion ワークスペースの `scripts/fetch-assets.mjs` が
**あのレスポンス形をそのまま消費している**ため、形を変えると壊れる。
`/api/lab/assets` = 既存の lab 用の形、`/api/ref/assets` = Ref Library の意味付け
（id指定・`count`/`total`・`fields`・`refUrl`）、という住み分けで両立させる。

### `GET /ref/asset/{id}`

素材IDに対する**恒久リンク**。designs の `/ref/{id}` と対になるもの。

- `/ref/asset/{id}` → フルサイズ画像へ302リダイレクト
- `/ref/asset/{id}.jpg` / `.png` → 同上（拡張子は見た目上のヒントとして許容するだけ）
- `?size=thumb` → サムネイルへリダイレクト。`?size=full` も明示的に受け、
  **それ以外の値は 400**
- 🔴 **変換系クエリ（`?w=` / `?ar=` など）は 400**。designs の `/ref/{id}` と
  完全に同じガードを共有する（弾くパラメータの一覧と理由は
  [上記](#-変換系クエリは-400-で弾く2026-09-04-追加)を参照）
- 全件公開なので、id が正しければ必ず解決する

404 になるケースと本文:

| 状況 | 本文 |
|---|---|
| 存在しないID・uuid形式でないID | `Asset not found. Check the id against GET /api/ref/assets, or list the library with the list_assets MCP tool.` |
| フルサイズ画像が無い（現状のデータでは発生しない） | `This library asset has no full-size image. Add ?size=thumb to this URL to get the small preview instead (its exact pixel size is not recorded).` |
| `?size=thumb` でサムネイルが無い（同上） | `This library asset has no thumbnail. Drop ?size=thumb from this URL to get the full-size image instead.` |

```bash
curl -sI "https://whatif-ep.xyz/ref/asset/<uuid>"            # 302 → フルサイズ
curl -sI "https://whatif-ep.xyz/ref/asset/<uuid>?size=thumb" # 302 → サムネイル
```

実装: [src/app/ref/asset/[id]/route.ts](../src/app/ref/asset/%5Bid%5D/route.ts)

### `POST /api/mcp`

認証なしの stateless MCP (Streamable HTTP) エンドポイント。

| ツール | 引数 | 内容 | 範囲 |
|---|---|---|---|
| `list_designs` | `search?`, `limit?`, `offset?`, `renderedOnly?`, `minWidth?`, `fields?` | `/api/ref/designs` と同じ一覧（既定はコンパクトレコード＋`count`/`total`） | オーナー範囲のみ |
| `get_design` | `id`, `preview?` | 単一デザインを**フルレコード**で返す。`preview: true` でthumbnailをMCP image contentとしても添付 | **全アカウント** |
| `list_assets` | `search?`, `role?`, `tag?`, `work?`, `limit?`, `offset?`, `minWidth?`, `fields?` | `/api/ref/assets` と同じ一覧（既定はコンパクトレコード＋`count`/`total`）。`tag` は大文字小文字を区別しない | 公開 |
| `get_asset` | `id`, `preview?` | 単一素材を**フルレコード**で返す。`preview: true` でthumbnailをMCP image contentとしても添付 | 公開 |

🔴 **`fields` は文字列でも配列でも受ける**
（`fields: "id,name"` / `fields: ["id","name"]`）。
JSON Schema 上は `anyOf: [string, array of string]`。
**LLM クライアントは複数値を配列で渡しがち**で、
以前は `Invalid input: expected string, received array at fields` で弾いていた。
構文を学ばせるための1往復に価値は無いので、両方受ける。
意味は HTTP と完全に同じ（**指定した項目だけ**＋`id`・`all` でフル・未知の項目は無視）。

🔴 **ペイロードは全ツールでコンパクトにJSON化する**（`JSON.stringify(value)`。
`null, 2` のインデントを付けない）。MCP クライアントはツール結果を
**コンテキストとして課金される**ので、インデントの空白がそのままトークン費用になる。
実測（limit=200・2026-09-04時点のスナップショット）:

| | ツール結果テキスト | JSON-RPC 応答全体 |
|---|---|---|
| 変更前（`null, 2`） | 72,995 バイト | 81,019 バイト |
| 変更後（コンパクト） | 54,979 バイト | 60,598 バイト |

変更後のツール結果テキストは、同じデータの HTTP 応答と**バイト単位で一致する**
（同じJSONだから当然で、以前はMCP経由の方だけが約1.3万バイト分の空白を運んでいた）。
`fields: ["id","name","aspect","url"]` を併用すると 37,011 バイトになる。

`list_assets` / `get_asset` の description には、
**全素材がフルサイズ画像と正確な実寸を持つので、そのまま画像リファレンスとして使える**こと、
`refUrl` が常に `https://whatif-ep.xyz/ref/asset/{id}` であること、
`aspect` は等値フィルタに使えないことを明記している。
`list_designs` / `get_design` の description にも
**もう一方の kind が存在すること**（`list_assets` / `get_asset`）を1文だけ足してある。
素材を探しているモデルが designs しか見つけられず、
「full-res が無い」デザインを無理に使う、という選択ミスを防ぐため。

ツールの `description` にもこの範囲を書いてある（モデルが `list_designs` を
「全ユーザーのディレクトリ」と誤解しないように）。加えて description には、

- `url` は full-res のみで、`width`/`height` はその実寸であること
- `thumbnailUrl` を full-size の代用にしないこと
- `refUrl` / `editUrl` は `id` から作れるので要求不要であること
- `count` と `total` の違い

を明記している。**LLMクライアントが読む唯一のドキュメントが description なので、
仕様を変えたらここも必ず直す。**

`get_design` の description は「ユーザーが明示的に渡した id（または `list_designs` が返した id）
を解決するツール」であることを条件として書き、
**id を推測・列挙・総当たりしてはならない**と明示する。
uuid v4 なので総当たりは現実的に不可能だが、
「ユーザーが貼った id なら誰のものでも解決する」という**書き方自体**が
モデルにとって他人のidを試す誘因になりうるため。

接続（Claude Code）:

```bash
claude mcp add --transport http whatif-ref https://whatif-ep.xyz/api/mcp
```

Claude Desktop / Cursor など他クライアントも、同じURLをremote HTTP MCPとして登録すれば使える。

実装: [src/app/api/mcp/route.ts](../src/app/api/mcp/route.ts)

## 使い方

### 自分のデザインのURLを配る

`/mydesign` の各カードにコピーボタンがあり、**デザインID**と
**ref URL**（`https://whatif-ep.xyz/ref/{id}`）をそのままクリップボードに取れる。

- コピーしたURLは**誰にでも渡せる**。渡された側はログインもアカウントも不要で、
  そのURLから画像を取得・ダウンロードできる
- 動画生成AI、CLI、Remotion、あるいは単に他人への共有に、そのまま使える
- 一覧・検索（`search`）には自分のデザインは出てこないが、それはアクセスできない
  という意味ではない。**URLを知っている人は取得できる**
- 🔴 したがって、配ったURLは**取り消せない**。公開したくないデザインのURLは配らない

### 動画生成AIに渡す

画像URLを受け取るAPI（動画生成AI等）には、用途に応じて `refUrl` か `url` のどちらかを渡す。

- **最新版を追従させたい** → `refUrl`（`https://whatif-ep.xyz/ref/{id}`）。デザインを更新して
  再保存すれば、同じURLのまま新しいレンダリングに切り替わる
- **この時点の画像で再現したい** → `url`。レンダリングごとにキーがバージョニングされた
  不変URLなので、後からデザインを更新してもこのURLの画像は変わらない

素材を選ぶときは `renderedOnly=true`（または `minWidth`）で絞る。
`url: null` のデザインは full-res が無いので入力にならない。

```bash
# 16:9 の full-res 素材だけを、id/name/aspect/url で取る
curl -s "https://whatif-ep.xyz/api/ref/designs?minWidth=2000&limit=200" \
  | jq '.designs[] | select(.aspect == "16:9") | {id, name, width, height, url}'
```

### CLI

```bash
curl -s "https://whatif-ep.xyz/api/ref/designs?search=夏祭り" | jq '.designs[] | {id, name}'
# refUrl は id から作れる: https://whatif-ep.xyz/ref/{id}
```

### Remotion

Remotionから自分のデザインを参照する場合、`fetch-assets.mjs` のような事前ダウンロードは不要。
再現性が要らない下書き段階では直接URLを渡してよい。

```tsx
import { Img } from "remotion";

<Img src={design.url} />
```

**再現性が必要な場合**（レンダリング後にデザインを触っても画像が変わってほしくない場合）は、
その時点の `url`（バージョン付き・不変）を固定して使う。`refUrl` は最新に追従してしまうため
再現性が必要なレンダリングには使わない。

`scripts/fetch-banner.sh` がservice-role鍵でPostgRESTを直叩きしていた旧来のやり方は**廃止**。
画像参照は `/api/ref/designs` に一本化する（Video FactoryのBannerRenderer用fixtures JSONは
別用途として従来どおり。[docs/LAB.md](./LAB.md) の Video Factory 節を参照）。

### MCP

```bash
claude mcp add --transport http whatif-ref https://whatif-ep.xyz/api/mcp
```

接続後の典型的な会話例:

> 「夏祭りのデザインを探して、そのURLを教えて」
> → Claudeが `list_designs({ search: "夏祭り" })` を呼び、`id` から ref URL を組み立てて提示する

> 「16:9で使える素材を出して」
> → `list_designs({ minWidth: 2000, limit: 200 })` を呼び、`aspect: "16:9"` で絞る

> 「このデザインID `abc123...` のプレビュー画像を見せて」
> → `get_design({ id: "abc123...", preview: true })` を呼び、thumbnailが画像として返る

> 「エピソード313のキャラクター切り抜きを使いたい」
> → `list_assets({ role: "character_cutout", work: 313 })` を呼ぶ。
>   返る `url` はフルサイズ・実寸付きなので、そのまま画像入力に渡せる

> 「2000px以上ある公式素材を出して」
> → `list_assets({ minWidth: 2000, role: "character_cutout" })`
>   （2026-09-04時点で29件。件数は `total` を見る）

## 画質と full-res の生成条件

- full-resは**エディタで保存し、プレビュー生成が走った時**にのみ生成される
  （編集後アイドル10秒、または明示的な保存・離脱時）
- full-resはドキュメント寸法ちょうどで書き出される（1080×1350のドキュメント → 1080×1350のJPEG）。
  だから `width` / `height` を `url` の実寸として申告できる
- サムネイルはおおよそ400px幅だが**厳密ではない**（1080×1350 → 399×499）。
  生成器が複数あるため実寸は導出できず、APIも申告しない
- カバレッジ（adminアカウント基準・**2026-09-04時点のスナップショット**）:
  **345件中 full-res 135件**、残り約210件はサムネイルのみか画像なし。
  🔴 この数はエディタで保存するたびに増えるので、**固定値として扱わない**
  （`/api/ref/designs?renderedOnly=true&limit=1` の `total` が常に正しい）。
  在庫不足そのものは[今後](#今後)の「バッチ再レンダリング」参照
- full-resが未生成のデザインは `url: null` / `urlKind: null` / `width`・`height` ともに `null`。
  **サムネイルにフォールバックはしない**。エディタで開いて保存すれば生成される
- `stale: true` は「ドキュメントが最後のレンダリング後に編集された」ことを示す
  （`document_revision != preview_revision`、またはプレビュー未完了の場合）。
  再現性が重要な場面では、参照前にエディタを開いて保存し `stale: false` にしてから
  `url` を取得するとよい

## 運用

- **Vercel環境変数 `REF_OWNER_USER_IDS` は任意**。未設定なら admin アカウント全員に
  フォールバックし、それで一覧・検索は足りる。`id` 指定のアクセス可否には一切関与しないので、
  ユーザーが自分のデザインを参照するために設定は不要。
  一覧に出したいアカウントを厳密に決めたい場合（admin が増えたときなど）にだけ明示設定する
- **`REF_OWNER_USER_IDS` は assets には無関係**。素材ライブラリは全件公開なので、
  この変数を設定しても外しても `/api/ref/assets` の見え方は変わらない
- **キャッシュ**: `/api/ref/designs` は60秒（`s-maxage=60`）。デザイン更新の反映が
  最大60秒遅れうる点は許容している。`/api/ref/assets` は300秒（`s-maxage=300`）で、
  素材の追加が最大5分遅れて見える
- **コードの置き場**: kind ごとに1モジュール
  （[designs.ts](../src/lib/ref/designs.ts) / [assets.ts](../src/lib/ref/assets.ts)）、
  共通の純粋関数だけを [common.ts](../src/lib/ref/common.ts) に置く。
  🔴 **スコープを決めるもの（どの行を見せるか・どのSupabaseクライアントを使うか）は
  common.ts に置かない**。共通ファイルの編集でスコープが広がる構造を作らないため

## フィードバック対応（2026-09-04）

外部プロジェクト **gen-video** が `/api/mcp` を実際にMCPクライアントとして登録し、
i2v（image-to-video）の素材ソースとして使った際に受けた指摘への対応。
指摘の原文書は対応完了をもって削除し、要点はこの節に集約した。

| # | 指摘 | 対応 |
|---|---|---|
| 1 | `width`/`height` が `url` の実体と一致しない（400pxを1080pxと申告） | `url` を **full-resのみ**に限定。`width`/`height` は `url` の実寸、無ければ `null`。`docWidth`/`docHeight` を新設。`urlKind` は `"full"` / `null` のみ。`/ref/{id}` も同じ規則（full-res無しは404） |
| 2 | limit=200 の応答が約46,000トークン | 一覧を**コンパクトレコード**（10項目）に。`refUrl`/`editUrl` の組み立て方を description と本文に明記。実測 183,584→約54,900バイト。**この時点の `fields` は「追加」専用**で、下記「再検証への対応」の B で絞り込みに変えた |
| 3 | `thumb` が63%を占めるのに絞り込めない | `renderedOnly` / `minWidth` を追加（HTTP・`list_designs` 両方） |
| 4 | 総数が返らず、打ち切りか否か判別できない | `total`（exact count）と `offset` を追加。`count` は「このレスポンスの件数」と明記 |
| 5 | 名前の構造がフィールドになっていない | `episode` / `variant` / `aspect` を追加（すべてnullable・ベストエフォート）。パーサは `parseRefDesignName` として `designs.ts` に純関数で置き、実データの名前でユニットテスト |
| 7 | `/imagine/mcp` がエンドポイントに見え、POSTすると本文なしの405が返る | ページを **`/imagine/about-mcp`** にリネームし、フッターのラベルも「MCPについて」等に変更（AIにリンクを渡すと、それ自体をエンドポイントと誤認するため）。[middleware.ts](../middleware.ts) で、旧 `/imagine/mcp` のGET/HEADは新URLへ308、**両URLへの非GET/HEADは `/api/mcp` へ308**（308はメソッドと本文を保つのでMCPクライアントはそのまま接続できる）。ページ本文にも「ここはドキュメントで、登録先は `/api/mcp`」と5言語で明記 |
| 8 | `get_design` の説明文が他人のidを試す誘因になりうる | 「ユーザーが明示的に渡したid」を条件として明記し、推測・列挙・総当たりの禁止を追加。`list_designs` の「全ユーザーのディレクトリではない」文は好評だったのでそのまま維持 |

**未対応（判断待ち）**:

- **#6 動的リサイズ・クロップ**（`?w=1920` / `?ar=16:9`）。指摘の中で唯一 Unsplash に明確に劣る点。
  i2v は**元画像のアスペクト比がそのまま出力比になる**ため、16:9の動画には16:9の素材が要るが、
  レンダー済み135件中16:9は40件しかない（2026-09-04時点のスナップショット。
  この節の初版は limit=200 の範囲で数えて「19件」と書いていた）。
  実装には R2 の前に Cloudflare Images か Workers を挟む必要が
  あり**費用が発生する**。このサイトは過去に Vercel の画像最適化が無料枠を超えて402を返し、
  画像が表示されなくなった経緯がある（[README](../README.md)・`next.config.ts` の `unoptimized: true`）ため、
  **オーナーの承認なしに進めない**。`aspect` フィルタは緩和にはなるが代替ではない。
  🔴 **実装されるまでの暫定措置として、変換系クエリは 400 で弾く**ようにした
  （下記「再検証への対応」A）。黙って原寸を返すと利用側が誤認したまま課金される

### 再検証への対応（2026-09-04）

同じ利用者がデプロイ後に再計測した結果（7項目中5つ解決・1つ部分対応・1つ未対応）に対して、
残課題A〜Eのうち**実装で閉じられる5点をこの日に入れた**。

| 残課題 | 指摘 | 対応 |
|---|---|---|
| A | `?w=` / `?ar=` が黙って無視され、原寸が200で返る | **400で弾く**。`REF_TRANSFORM_PARAMS`（`w,h,width,height,ar,aspect,fit,crop,dpr,q,quality,format,fm,resize`）を両方の `/ref` エイリアスで共有。無関係なクエリ（`cb`/`v`/`utm_*`）は通す。`size` は `thumb`/`full` のみ受け、他は400 |
| B | `fields` が追加専用で、コンパクトの10項目を削れない | `fields` を**絞り込み**に変更（指定項目＋`id` のみ）。`fields=id,name,aspect,url` で 54,979→37,011バイト、`fields=id,name` で 15,200バイト |
| C | `fields` が配列を受け付けない | `anyOf: [string, array of string]` に変更。`fields: ["id","name"]` が通る |
| D | タグの大小文字が揺れていて片方を取りこぼす | `listRefAssets` の `tag` を **case-insensitive** に（JS側フィルタ）。`character` / `Character` どちらでも `total=34` |
| — | （新規）MCPペイロードが pretty-print されていて空白に課金される | 全ツールで `JSON.stringify(value)` に。72,995→54,979バイト（ツール結果テキスト） |
| E | designs の61%が未レンダーで、素材として選べるのは135件 | **未対応**（在庫の問題）。バッチ再レンダリングとして[今後](#今後)に記載 |

**残るのは「データ側の1件」と「レンダリング在庫」の2つ**で、どちらも
コード変更ではなく DB 書き込み / バッチ処理の判断が必要。[今後](#今後)を参照。

**良かった点として維持したもの**: 認証なし・`stale`/`previewStatus`/`urlKind` を隠さない・
`isError: true` ＋人間可読メッセージ・R2直リンクの `.jpg` 拡張子・`/ref/{id}.jpg` の別形・
Acceptヘッダ検査・CORS `*` と `Mcp-Session-Id` の expose・`refUrl` と `url` の使い分け。

## 今後

- 動的リサイズ・クロップ（#6。上記「未対応（判断待ち）」を参照）。
  実装されるまでは `?w=` / `?ar=` 等を **400で弾く**のが現在の挙動
- 🔴 **タグの大文字小文字の揺れを1件だけ直す（DB書き込み・オーナー承認が必要）**。
  `public.default_images` の1行だけがタグ `character` を持ち、他33行は `Character`。
  API側は case-insensitive にしたので**検索は取りこぼさなくなった**が、
  **データそのものは揺れたまま**で、タグ一覧をそのまま表示する画面や
  将来の完全一致前提のコードで再発しうる。
  DB書き込みなので**オーナーの明示承認なしに実行しない**（`AGENTS.md` の Access modes）。
  実行するSQLは以下の1文。冪等（2回目以降は0行更新）で、
  **`Character` と大文字小文字だけ違う行しか触らない**:

  ```sql
  UPDATE public.default_images
  SET tags = (
    SELECT array_agg(
             CASE WHEN lower(tag) = 'character' THEN 'Character' ELSE tag END
             ORDER BY ord
           )
    FROM unnest(tags) WITH ORDINALITY AS t(tag, ord)
  )
  WHERE EXISTS (
    SELECT 1 FROM unnest(tags) AS tag
    WHERE lower(tag) = 'character' AND tag <> 'Character'
  );
  ```

  （現データでは `Character` と `character` を**両方**持つ行は無い
  — 33 + 1 = case-insensitive の34件と一致する — ので重複タグは生じない。
  2026-09-04 に上の `WHERE` を `SELECT` として実行して確認済み: 対象1行・
  `["character"]` → `["Character"]`。実行前にこの形で対象行を確認するとよい）
- 🔴 **full-res の在庫不足＝バッチ再レンダリング（それ自体が1プロジェクト）**。
  2026-09-04時点でオーナー345件のうち**210件に full-res が無く、
  素材として実際に選べるのは約135件**。`renderedOnly` / `minWidth` で
  「見せかけの素材を掴む」危険は消えたが、**在庫が増えたわけではない**
  （利用側にとっては 16:9 が40件しか無いことが実害）。
  閉じるには全デザインを開いて保存し直す**バッチ再レンダリング**が必要だが、
  既存のレンダラ [bannerPreviewRenderer.ts](../src/components/editor/utils/bannerPreviewRenderer.ts)
  は `Image` / `canvas` を使う**ブラウザDOM前提**で、Nodeからは動かない。
  ヘッドレスブラウザ（Playwright 等）でエディタを開くか、レンダラをサーバ側に
  移植するかの選択になり、**小さな修正ではなく独立した1プロジェクト**として扱う
- ~~公式素材ライブラリ（`public.default_images`）を参照対象に追加~~ →
  **2026-09-04 完了**（`/api/ref/assets`・`/ref/asset/{id}`・`list_assets`・`get_asset`）
- テンプレート（`public.templates`。壁紙テンプレート等）を参照対象に追加。
  **注意: `templates` には full-res の列が無く、299行すべてサムネイルしか持っていない**
  （`thumbnail_key` のみ。`banners` の `fullres_key` に相当する列が存在しない）。
  そのまま公開すると全件 `url: null` になるため、先に full-res を生成する仕組みが要る。
  元になった `banners` 行から辿るか、テンプレート用のレンダリング経路を足すかの設計が先
- `user_images` のアップロード素材を参照対象に追加
- デザイン単位の非公開フラグ（opt-out）。
  **一度配ったref URLを無効化する手段は現状ない**ため、取り消しを可能にするならこれが入口になる
  （`banners` に opt-out 列を持ち、`getRefDesignsByIds` 側でも弾く）
- PNG出力（現状はJPEGのみ）
