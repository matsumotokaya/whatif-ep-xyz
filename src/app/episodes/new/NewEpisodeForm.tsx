"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createEpisodeAction } from "./actions";

const initialState = {
  message: null,
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm text-muted">
      {children}
    </label>
  );
}

export function NewEpisodeForm() {
  const [state, formAction, pending] = useActionState(
    createEpisodeAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Episode Info</h2>
          <p className="mt-1 text-sm text-muted">
            エピソード番号から `id` と R2 の保存先を自動で決めます。
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="number">エピソード番号</FieldLabel>
            <input
              id="number"
              name="number"
              type="text"
              required
              inputMode="numeric"
              pattern="[0-9]{4,}"
              placeholder="0442"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="title">タイトル</FieldLabel>
            <input
              id="title"
              name="title"
              type="text"
              required
              placeholder="Episode 0442"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="category">カテゴリー</FieldLabel>
            <input
              id="category"
              name="category"
              type="text"
              placeholder="minimal"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="releasedOn">公開日</FieldLabel>
            <input
              id="releasedOn"
              name="releasedOn"
              type="date"
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel htmlFor="productUrl">STORES.jp URL</FieldLabel>
          <input
            id="productUrl"
            name="productUrl"
            type="url"
            placeholder="https://whatif.stores.jp/items/..."
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
          />
        </div>

        <label className="flex items-center gap-3 text-sm text-foreground">
          <input
            name="isPublished"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-border bg-background text-neon-cyan focus:ring-neon-cyan"
          />
          追加後すぐ公開する
        </label>
      </section>

      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Images</h2>
          <p className="mt-1 text-sm text-muted">
            オリジナル画像は PNG 必須です。サムネイルは任意で、未指定時は JPG を自動生成します。
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="originalFile">オリジナル PNG</FieldLabel>
            <input
              id="originalFile"
              name="originalFile"
              type="file"
              required
              accept="image/png,image/jpeg"
              className="block w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-neon-cyan file:px-3 file:py-2 file:text-sm file:font-medium file:text-background"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor="thumbnailFile">サムネイル</FieldLabel>
            <input
              id="thumbnailFile"
              name="thumbnailFile"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-surface-hover file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            />
            <p className="text-xs text-muted">
              未指定時は original PNG から `800px` 幅の JPG サムネイルを自動生成します。
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-muted">
          保存先:
          <span className="ml-2 font-mono text-foreground">
            originals/&lt;number&gt;.png
          </span>
          <span className="mx-2 text-muted">/</span>
          <span className="font-mono text-foreground">
            thumbnails/&lt;number&gt;.&lt;ext&gt;
          </span>
        </p>

        {state.message && (
          <p aria-live="polite" className="mt-4 text-sm text-red-400">
            {state.message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center rounded-lg bg-neon-cyan px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "アップロード中..." : "エピソードを追加"}
          </button>
          <Link
            href="/episodes"
            className="inline-flex items-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            キャンセル
          </Link>
        </div>
      </section>
    </form>
  );
}
