# Ref Library — 保存済みデザインを外部から参照する

最終更新: 2026-09-04

## 目的

IMAGINE で保存したデザイン（`public.banners` の行）を、サイトの外から**URLだけで**
参照できるようにする。対象は MCP クライアント（Claude Code 等）、CLI/curl、Remotion、
画像URLを受け取る動画生成AI API。ファイルをダウンロードしてローカルパスを指す運用を廃止し、
常に最新のR2 URLを直接渡せるようにするのが狙い。

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

**フラグは将来**: 「このデザインは参照させない」という非公開フラグはv1にはない。
何もしなければ id を知っている人は誰でも参照できる、という単純なモデルを先に置き、
必要になった時点で opt-out フラグを追加する（[今後](#今後)参照）。
現状、一度配ったURLを**後から無効化する手段はない**。

## 対象と範囲

- v1の対象は **designs**（`public.banners`）のみ。テンプレートやアップロード素材は含まない
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

## API リファレンス

| エンドポイント | 用途 | 範囲 |
|---|---|---|
| `GET /api/ref/designs?id=...` | ID指定取得 | **全アカウント** |
| `GET /api/ref/designs`（`search` / `limit`） | 一覧・検索 | オーナー範囲のみ |
| `GET /ref/{id}` (`/ref/{id}.jpg` も可) | 現在の最新レンダリングへ302リダイレクト | **全アカウント** |
| `POST /api/mcp` | MCP (Streamable HTTP) エンドポイント | ツールごと（下記） |

### `GET /api/ref/designs`

| パラメータ | 例 | 意味 | 範囲 |
|---|---|---|---|
| `search` | `夏祭り` | 名前の部分一致 | オーナー範囲のみ |
| `limit` | `50`（デフォルト50、最大200） | 件数 | オーナー範囲のみ |
| `id` | `a,b,c` | 指定したIDを**指定順どおり**に返す（最大200件） | **全アカウント** |

`id` を付けた時点で `search` / `limit` は無視され、ID指定取得（全アカウント）になる。

```bash
curl -s "https://whatif-ep.xyz/api/ref/designs?search=夏祭り&limit=10" | jq .
curl -s "https://whatif-ep.xyz/api/ref/designs?id=<uuid-a>,<uuid-b>" | jq .
```

レスポンス: `{ count, designs: RefDesign[], missing?: string[] }`
（`missing` は `id=` 指定時のみ。存在しないID・uuid形式でない文字列・200件の上限を
超えた分がここに入る。500にはならない）

```ts
type RefDesign = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  url: string | null;         // 最良のレンダリングの直接R2 URL(不変・バージョン付き)
  urlKind: "full" | "thumb" | null;
  thumbnailUrl: string | null;
  refUrl: string;             // https://whatif-ep.xyz/ref/{id} (常に最新にリダイレクト)
  editUrl: string;            // https://whatif-ep.xyz/edit/{id}
  updatedAt: string;
  previewStatus: "pending" | "ready" | "failed" | null;
  stale: boolean;             // 保存後まだ再レンダリングされていない
};
```

ヘッダー: `Access-Control-Allow-Origin: *`、
`Cache-Control: public, s-maxage=60, stale-while-revalidate=300`

実装: [src/app/api/ref/designs/route.ts](../src/app/api/ref/designs/route.ts)
（本体は [src/lib/ref/designs.ts](../src/lib/ref/designs.ts) の
`listRefDesigns`＝オーナー範囲 / `getRefDesignsByIds`＝全アカウント）

### `GET /ref/{id}`

デザインIDに対する**恒久リンク**。常に現時点の最新レンダリングへ302リダイレクトするため、
「デザインを更新したら参照先も自動で新しくなってほしい」用途（`refUrl` として配る先）に使う。

- `/ref/{id}` → 現在のfull-res R2 URL(なければthumbnail)へリダイレクト
- `/ref/{id}.jpg` → 同上（拡張子は見た目上のヒントとして許容するだけで、実体の形式には影響しない）
- `?size=thumb` → 常にthumbnailへリダイレクト
- **どのアカウントのデザインでも**、id が正しければ解決する（id 自体がアクセス権）
- 存在しないID・uuid形式でないID・レンダリング未生成のIDは 404 JSON

```bash
curl -sI "https://whatif-ep.xyz/ref/<uuid>"            # 302 → full-res
curl -sI "https://whatif-ep.xyz/ref/<uuid>?size=thumb" # 302 → thumbnail
```

実装: [src/app/ref/[id]/route.ts](../src/app/ref/%5Bid%5D/route.ts)

### `POST /api/mcp`

認証なしの stateless MCP (Streamable HTTP) エンドポイント。

| ツール | 引数 | 内容 | 範囲 |
|---|---|---|---|
| `list_designs` | `search?`, `limit?` | `/api/ref/designs` と同じ一覧を返す | オーナー範囲のみ |
| `get_design` | `id`, `preview?` | 単一デザインを返す。`preview: true` でthumbnailをMCP image contentとしても添付 | **全アカウント** |

ツールの `description` にもこの範囲を書いてある（モデルが `list_designs` を
「全ユーザーのディレクトリ」と誤解しないように）。

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

### CLI

```bash
curl -s "https://whatif-ep.xyz/api/ref/designs?search=夏祭り" | jq '.designs[] | {id, name, refUrl}'
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
> → Claudeが `list_designs({ search: "夏祭り" })` を呼び、該当デザインの `refUrl` を提示する

> 「このデザインID `abc123...` のプレビュー画像を見せて」
> → `get_design({ id: "abc123...", preview: true })` を呼び、thumbnailが画像として返る

## 画質と full-res の生成条件

- full-resは**エディタで保存し、プレビュー生成が走った時**にのみ生成される
  （編集後アイドル10秒、または明示的な保存・離脱時）
- 現在のカバレッジ（adminアカウント基準、2026-09-04時点）: 345件中、full-res 133件・thumbnailのみ209件
- デザインをエディタで開いて保存すればfull-resが再生成される
- full-resが未生成のデザインは自動でthumbnailにフォールバックし、`urlKind: "thumb"` になる
- `stale: true` は「ドキュメントが最後のレンダリング後に編集された」ことを示す
  （`document_revision != preview_revision`、またはプレビュー未完了の場合）。
  再現性が重要な場面では、参照前にエディタを開いて保存し `stale: false` にしてから
  `url` を取得するとよい

## 運用

- **Vercel環境変数 `REF_OWNER_USER_IDS` は任意**。未設定なら admin アカウント全員に
  フォールバックし、それで一覧・検索は足りる。`id` 指定のアクセス可否には一切関与しないので、
  ユーザーが自分のデザインを参照するために設定は不要。
  一覧に出したいアカウントを厳密に決めたい場合（admin が増えたときなど）にだけ明示設定する
- **キャッシュ**: `/api/ref/designs` は60秒（`s-maxage=60`）。デザイン更新の反映が
  最大60秒遅れうる点は許容している

## 今後

- テンプレート（`public.templates`。壁紙テンプレート等）を参照対象に追加
- `user_images` のアップロード素材を参照対象に追加
- デザイン単位の非公開フラグ（opt-out）。
  **一度配ったref URLを無効化する手段は現状ない**ため、取り消しを可能にするならこれが入口になる
  （`banners` に opt-out 列を持ち、`getRefDesignsByIds` 側でも弾く）
- PNG出力（現状はJPEGのみ）
