"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  deleteEpisodeAction,
  updateEpisodeAction,
  type EditEpisodeState,
} from "./actions";

const initialState: EditEpisodeState = {
  message: null,
};

interface EditableEpisode {
  id: number;
  number: string;
  title: string;
  category: string;
  productUrl: string | null;
  releasedOn: string | null;
  originalStorageKey: string;
  thumbnailStorageKey: string | null;
  isPublished: boolean;
  publishedAt: string | null;
}

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

export function EditEpisodeForm({ episode }: { episode: EditableEpisode }) {
  const [state, formAction, pending] = useActionState(
    updateEpisodeAction,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteEpisodeAction,
    initialState
  );

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight neon-text-cyan">
            Edit Episode
          </h1>
          <p className="mt-2 text-sm text-muted">
            エピソードの情報を更新します。画像を変更しない場合は空のまま送信してください。
          </p>
        </div>
        <Link
          href={`/episodes/${episode.number}`}
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-hover"
        >
          戻る
        </Link>
      </div>

      <form action={formAction} className="space-y-8">
        <section className="grid gap-5 rounded-2xl border border-border bg-surface p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Episode Info
            </h2>
            <p className="mt-1 text-sm text-muted">
              番号は変更できません。必要な項目を編集してください。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor="number">エピソード番号</FieldLabel>
              <input
                id="number"
                name="number"
                type="text"
                readOnly
                inputMode="numeric"
                pattern="[0-9]{4,}"
                defaultValue={episode.number}
                className="w-full rounded-lg border border-border bg-surface-hover px-4 py-3 text-foreground outline-none"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="title">タイトル</FieldLabel>
              <input
                id="title"
                name="title"
                type="text"
                required
                defaultValue={episode.title}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="category">カテゴリー</FieldLabel>
              <input
                id="category"
                name="category"
                type="text"
                defaultValue={episode.category}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
              />
            </div>

            <div className="space-y-2">
              <FieldLabel htmlFor="releasedOn">公開日</FieldLabel>
              <input
                id="releasedOn"
                name="releasedOn"
                type="date"
                defaultValue={episode.releasedOn ?? ""}
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
              defaultValue={episode.productUrl ?? ""}
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors focus:border-neon-cyan"
            />
          </div>

          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              name="isPublished"
              type="checkbox"
              defaultChecked={episode.isPublished}
              className="h-4 w-4 rounded border-border bg-background text-neon-cyan focus:ring-neon-cyan"
            />
            公開状態にする
          </label>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-surface p-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Images</h2>
            <p className="mt-1 text-sm text-muted">
              画像を差し替える場合のみ選択してください。オリジナルを変更してサムネイルが未指定の場合、
              800px 幅の JPG を自動生成します。
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel htmlFor="originalFile">オリジナル PNG</FieldLabel>
            <input
              id="originalFile"
              name="originalFile"
              type="file"
              accept="image/png,image/jpeg"
              className="block w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-neon-cyan file:px-3 file:py-2 file:text-sm file:font-medium file:text-background"
            />
              <p className="text-xs text-muted">
                現在: <span className="font-mono">{episode.originalStorageKey}</span>
              </p>
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
                現在:{" "}
                <span className="font-mono">
                  {episode.thumbnailStorageKey ?? "なし"}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-6">
          {state.message && (
            <p aria-live="polite" className="text-sm text-red-400">
              {state.message}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center rounded-lg bg-neon-cyan px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "更新中..." : "更新する"}
            </button>
            <Link
              href="/episodes"
              className="inline-flex items-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
            >
              エピソード一覧
            </Link>
          </div>
        </section>
      </form>

      <form action={deleteAction} className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
        <input type="hidden" name="number" value={episode.number} />
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-red-300">
              Delete Episode
            </h2>
            <p className="mt-1 text-sm text-muted">
              この操作は取り消せません。R2 の画像と DB レコードを削除します。
            </p>
          </div>

          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              name="confirmDelete"
              className="h-4 w-4 rounded border-border bg-background text-red-400 focus:ring-red-400"
            />
            削除することを確認しました
          </label>

          {deleteState.message && (
            <p aria-live="polite" className="text-sm text-red-400">
              {deleteState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={deletePending}
            className="inline-flex items-center justify-center rounded-lg border border-red-400/60 bg-red-500/10 px-6 py-3 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            {deletePending ? "削除中..." : "エピソードを削除"}
          </button>
        </div>
      </form>
    </div>
  );
}
