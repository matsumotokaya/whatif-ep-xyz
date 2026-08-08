# 決済・会員権限アーキテクチャ再構築 計画

最終更新: 2026-08-08
ステータス: **進行中（Phase B0 着手前）**

本書は、決済と会員権限まわりを段階的にベストプラクティスへ寄せるための**正本**とする。
このプロジェクトは他案件と並行して進めるが、**外せない最優先案件**として扱う。

関連文書:

- [BILLING_RUNBOOK.md](./BILLING_RUNBOOK.md) — 現行構成の運用手順・障害対応（日々の運用はこちら）
- [UX_BILLING_FIX_LIST.md](./UX_BILLING_FIX_LIST.md) — 本番/Sandbox確認で見つかった個別不具合の一覧（Phase B0 の前提）
- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) — 現行アーキテクチャの横断地図

---

## 0. 絶対に壊してはならない不変条件

**legacy 会員（現在3名）の premium を、決済自動化が剥奪してはならない。**

彼らは **Instagram のサブスクリプション加入者**であり、その特典として The Club の
壁紙DLを提供している。**Stripe とは一切関係がなく、premium は手動で付与・維持している。**

したがって `stripe_customer_id` は NULL で、Stripe を照会しても契約は見つからない。
「Stripeに有効な契約がない＝free」という素朴な実装は、**この3名を即座に無料会員に落とす**。

- Phase B2 では `entitlements` に `source='legacy'` として保持し、Stripe 同期の対象外にする
- `syncCustomerSubscriptionState` 系の処理は Stripe 顧客を持つ会員にのみ作用させる
- この運用は Instagram 特典が整理されるまで**今後数か月〜数年続く前提**

正本: [README「legacy premium は手動付与」](../README.md#-legacy-premium-は手動付与決済自動化から必ず除外する)

## 1. 本プロジェクトの完成条件

**「Webhookが常に成功する」ことではなく、「どこかが一時的に失敗しても、自動的にStripeの正しい状態へ収束する」こと。**

具体的には、次の4つを同時に満たした時点で完了とする。

1. 会員権限の決定権が**単一の同期処理**に集約されている
2. Webhook・成功画面・マイページ・定期照合・管理者操作の**どこから呼ばれても同じ結果**になる
3. 決済反映とメール送信が**分離**されており、メール障害が決済に波及しない
4. 「どの購入者の、どのイベントが、なぜ止まったか」が**管理画面から追える**

---

## 2. 現状の確定した欠陥（2026-08-08 調査）

一般論ではなく、**コードと本番DBで実際に確認した事実**のみを記載する。

### 2.1 本番DBに整合しない会員状態が残存

`public.profiles`（全101行）の照会結果:

| user_id (先頭) | tier | status | stripe顧客 | expires_at | 問題 |
|---|---|---|---|---|---|
| `9c1674eb` | premium | active | あり | 2026-03-15（**5ヶ月前に失効**） | 失効済みなのにPremium継続中 |
| `18128e4b` | premium | null | なし | 2026-02-25（**失効**） | 永久Premium化 |
| `5b38943a` | **free** | **canceling** | あり | 2026-03-13 | tierとstatusが論理矛盾 |

**訂正（2026-08-08）**: 当初これを「単一の書き手からは生成できない＝複数の書き手が競合した証拠」と
記述したが、**誤りだった**。旧 Edge Function 自身のロジックがこの状態を作る。

```js
// 旧 stripe-webhook / customer.subscription.updated
if (subscription.cancel_at_period_end) subscriptionStatus = 'canceling'
else if (subscription.status === 'active')  subscriptionStatus = 'active'
else                                        subscriptionStatus = 'canceled'

subscription_tier: subscription.status === 'active' ? 'premium' : 'free'
```

`cancel_at_period_end = true` かつ `status !== 'active'`（`past_due` など）で
**tier=free / status=canceling** が確定的に生成される。競合ではなく、旧コード単体の論理矛盾。
現行実装が `past_due` を premium 維持に変えたのは、この欠陥への正しい対処である。

### 2.2 旧 Supabase Edge Function が今も ACTIVE で、新実装と逆の結論を出す

`supabase_banalist.list_edge_functions` の結果、以下が稼働中:

```
stripe-webhook          ACTIVE  version 17  verify_jwt=false
create-checkout-session ACTIVE
create-portal-session   ACTIVE
```

| | 旧 Edge Function | 現行 Next.js |
|---|---|---|
| 状態決定 | **イベント本文をそのまま書く**<br>`status === 'active' ? 'premium' : 'free'` | **Stripe APIから全契約を再取得して計算** |
| `trialing` / `past_due` | 即 free（アクセス剥奪） | premium 維持 |
| 有効期限 | checkout時に**「今日+30日」固定** | 実際の `current_period_end` |
| 失敗時 | ログのみで **200 を返す**（再送されず永久欠落） | **500 を返して再送させる** |

**同一イベントに対して2つのエンドポイントが逆の結論を出し、後着が先着を上書きしうる。**

一方で、**現行アプリのコードは決済系Edge Functionを一切呼んでいない**ことを確認済み
（`functions.invoke` の呼び出し先は `r2-presign` / `get-admin-user-directory` / `notify-account-signup` の3本のみ）。
したがって旧決済Edge Functionは**呼び出し元ゼロで、Stripeの宛先設定だけが生存経路**である。

### 2.3 Premium判定が単一カラムに依存し、有効期限を見ていない

判定は `subscription_tier === 'premium'` のみ。`subscription_expires_at` は**判定に一切使われていない**。

- [club/access.ts](../src/lib/club/access.ts) — The Club アクセス
- [account/membership.ts](../src/lib/account/membership.ts) — マイページ
- [Header.tsx](../src/components/Header.tsx) — ヘッダー表示
- [context/AuthContext.tsx](../src/context/AuthContext.tsx) / [editor/contexts/AuthContext.tsx](../src/components/editor/contexts/AuthContext.tsx) — エディタ権限
- [editor/hooks/useAdminStats.ts](../src/components/editor/hooks/useAdminStats.ts) — 管理集計

さらに、この1カラムに**出自の異なる3種類のPremiumが混在**している:

| 出自 | 件数 | 特徴 |
|---|---|---|
| Stripeサブスク | 2 | `stripe_customer_id` あり |
| legacy会員 | 3 | `legacy_login_id` あり、Stripe顧客なし |
| IMAGINE手動付与 | 1 | どちらもなし |

[subscription-sync.ts](../src/lib/subscription-sync.ts) は `subscription_tier` を**無条件に上書き**するため、
**legacy会員が一度Stripeで課金し後に解約すると、legacy特典ごと `free` に落ちて復元不能**になる。

### 2.4 その他

- **定期照合が存在しない** — `vercel.json` なし、cron API なし。Webhookが1度失敗すると誰も直さない
- **管理者の再同期機能がない** — 手動Premium化が `18128e4b`（Stripe顧客なしのpremium）を生んだ疑い
- **壁紙のメール送信が決済反映に結合** — Resend障害時に webhook が 500 を返し続ける（[webhook/route.ts](../src/app/api/stripe/webhook/route.ts) の `handleWallpaperCheckout`）
- **恒久的失敗が無限リトライを起こす** — `loadProfile` の不一致は throw → 500。永久に一致しないイベントがStripeの配信キューを詰まらせる
- **`stripe_events` 台帳がない** — 追跡はVercelログとStripe管理画面の突合のみ

### 2.5 残すべきもの（作り直さない）

- Stripe Checkout / Customer Portal
- Next.js の Checkout API・Webhook エンドポイント
- **Stripeを正とし、イベント本文ではなくAPI再取得で状態を決める設計**（[subscription-sync.ts](../src/lib/subscription-sync.ts) / [subscription-state.ts](../src/lib/subscription-state.ts)）
- サブスクと単品購入の分離
- `current_period_end` の Stripe API 変更への互換処理
- 成功URLの回帰テスト（[stripe-checkout-url.test.ts](../src/lib/stripe-checkout-url.test.ts)）

---

## 3. 目標アーキテクチャ

```
購入者
  │
  ├─ Next.js Checkout API ──→ Stripe Checkout
  │                              │
  │        ┌─────────────────────┤
  │        │                     │
  │   Webhook受信          決済成功画面
  │        │                     │
  │        └──────┬──────────────┘
  │               │
  │      マイページ表示 ─┤
  │      定期照合(cron) ─┤
  │      管理者再同期  ─┤
  │               ▼
  │   ┌───────────────────────────────┐
  │   │  reconcileUserBilling(userId)  │  ← 唯一の契約同期処理
  │   │  Stripeから現在の全契約を取得   │
  │   └───────────────┬───────────────┘
  │                   ▼
  │      billing_customers / billing_subscriptions
  │                   ▼
  │            entitlements  ← Premium判定はここだけを見る
  │
  └─ stripe_events（受信台帳・失敗追跡）

メール送信は会員反映の完了後、別処理・別再試行
```

### テーブル設計（目標）

```
profiles
  ユーザー情報のみ（subscription_* は最終的に廃止）

billing_customers
  user_id, stripe_customer_id

billing_subscriptions
  stripe_subscription_id, user_id, price_id, status,
  current_period_end, cancel_at_period_end, updated_at

entitlements
  user_id, entitlement('premium'), source('stripe'|'legacy'|'manual'),
  valid_until, granted_by, reason, updated_at

stripe_events
  stripe_event_id(unique), type, received_at, status, error,
  attempts, processed_at
```

**Premium判定は `entitlements` だけを見る。** これにより「Stripeの契約記録」と
「サイトで何を利用できるか」が分離され、legacy会員がStripe解約で特典を失う事故が構造的に消える。

---

## 4. フェーズ計画

各フェーズは**独立してデプロイ可能**で、途中で止めても壊れないこと。

### Phase B0 — 止血 🔴 最優先

> エンジニア案では旧Edge Function削除は5番目だったが、**2番目（本番反映）と同時か、その前に**繰り上げる。
> 旧Webhookが生きたまま本番実決済をすると、テスト結果自体が信用できないため。

- [x] **Sandbox のWebhook宛先を棚卸し**（2026-08-08、Stripe MCP で確認）
- [x] **Live のWebhook宛先を棚卸し**（2026-08-08、本番アカウント `acct_1SgTTmQ2eK2Q8eWb` / `IMAGINE`）
- [ ] 🔴 **環境分離**（下記「B0-b」）— 新規に判明した最優先事項
- [ ] `STRIPE_SUBSCRIPTION_PRICE_ID`（本番）の値を確認（下記「価格ID不一致の疑い」）
- [ ] [UX_BILLING_FIX_LIST.md](./UX_BILLING_FIX_LIST.md) P0 のSandbox全ライフサイクル確認を完走
- [ ] 現行修正を本番へ反映し、低額の本番実決済で確認

#### Sandbox の確認結果（2026-08-08）

アカウント: `WHATIF サンドボックス` / `acct_1SgTTtLhSi3I8k5l`

| ID | URL | 状態 | イベント |
|---|---|---|---|
| `we_1U1ytL…` | `…git-sandbox-kaya-matsumotos-projects.vercel.app/api/stripe/webhook` | **enabled** | 5件すべて ✅ |
| `we_1SgUCt…` | `rgqduwojvylkulhyodqg.supabase.co/functions/v1/stripe-webhook`（旧） | **disabled** ✅ | 3件のみ |

**Sandbox 側は B0 の条件を満たしている。** 旧Edge Function宛先はすでに無効化済み
（削除はされていないが、無効なので Phase B6 まで残してよい）。

なお旧宛先は `api_version` が `2025-12-15.clover` に固定され、
`checkout.session.async_payment_succeeded` と `charge.refunded` が欠落していた。
Phase B7 の設定検査では **api_version の固定有無**もチェック項目に含めること。

#### Live の確認結果（2026-08-08）

アカウント: `IMAGINE` / `acct_1SgTTmQ2eK2Q8eWb`

| ID | URL | 状態 | イベント | api_version |
|---|---|---|---|---|
| `we_1TkL1g…` | `https://whatif-ep.xyz/api/stripe/webhook` | **enabled** | 5件すべて ✅ | **`2025-12-15.clover`（固定）** |
| `we_1T0kvD…` | `rgqduwojvylkulhyodqg.supabase.co/functions/v1/stripe-webhook`（旧） | **disabled** ✅ | 3件のみ | `2025-12-15.clover` |

**旧Edge Functionへの宛先は live でも無効化済み。**
→ 当初 B0 の主目的だった「2つのWebhookが競合して上書きし合う」リスクは、
**live / sandbox の両方で既に解消されている**。

#### api_version の不一致（新規発見）

| 経路 | APIバージョン |
|---|---|
| Live Webhook のイベント本文 | `2025-12-15.clover`（**固定**） |
| Sandbox Webhook のイベント本文 | `null`（アカウント既定に追従） |
| アプリのAPI呼び出し（`stripe@22.2.2` の既定） | `2026-05-27.dahlia` |

問題は2つある。

1. **Sandbox と Live が同じ契約で動いていない。** Sandboxは既定追従、Liveはclover固定。
   → **現在のSandboxテストは本番を忠実に再現していない。**
2. アプリはイベント本文ではなくAPI再取得で状態を決める設計なので**致命傷にはならない**が、
   webhookハンドラが本文から読む項目（`charge.refunded` など）は clover 契約、
   TypeScriptの型は dahlia 契約であり、型が実際のペイロードを保証していない。

**重要**: `api_version` は **Webhook エンドポイント作成時に固定され、後から変更できない**
（Stripe API の更新操作は `url` / `enabled_events` / `disabled` / `description` / `metadata` のみ受け付ける）。

したがって揃えるには **エンドポイントを作り直す**しかなく、
**署名シークレットが変わる**ため `STRIPE_WEBHOOK_SECRET` の更新を伴う。手順:

1. 新しいエンドポイントを作成（作成時点のアカウント既定バージョンが適用される）
2. 新しい署名シークレットを Vercel の環境変数へ設定しデプロイ
3. 新旧を**並走**させて新側が正常処理していることを確認
4. 旧エンドポイントを `disabled` にする（削除は観察期間後）

対応: Phase B7 の設定検査で **api_version の固定有無と live/sandbox 一致**を必須項目にする。
当面は「本文を信じずAPI再取得する」現行方針を厳守することで実害を抑える。

**受け入れ条件**: Stripeの**有効な**Webhook宛先が、live は `https://whatif-ep.xyz/api/stripe/webhook` のみ、
sandbox はプレビュー環境のエンドポイントのみ。旧Supabase URLがどちらでも `enabled` でない。
→ **2026-08-08 に両環境で充足を確認。**

**注意**: Edge Function本体の削除は Phase B6。まず宛先を切り、観察期間を置く。

---

### Phase B0-b — 環境分離 ⬜ 既知・許容中（優先度 低〜中）

> **判断（2026-08-08、ユーザー確認済み）**: これは**既知かつ意図的に許容している運用**。
> Supabase プロジェクトが1つしかない以上必然であり、本番とSandboxで同じユーザー・
> 同じステータスをテストしているだけなので、**障害の原因ではない**。
> 当初「最優先」と記述したのは過大評価だった。
>
> 残るコストは1点のみ: **調査時に「本番の失敗」と「Sandboxのテスト結果」を
> 行だけでは区別できない**こと。Phase B2 の `billing_customers` /
> `entitlements` に `livemode` 列を持たせれば、分離せずとも識別できる。

#### 確定した証拠

- `.env.local` は Stripe が **Sandbox**（`STRIPE_WALLPAPER_PRICE_ID=price_1TkEKZLhSi3I8k5l…`、
  `LhSi3I8k5l` は Sandbox アカウント `acct_1SgTTtLhSi3I8k5l` の接尾辞）でありながら、
  `NEXT_PUBLIC_SUPABASE_URL` は**本番と同一の** `rgqduwojvylkulhyodqg.supabase.co`
- 本番 `profiles` に、**live に存在しない Stripe 顧客ID**が保存されている

| profile | email | 保存されている customer | live に存在するか |
|---|---|---|---|
| `330d2f9c` | `matsumotokaya+14@gmail.com` | `cus_V22uJQJPWUWt0m` | ❌ **存在しない** |
| `5b38943a` | `matsumotokaya+1@gmail.com` | `cus_TxaKkCz0xShyDx` | ❌ **存在しない** |

- `330d2f9c` は **2026-08-08 01:33 に更新**され `premium/active`（期限 2026-09-08）。
  これは**本日のSandboxテスト購入が本番DBにPremiumを付与した**もの
- Supabaseプロジェクトは1つしかない（BANALIST）ため、
  local / preview(sandbox) / production が**同一DBを共有**している

#### 対応（Phase B2 に統合）

- [ ] `billing_customers` / `billing_subscriptions` / `entitlements` に **`livemode` 列**を持たせ、
      Sandbox由来の行を機械的に識別できるようにする
- [ ] 管理画面（B5）で live / sandbox をフィルタできるようにする
- [ ] DBの物理分離は行わない（コストに見合わないと判断）

**受け入れ条件**: 任意の会員状態について、それが live 由来か sandbox 由来かを
SQL 1本で判別できる。

---

### Phase B0-c — `stripe_customer_id` の共有を止める 🔴 最優先

**順序が重要**: 重複が残っている状態では UNIQUE 制約の作成が失敗する。
必ず「重複解消 → 制約追加」の順で行う。

- [x] `9660cd04`（`matsumotokaya+4@gmail.com`）をマイページの退会機能で削除（2026-08-08）
- [x] `supabase/migrations/20260808_unique_stripe_customer_id.sql` を適用（2026-08-08）
- [ ] `9c1674eb` の誤った premium 状態を修正（Phase B1）

**退会機能のテスト結果（2026-08-08）**: 正常動作。`profiles` / `auth.users` /
`banners`(3件) すべて削除され、`wallpaper_purchases` は他ユーザーのため影響なし。
`USER_OWNED_TABLES` の削除失敗は握り潰される実装だが、今回は静かな失敗も起きなかった。
作成された索引: `profiles_stripe_customer_id_unique` / `profiles_email_unique`
（いずれも `WHERE ... IS NOT NULL` の部分索引）。

#### ユニーク性の全体監査（2026-08-08 実施）

DB全体のユニークインデックス62件を棚卸しし、候補列の実データを検査した結果、
**実際に重複していたのは `profiles.stripe_customer_id` の1件のみ**。

| 対象 | 制約 | 重複 |
|---|---|---|
| `profiles.stripe_customer_id` | ❌ なし | 🔴 1件 |
| `profiles.email` | ❌ なし | ✅ なし（`auth.users` が上流で担保） |
| `profiles.legacy_login_id` | ✅ 部分索引 | ✅ なし |
| `wallpaper_purchases.stripe_checkout_session_id` | ✅ あり | ✅ なし |
| `wallpaper_purchases.download_token` | ✅ あり | ✅ なし |
| `wallpaper_purchases.stripe_payment_intent_id` | ❌ なし | ✅ なし（再購入を許容する設計のため制約不要） |

#### 🔴 付随して発見: 退会処理が Stripe に一切触らない

[api/account/delete/route.ts](../src/app/api/account/delete/route.ts) は
`work_saves` / `template_likes` / `user_images` / `banners` / `profiles` /
`auth.users` を削除するが、**Stripe のサブスク解約も顧客の切り離しも行わない**。

→ **有効なサブスクを持つ会員が退会すると、課金され続ける。**
`wallpaper_purchases` は `ON DELETE SET NULL` で会計記録として残る設計（これは正しい）。

- [x] **退会をブロックして先に解約させる方式で対応（2026-08-08 実装）**
  - サーバ: `/api/account/delete` が `profiles` を信じず **Stripe に直接問い合わせ**、
    請求されうるサブスクが残っていれば `409 active_subscription` を返す。
    Stripe 照会に失敗した場合も `503` で削除を拒否する（状態不明のまま消さない）
  - 判定: `hasBillableSubscription()`（`src/lib/subscription-state.ts`）。
    `canceled` / `incomplete_expired` 以外はすべてブロック対象。
    `incomplete` はアクセス権を与えないが有効化されうるため含める
  - UI: 削除ダイアログが確認入力の代わりに「先に解約してください」の案内と
    **Customer Portal へのボタン**を表示（5言語対応）。
    サーバが 409 を返した場合もクライアントを同じ状態へ遷移させる
  - legacy / IMAGINE premium は Stripe 顧客を持たないためブロックしない
- [ ] 将来: 退会と同時にサブスクを自動解約する（今回は案内方式を採用）
- [ ] Phase B2 で `billing_customers` / `entitlements` の後始末も併せて設計する

### Phase B1 — 破損データの棚卸しと修復

- [x] **Stripe live と突合完了（2026-08-08）** — 結果は下記
- [ ] 修復SQLを提示し、ユーザーが手動実行（MCPは書き込み不可）
- [ ] `stripe_customer_id` に **UNIQUE制約**を追加（下記の共有問題の再発防止）

#### 突合結果

**Live のサブスクリプションは全部で2件、いずれも `canceled`。有効な契約はゼロ。**

| profile | email | DB上のtier | Stripe live の実態 | 判定 |
|---|---|---|---|---|
| `9c1674eb` | `matsumotokaya@gmail.com` | **premium/active** | 契約なし。保持する `cus_Tz3oVVH4RyExCc` は**他人の顧客ID** | 🔴 誤り |
| `9660cd04` | `matsumotokaya+4@gmail.com` | free/canceled | `cus_Tz3oVVH4RyExCc` の `sub_1T15gq…` は canceled | ✅ 正しい |
| `330d2f9c` | `matsumotokaya+14@gmail.com` | **premium/active** | `cus_V22uJQJPWUWt0m` は live に存在しない（Sandbox由来） | 🔴 環境混入 |
| `5b38943a` | `matsumotokaya+1@gmail.com` | free/**canceling** | `cus_TxaKkCz0xShyDx` は live に存在しない（Sandbox由来） | 🔴 環境混入 |
| `18128e4b` | `kaya.matsumoto@wealth-park.com` | **premium** | Stripe顧客なし。手動付与と推定 | 🟡 要判断 |
| `0c00d735` | （実顧客） | free/canceled | `cus_Up3w1hpItD7pH7` の `sub_1TpPod…` は canceled | ✅ 正しい |

#### 🔴 重大: 1つの Stripe 顧客IDを2つのプロフィールが共有している

```
cus_Tz3oVVH4RyExCc
  ├─ 9660cd04-… (matsumotokaya+4@gmail.com) ← subscription.metadata.user_id はこちら
  └─ 9c1674eb-… (matsumotokaya@gmail.com)   ← 他人の顧客IDを保持したまま premium で固着
```

これは単なるデータ破損ではなく、**現行コードの障害を誘発する**。

1. **Webhookの無限リトライ**: [subscription-sync.ts](../src/lib/subscription-sync.ts) の `loadProfile` は
   `userId` が無い場合 `stripe_customer_id` で引いて `.maybeSingle()` する。
   2行ヒットするとエラー → throw → 500 → Stripe が永久にリトライする。
   `subscription.metadata.user_id` が無いイベント（Portal経由の変更など）で発火しうる。
2. **誤課金リスク**: [checkout/route.ts:52](../src/app/api/subscription/checkout/route.ts) は
   `account.profile.stripe_customer_id` をそのまま Checkout の `customer` に渡す。
   `9c1674eb` が新規契約すると、**他人（`9660cd04`）の Stripe 顧客に紐付けて契約が作られる**。

→ 修復に加えて **`profiles.stripe_customer_id` への UNIQUE 制約が必須**。
Phase B2 の `billing_customers` でも `stripe_customer_id` を UNIQUE にする。

#### 🟢 価格ID不一致（優先度を格下げ・2026-08-08 再評価）

**訂正**: Sandbox と Live で価格IDが異なるのは**当然かつ正常**であり、これは論点ではない。
Sandbox で契約したユーザーにしか影響せず、実顧客には無関係。当初これを
「障害の有力候補」としたのは過大評価だった。

論点は**live 内に有効な価格が2つある**ことだけであり、しかも
**現時点で live の有効契約はゼロなので、被害者は存在しない**。
構造的リスクとして Phase B2-2 で対処すれば足りる。以下は記録として残す。

**live に有効な価格が2つ存在する**（同一プロダクト `prod_Tyi8Mf2mN70ZjI`）。

| price ID | 金額 | 作成 |
|---|---|---|
| `price_1T0kiNQ2eK2Q8eWb4OQhcvJo` | $8.00/月 | 2026-02-14 |
| `price_1ThWnuQ2eK2Q8eWbgAEh4fwE` | $3.00/月 | 2026-06-08 |

現行コードは**設定された1つの価格しか認めない**。

- [webhook/route.ts:66](../src/app/api/stripe/webhook/route.ts) — 価格が違うと
  `console.warn` して `return`。**200 を返すので Stripe は再送しない**
- [subscription-sync.ts:88](../src/lib/subscription-sync.ts) — 価格が違う契約を除外 → tier=free

→ `STRIPE_SUBSCRIPTION_PRICE_ID` が実際の課金価格と食い違っていれば、
**「支払ったのにPremiumにならず、リトライもされない」**という症状が正確に再現される。
これは今回の障害の有力な原因候補。

**確認事項**: Vercel Production の `STRIPE_SUBSCRIPTION_PRICE_ID` の値。
上記2つのどちらでもない、あるいは Sandbox の価格IDだった場合は確定。

**対応方針**: 旧価格の契約者を切り捨てないため、同期処理は
**単一価格ではなく「対象プロダクトの価格集合」**で判定すべき。Phase B2-2 で修正する。

#### 参考: 実顧客の解約フィードバック

`sub_1TpPod…`（`cus_Up3w1hpItD7pH7` / profile `0c00d735`）は**実在の課金顧客**。
2026-07-04 に $3 で契約し、2026-07-31 に解約。理由欄に
"Tuve una mala experiencia al suscribirme"（登録時に悪い体験をした）とある。
Premium が正しく付与されなかった可能性があり、B2 完了後に個別確認・返金要否を判断する。

**検証クエリ**（実行してゼロ件になること）:

```sql
select id, subscription_tier, subscription_status, subscription_expires_at
from public.profiles
where (subscription_tier = 'free'    and subscription_status = 'canceling')
   or (subscription_tier = 'premium' and subscription_expires_at < now());
```

**受け入れ条件**: 上記クエリが0件。修復内容と判断理由を本書の「実施記録」に追記。

---

### Phase B2 — entitlements 導入と読み取りの一本化 🔵 コア

最も影響範囲が大きいので4段階に分ける。**各段階でデプロイ可能**にする。

#### B2-1: テーブル追加（後方互換・読み取り側は無変更）

- [ ] `billing_customers` / `billing_subscriptions` / `entitlements` の migration SQL を作成
- [ ] RLS ポリシー設計（本人のみ自分の行を読める／書き込みは service_role のみ）
- [ ] SQLを提示 → ユーザーが手動実行
- [ ] 既存6件のPremium（Stripe2 / legacy3 / manual1）を `entitlements` へ移送するバックフィルSQL

#### B2-2: 書き込みの拡張（二重書き）

- [ ] `syncCustomerSubscriptionState` を `reconcileUserBilling` へ拡張
  - Stripe再取得 → `billing_subscriptions` upsert → `entitlements` 再計算
  - `profiles.subscription_*` も当面**併せて書く**（後方互換）
- [ ] `entitlements` に legacy / manual の行があっても Stripe 同期で消えないこと（source別に独立管理）
- [ ] ユニットテスト追加（vitest）: 混在ケース、期限切れ、`past_due`、複数サブスク

#### B2-3: 読み取りの切り替え

- [ ] `hasPremiumEntitlement(userId)` を新設し、`valid_until > now()` を**判定に含める**
- [ ] 以下を entitlements 経由へ変更:
  - [ ] `src/lib/club/access.ts`
  - [ ] `src/lib/account/membership.ts`
  - [ ] `src/components/Header.tsx`
  - [ ] `src/context/AuthContext.tsx`
  - [ ] `src/components/editor/contexts/AuthContext.tsx`
  - [ ] `src/components/editor/hooks/useAdminStats.ts`
  - [ ] `src/app/api/subscription/checkout/route.ts`（重複購入ガード）

#### B2-4: profiles への書き込み停止

- [ ] `profiles.subscription_*` の読み取りがゼロであることを grep で確認
- [ ] 書き込みを停止（カラムのDROPは Phase B6）

**受け入れ条件**: 全ライフサイクル（契約→解約予約→期間終了→再契約）をSandboxで通し、
`entitlements` と Stripe と画面表示が全段階で一致。legacy会員3名の権限が全段階で不変。

---

### Phase B3 — 多経路での自動収束

- [ ] `reconcileUserBilling` を5経路すべてから呼べるようにする
  - Webhook受信時 / 決済成功画面 / マイページ表示時 / 定期照合 / 管理者操作
- [ ] `vercel.json` に Vercel Cron を追加（1時間ごと）
- [ ] `/api/billing/reconcile` を新設（`CRON_SECRET` で保護、対象は直近更新＋期限接近ユーザー）
- [ ] マイページ表示時の再同期はレスポンスをブロックしない（Suspenseストリーミング側）

**受け入れ条件**: **Webhook宛先を意図的に無効化した状態**でSandbox契約 → 1時間以内に手動操作なしでPremium反映。
同様に解約 → 1時間以内に自動失効。

---

### Phase B4 — stripe_events 台帳とメール分離

- [ ] `stripe_events` テーブル追加（`stripe_event_id` unique で二重処理を防止）
- [ ] Webhookは「受信を即記録 → 処理 → 結果更新」の順に変更
- [ ] **恒久的失敗**（プロフィール不一致など再送しても直らないもの）は `dead` として記録し **200を返す**
  - 現状は500を返し続けStripeの配信キューを詰まらせる
- [ ] 壁紙購入メールをWebhookから分離
  - Webhookは `notification_status='pending'` のまま200を返す
  - 送信・再試行は cron の別処理が担当
- [ ] Premium通知も同じキュー方式へ統一

**受け入れ条件**: Resendのキーを意図的に無効化した状態で壁紙を購入 → 決済は正常に反映され
ダウンロード可能、`notification_status='pending'`。キー復旧後、cronで自動送信される。

---

### Phase B5 — 管理者の運用UI

- [ ] `/admin/billing` を新設
  - [ ] ユーザー検索 → 現在の entitlements / billing_subscriptions 表示
  - [ ] **「Stripeと再同期」ボタン**（`reconcileUserBilling` を呼ぶだけ）
  - [ ] `stripe_events` の失敗・dead 一覧
  - [ ] 未反映の `wallpaper_purchases` 一覧
- [ ] 手動Premium付与は**禁止ではなく監査可能に**する
  - `entitlements` に `source='manual'` + `granted_by` + `reason` 必須 + `valid_until` 必須
  - Stripe同期はこの行を消さない

**受け入れ条件**: Webhookを止めた状態で契約 → 管理画面の「Stripeと再同期」だけで正しい状態に復旧できる。

---

### Phase B6 — 旧資産の完全削除

- [ ] Supabase Edge Function 削除: `stripe-webhook` / `create-checkout-session` / `create-portal-session`
- [ ] `imagine/supabase/functions/` から該当ディレクトリ削除（`debug-stripe` / `diag-portal` も）
- [ ] `profiles.subscription_tier` / `subscription_status` / `subscription_expires_at` を DROP
  - **十分な観察期間（最低2週間）とバックアップの後**
- [ ] 移植時の互換shim・stale commentの整理（README「Later-Session Backlog」2番と統合）

**受け入れ条件**: 決済に関わるコードパスが Next.js リポジトリ内だけに存在する。

---

### Phase B7 — 設定検査の自動化

- [ ] `scripts/check-billing-config.mjs` を作成。以下を機械的に検査:
  - [ ] Stripeモードが test か live か（環境と一致するか）
  - [ ] Price が同一Stripeアカウントに属するか
  - [ ] Price が subscription / payment の想定どおりか
  - [ ] Subscriptions Read 権限があるか
  - [ ] 必要なWebhook宛先が存在するか
  - [ ] 必要な5イベントが登録されているか
  - [ ] Webhookへ署名付きテスト送信ができるか
- [ ] 1項目でも不一致ならデプロイを止める（非ゼロ終了）
- [ ] `package.json` に `check:billing` を追加し、[BILLING_RUNBOOK.md](./BILLING_RUNBOOK.md) の手順から人力チェックを削減

**受け入れ条件**: 環境変数を1つ意図的に別モードのものに差し替えると、検査が失敗して止まる。

---

## 5. 進め方のルール

- **セッション開始時に必ず本書を開き、「進捗サマリ」の未完了フェーズから再開する**
- フェーズは飛ばさない。B0 が終わるまで B2 以降に着手しない
- DB変更は**必ずSQLを提示してユーザーが手動実行**（MCPは書き込み不可）
- 各フェーズ完了時に、本書の進捗サマリと「実施記録」を更新する
- 本番の実決済を伴う確認は、必ず低額・自己アカウントで行う
- Sandbox と本番で**同じ手順**を通す。Sandboxで通っていない状態を本番に出さない

---

## 6. 進捗サマリ

| Phase | 内容 | 状態 | 完了日 |
|---|---|---|---|
| B0 | 止血（旧Webhook宛先の遮断） | ✅ 両環境で無効化を確認 | 2026-08-08 |
| B0-c | `stripe_customer_id` の共有を止める（UNIQUE制約） | ✅ 完了 | 2026-08-08 |
| B0-d | Webhook の api_version を live/sandbox で揃える（要エンドポイント再作成） | ⬜ 未着手 | — |
| B0-b | 環境分離 → 分離せず `livemode` 列で識別（B2に統合） | ⬜ 既知・許容 | — |
| B1 | 破損データの棚卸しと修復 | 🟡 突合完了・修復未実施 | — |
| B2-1 | entitlements テーブル追加 | ⬜ 未着手 | — |
| B2-2 | 書き込みの拡張（二重書き） | ⬜ 未着手 | — |
| B2-3 | 読み取りの切り替え | ⬜ 未着手 | — |
| B2-4 | profiles 書き込み停止 | ⬜ 未着手 | — |
| B3 | 多経路での自動収束（cron / 再同期） | ⬜ 未着手 | — |
| B4 | stripe_events 台帳・メール分離 | ⬜ 未着手 | — |
| B5 | 管理者の運用UI | ⬜ 未着手 | — |
| B6 | 旧資産の完全削除 | ⬜ 未着手 | — |
| B7 | 設定検査の自動化 | ⬜ 未着手 | — |

凡例: ⬜ 未着手 / 🟡 進行中 / ✅ 完了

---

## 7. 実施記録

各フェーズ完了時に、**何を確認して完了としたか**を1〜3行で追記する。

- 2026-08-08: 現状調査を実施。本書を作成。DB破損3件・旧Edge Function稼働・
  Premium判定の単一カラム依存を確認（詳細は「2. 現状の確定した欠陥」）。
- 2026-08-08: Stripe MCP / Vercel MCP を有効化。Sandbox の Webhook 宛先を確認し、
  旧Supabase宛先が `disabled` であることを確認（Sandbox側のB0は達成）。
  Stripe MCP・CLI ともに Sandbox スコープのため **Live は未確認**。B0 の残作業。
  Vercel プロジェクト（`prj_66h8Sg7hAbcFQbR1ht6rSI85b41I` / `team_kV7X8asP6ThcbNj4UTaWNIz9`）の
  接続も確認済み。
- 2026-08-08: Stripe 本番アカウント（`acct_1SgTTmQ2eK2Q8eWb` / `IMAGINE`）へ接続。
  **B0完了**（live でも旧宛先は `disabled`）。同時に4つの新事実が判明:
  (1) Sandboxテストが本番DBを汚染している（→ B0-b 新設・最優先）、
  (2) `cus_Tz3oVVH4RyExCc` を2プロフィールが共有（無限リトライ＋誤課金リスク）、
  (3) live に有効な価格が2つあり価格ID不一致が障害の有力候補、
  (4) Webhook の api_version が live=clover固定 / sandbox=既定追従で不一致。
  Vercel のログ保持期間（Pro=1日）が短く、過去の webhook 失敗ログは追跡不可。
