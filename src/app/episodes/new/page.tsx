import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { NewEpisodeForm } from "./NewEpisodeForm";

export const metadata: Metadata = {
  title: "New Episode",
  description: "Create a new WHATIF episode",
};

export const runtime = "nodejs";

export default async function NewEpisodePage() {
  await requireAdmin("/episodes/new");

  return (
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <Link
            href="/episodes"
            className="text-sm text-muted transition-colors hover:text-neon-cyan"
          >
            ← Episodes
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight neon-text-cyan">
            New Episode
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            管理者のみが新しいエピソードを追加できます。画像は R2 にアップロードされ、
            メタデータは Supabase に保存されます。
          </p>
        </div>

        <NewEpisodeForm />
      </div>
    </div>
  );
}
