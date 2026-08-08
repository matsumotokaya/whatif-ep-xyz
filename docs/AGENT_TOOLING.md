# WHATIF 外部サービス接続ガイド

最終確認: 2026-08-08

この文書はClaude CodeとCodexで共有する、WHATIFの外部サービス接続の正本とする。
接続先や開始時チェックは共有するが、ClaudeとCodexは別のOAuthクライアントなので、
MCP／プラグインのOAuth認証情報そのものは各クライアントで一度ずつ承認する。

## 接続の3層

1. **MCP／プラグイン**: クライアントごとにインストール・OAuth承認状態を持つ。
2. **CLI**: 同じMacの設定をClaudeとCodexから共有できる。
3. **プロジェクト設定**: 接続先、ID、検証手順を本書と各エージェント設定で共有する。

MCPが利用可能なセッションではMCPを優先する。MCPが見えない場合に、インストール済みと
推測して操作を続けない。ツール一覧と認証状態を確認し、必要なら新しいセッションを開始する。

## Supabase

- 対象: BANALIST
- Project ref: `rgqduwojvylkulhyodqg`
- URL: `https://rgqduwojvylkulhyodqg.supabase.co`
- MCP名: `supabase_banalist`
- 共有ランチャー: `/Users/kaya.matsumoto/.codex/bin/start-supabase-mcp-banalist.sh`
- プロジェクト共通設定: `/Users/kaya.matsumoto/projects/whatif/.mcp.json`

Codexでは有効化・接続確認済み。Claudeでは同じ共有ランチャーが登録済みだが、初回利用時に
ローカルMCP実行の承認が必要になる場合がある。

セッション最初のSupabase操作前に、必ず `get_project_url` を呼び、上記URLとの完全一致を
確認する。別のSupabase MCPへフォールバックしない。

## Vercel

- Team: `kaya-matsumotos-projects`
- Team ID: `team_kV7X8asP6ThcbNj4UTaWNIz9`
- Project: `whatif-ep-xyz`
- Project ID: `prj_66h8Sg7hAbcFQbR1ht6rSI85b41I`

CodexのVercelプラグインは2026-08-08にインストール・接続確認済み。`list_teams` と
`list_projects` で上記プロジェクトを取得できた。Claudeには `https://mcp.vercel.com` が
登録済みだが、同日時点ではOAuth認証待ち。

セッション開始時は、Vercelツールが存在すればプロジェクト取得で接続確認する。ツールが
存在しなければ `/plugins` でVercelプラグインの状態を確認する。一度接続した後は、通常は
毎セッション再インストールせず、失効・解除・ツール未読込時だけ再認証する。

## Stripe

- Claude: Stripe MCP `https://mcp.stripe.com` を2026-08-08にOAuth接続済み。
  ただし**接続先はSandboxアカウント** `acct_1SgTTtLhSi3I8k5l`（`WHATIF サンドボックス`）。
- Codex: プラグインカタログの紐付け不整合を回避し、Stripe公式MCP
  `https://mcp.stripe.com` をグローバル設定へ直接登録済み。2026-08-08にOAuthログイン成功。
- CLI: `/opt/homebrew/bin/stripe` がインストール済み。`config.toml` に `test_mode_api_key` のみで
  **live キーは未設定**。CLIからも本番は読めない。

### 本番（Live）を読むには

Stripe の新しい Sandbox は**本番とは別の `acct_`** として扱われるため、Sandbox接続の
MCPからは live を横断できない。またドキュメント上、**MCPアクセスの許可は Sandbox と
Live で別々に管理される**（[docs.stripe.com/mcp](https://docs.stripe.com/mcp) "Manage MCP access"）。
OAuth同意画面にSandboxしか出てこない場合、原因はLive側でMCPアクセスが未有効なこと。

手順:

1. ダッシュボードの環境切替を **Sandbox → 本番(Live mode)** にする（ここを忘れると何度やっても出ない）
2. その状態で <https://dashboard.stripe.com/settings/mcp> を開き、MCPアクセスを有効化
   （**Administrator権限が必要**）
3. Claude側でStripe MCPを再接続し、同意画面に本番アカウントが出ることを確認

代替手段（OAuthが使えない場合）: Live の**制限付きAPIキー** `rk_live_...` を
`Authorization: Bearer` で渡す方式が公式にサポートされている。読み取り専用調査なら
`Webhook Endpoints: Read` / `Subscriptions: Read` / `Customers: Read` の3つで足りる。
書き込み権限は付与しない。

Stripe CLIの存在と、Codex／ClaudeのStripe MCPインストールは別物である。MCPを追加した時点で
開始済みのCodexセッションにはツール一覧が再読込されないため、新しいセッションでStripeツールが
表示されることを確認する。再表示されるプラグインインストール画面は使用せず、直接登録した
`stripe` MCPを使う。本番を読む場合は、Sandboxではなく対象の本番アカウント・モードであることも
最初に検証する。

## セッション開始チェック

決済・デプロイ・DBを扱うセッションでは、作業前に以下を確認する。

1. Supabase: `supabase_banalist` が存在し、project URLが完全一致する。
2. Vercel: Vercelツールが存在し、TeamとProject IDが一致する。
3. Stripe: Stripeツールが存在し、対象アカウントとtest/liveモードが一致する。
4. 使えない接続がある場合は、CLIへ黙って切り替えず、使用する経路と認証状態をユーザーへ報告する。
