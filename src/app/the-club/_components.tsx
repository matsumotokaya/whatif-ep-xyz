import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ClubAccessState } from "@/lib/club/access";
import type { ClubItem, ClubItemKind } from "@/lib/club/catalog";

const kindLabel: Record<ClubItemKind, string> = {
  wallpaper: "Wallpaper",
  zip: "ZIP",
  reel: "Reel",
  other: "Archive",
  book: "Book",
};

export function ClubShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-muted">
            {eyebrow}
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted">
            {description}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ClubAccessNotice({
  status,
  nextPath,
}: {
  status: ClubAccessState;
  nextPath?: string;
}) {
  const nextQuery =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? `?next=${encodeURIComponent(nextPath)}`
      : "";
  const copy =
    status === "anonymous"
      ? {
          title: "Sign in to continue",
          description:
            "The Club is exclusive to authenticated WHATIF members. Sign in to access the library and member content.",
          actionHref: `/auth/login${nextQuery}`,
          actionLabel: "Log in",
        }
      : {
          title: "Premium access required",
          description:
            "Your account is active, but The Club is reserved for premium members. Contact us to upgrade your membership.",
          actionHref: "/",
          actionLabel: "Back to gallery",
        };

  return (
    <section className="rounded-2xl border border-border bg-surface p-8">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{copy.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <Link
            href={copy.actionHref}
            className="btn-press inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-3 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
          >
            {copy.actionLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ClubStatsRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]">
      {items.map((item) => (
        <div key={item.label} className="bg-surface px-6 py-5">
          <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
            {item.label}
          </dt>
          <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ClubItemCard({ item }: { item: ClubItem }) {
  return (
    <article className="hover-lift overflow-hidden rounded-2xl border border-border bg-surface">
      {item.coverImageUrl ? (
        <div className="overflow-hidden border-b border-border">
          <Image
            src={item.coverImageUrl}
            alt={`${item.title} preview`}
            width={1200}
            height={675}
            className="h-52 w-full object-cover transition-transform duration-500 ease-out hover:scale-[1.03]"
            sizes="(min-width: 1024px) 420px, 100vw"
          />
        </div>
      ) : (
        <div className="flex h-52 items-center justify-center border-b border-border bg-surface-hover text-[11px] uppercase tracking-[0.3em] text-muted">
          No preview
        </div>
      )}

      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
            {kindLabel[item.kind]}
          </span>
        </div>

        <h3 className="mt-4 text-xl font-bold text-foreground">{item.title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted">{item.description}</p>

        <ul className="mt-5 space-y-2 text-sm text-foreground">
          {item.details.map((detail) => (
            <li key={detail} className="flex items-start gap-3">
              <span className="mt-2 h-1 w-4 shrink-0 border-t border-foreground/30" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
          <div className="flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] uppercase tracking-[0.2em] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            href={`/the-club/${item.slug}`}
            className="btn-press inline-flex shrink-0 items-center rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium tracking-widest text-background transition-opacity hover:opacity-80"
          >
            Open
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ClubDetailPanel({ item }: { item: ClubItem }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div className="p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
              {kindLabel[item.kind]}
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-bold tracking-tight text-foreground">
            {item.title}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted">{item.description}</p>

          <ul className="mt-6 space-y-3 text-sm text-foreground">
            {item.details.map((detail) => (
              <li key={detail} className="flex items-start gap-3">
                <span className="mt-2 h-1 w-4 shrink-0 border-t border-foreground/30" />
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border p-8 lg:border-l lg:border-t-0">
          {item.coverImageUrl ? (
            <div className="mb-6 overflow-hidden rounded-lg border border-border">
              <Image
                src={item.coverImageUrl}
                alt={`${item.title} preview`}
                width={1400}
                height={788}
                className="h-48 w-full object-cover"
                sizes="(min-width: 1024px) 480px, 100vw"
              />
            </div>
          ) : (
            <div className="mb-6 flex h-48 items-center justify-center rounded-lg border border-border bg-surface-hover text-[11px] uppercase tracking-[0.3em] text-muted">
              No preview
            </div>
          )}

          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
                File name
              </dt>
              <dd className="mt-1 text-foreground">{item.fileName}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.28em] text-muted">
                Size
              </dt>
              <dd className="mt-1 text-foreground">{item.fileSizeLabel}</dd>
            </div>
          </dl>

          <p className="mt-6 text-xs leading-6 text-muted">
            Downloads are delivered via signed URLs.
          </p>
        </div>
      </div>
    </section>
  );
}
