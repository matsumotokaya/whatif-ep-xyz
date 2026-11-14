# Recommend（ギャラリーの既定モード）

この文書が答える問い: Recommend に何が出るか / 誰の保存を使うか / 使うユーザーの変え方

- `/works/recommend`。シリーズ選択の先頭で、`/` とヘッダーの Gallery リンクの行き先。実体は `src/lib/works.ts` の `RECOMMEND_SLUG`（DB の `work_series` には無い仮想モード）。
- 中身: 指定ユーザー（キュレーター）が保存（ブックマーク）した公開作品を、シリーズをまたいで保存の新しい順に並べたもの。管理者が選んだ作品を前面に出すための仕組み（2026-11-14 ユーザー決定）。
- 番号範囲・タグ・壁紙の絞り込みは出さない（シリーズ横断で意味が無いため）。並び順（新しい保存順／古い保存順）と「保存済み」は使える。
- 反映: キュレーターが保存・解除してから最大2分（`unstable_cache` 120秒、タグ `recommend`）。カード API は CDN に最大5分キャッシュされる。

## キュレーターの変え方（UI なし・SQL で変更）

設定は `public.site_settings` の `recommend_curator_user_id`（値は auth ユーザー id の JSON 文字列）。初期値は `matsumotokaya@gmail.com`。

```sql
update public.site_settings
set value = (select to_jsonb(id::text) from auth.users where email = '<新しいメール>'),
    updated_at = now()
where key = 'recommend_curator_user_id';
```

テーブルは RLS 有効・ポリシー無し（サーバーの service role だけが読む）。
