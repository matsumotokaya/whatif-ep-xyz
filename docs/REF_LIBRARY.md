# Ref Library — 保存済みデザインを外部から参照する

最終更新: 2026-09-04

## 目的

サイトオーナーが IMAGINE で保存したデザイン（`public.banners` の行）を、サイトの外から
**URLだけで**参照できるようにする。対象は MCP クライアント（Claude Code 等）、CLI/curl、
Remotion、画像URLを受け取る動画生成AI API。ファイルをダウンロードしてローカルパスを
指す運用を廃止し、常に最新のR2 URLを直接渡せるようにするのが狙い。

## 設計判断

**なぜダウンロード不要か**: 画像実体はすでにR2 (`assets.whatif-ep.xyz`) に公開・CORS開放で
置かれている。DBの行から公開URLを解決して返すだけで、コピーもエクスポートも不要になる
（`/api/lab/assets` と同じ発想。[docs/LAB.md](./LAB.md) 参照）。

**なぜ公開読み取りか**: v1はオーナー自身が使うための参照経路であり、認証トークンを
CLI・Remotion・外部APIに配り歩く運用コストの方が実害より大きい。その代わり**オーナー範囲を
アカウント単位で絞る**（後述）ことで、他ユーザーのデザインが漏れることはない。

**なぜIDベースか**: 検索・一覧は名前で行い、実際の参照は不変の`id`で固定する。名前は
リネームされるが`id`は変わらないため、動画生成AIへの入力やRemotionのコードに焼き込む
参照として安定する。

**フラグは将来**: 「このデザインは参照させない」という非公開フラグはv1にはない。
何もしなければオーナーが作った全デザインが参照可能、という単純なモデルを先に置き、
必要になった時点で opt-out フラグを追加する（[今後](#今後)参照）。

## 対象と範囲

- v1の対象は **designs**（`public.banners`）のみ。テンプレートやアップロード素材は含まない
- **オーナー範囲**は環境変数 `REF_OWNER_USER_IDS`（カンマ区切りのuser id）で決める。
  未設定時は `profiles.role = 'admin'` の全アカウントにフォールバックする
- オーナーはアカウントを複数持っているため、`REF_OWNER_USER_IDS` にはそのすべてを
  列挙する（Vercel環境変数として設定。[運用](#運用)参照）
- オーナー範囲外のユーザーのデザインは、`id`を直接指定しても一切返らない
  （[designs.ts](../src/lib/ref/designs.ts) で`user_id in (ownerIds)`を全クエリ経路に強制）

## API リファレンス

| エンドポイント | 用途 |
|---|---|
| `GET /api/ref/designs` | デザイン一覧・検索・ID指定取得 |
| `GET /ref/{id}` (`/ref/{id}.jpg` も可) | 現在の最新レンダリングへ302リダイレクト |
| `POST /api/mcp` | MCP (Streamable HTTP) エンドポイント |

### `GET /api/ref/designs`

| パラメータ | 例 | 意味 |
|---|---|---|
| `search` | `夏祭り` | 名前の部分一致 |
| `limit` | `50`（デフォルト50、最大200） | 件数 |
| `id` | `a,b,c` | 指定したIDを**指定順どおり**に返す |

```bash
curl -s "https://whatif-ep.xyz/api/ref/designs?search=夏祭り&limit=10" | jq .
curl -s "https://whatif-ep.xyz/api/ref/designs?id=<uuid-a>,<uuid-b>" | jq .
```

レスポンス: `{ count, designs: RefDesign[], missing?: string[] }`
（`missing` は `id=` 指定時のみ、見つからなかったIDの一覧）

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
（一覧・解決ロジックの本体は [src/lib/ref/designs.ts](../src/lib/ref/designs.ts)）

### `GET /ref/{id}`

デザインIDに対する**恒久リンク**。常に現時点の最新レンダリングへ302リダイレクトするため、
「デザインを更新したら参照先も自動で新しくなってほしい」用途（`refUrl` として配る先）に使う。

- `/ref/{id}` → 現在のfull-res R2 URL(なければthumbnail)へリダイレクト
- `/ref/{id}.jpg` → 同上（拡張子は見た目上のヒントとして許容するだけで、実体の形式には影響しない）
- `?size=thumb` → 常にthumbnailへリダイレクト
- 存在しないID・オーナー範囲外のID・レンダリング未生成のIDは 404 JSON

```bash
curl -sI "https://whatif-ep.xyz/ref/<uuid>"            # 302 → full-res
curl -sI "https://whatif-ep.xyz/ref/<uuid>?size=thumb" # 302 → thumbnail
```

実装: [src/app/ref/[id]/route.ts](../src/app/ref/%5Bid%5D/route.ts)

### `POST /api/mcp`

認証なしの stateless MCP (Streamable HTTP) エンドポイント。

| ツール | 引数 | 内容 |
|---|---|---|
| `list_designs` | `search?`, `limit?` | `/api/ref/designs` と同じ一覧を返す |
| `get_design` | `id`, `preview?` | 単一デザインを返す。`preview: true` でthumbnailをMCP image contentとしても添付 |

接続（Claude Code）:

```bash
claude mcp add --transport http whatif-ref https://whatif-ep.xyz/api/mcp
```

Claude Desktop / Cursor など他クライアントも、同じURLをremote HTTP MCPとして登録すれば使える。

実装: [src/app/api/mcp/route.ts](../src/app/api/mcp/route.ts)

## 使い方

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

- **Vercel環境変数**: `REF_OWNER_USER_IDS` にオーナーの全アカウントのuser idをカンマ区切りで
  設定する。未設定でも動作する（admin全員にフォールバック）が、オーナー以外のadminが
  紛れ込むと意図せず範囲が広がるため、本番では明示設定を推奨
- **キャッシュ**: `/api/ref/designs` は60秒（`s-maxage=60`）。デザイン更新の反映が
  最大60秒遅れうる点は許容している

## 今後

- テンプレート（`public.templates`。壁紙テンプレート等）を参照対象に追加
- `user_images` のアップロード素材を参照対象に追加
- デザイン単位の非公開フラグ（opt-out）
- PNG出力（現状はJPEGのみ）
