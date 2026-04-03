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

const accentClasses: Record<ClubItem["accent"], string> = {
  cyan: "border-neon-cyan/30 bg-[linear-gradient(135deg,rgba(0,240,255,0.14),rgba(20,20,32,0.95))]",
  magenta:
    "border-neon-magenta/30 bg-[linear-gradient(135deg,rgba(255,0,229,0.14),rgba(20,20,32,0.95))]",
  green:
    "border-neon-green/30 bg-[linear-gradient(135deg,rgba(0,255,136,0.12),rgba(20,20,32,0.95))]",
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
    <div className="relative overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(0,240,255,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,0,229,0.16),transparent_28%),linear-gradient(180deg,rgba(10,10,15,1),rgba(14,14,22,1))]" />
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs uppercase tracking-[0.32em] text-neon-cyan/80">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-semibold tracking-[0.12em] text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted sm:text-base">
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
            "The Club uses the shared WHATIF account system. Sign in first, then premium members can continue into the library.",
          actionHref: `/auth/login${nextQuery}`,
          actionLabel: "Log in",
        }
      : {
          title: "Premium access required",
          description:
            "Your account is authenticated, but The Club is reserved for premium members. Once premium is enabled, the library and downloads will open here.",
          actionHref: "/",
          actionLabel: "Back to gallery",
        };

  return (
    <section className="rounded-3xl border border-border bg-surface/80 p-6 shadow-[0_0_40px_rgba(0,0,0,0.2)] backdrop-blur">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neon-magenta/80">
            Access gate
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <Link
            href={copy.actionHref}
            className="inline-flex items-center justify-center rounded-full border border-neon-cyan/40 bg-neon-cyan/10 px-5 py-3 text-sm font-medium text-neon-cyan transition-colors hover:bg-neon-cyan/15"
          >
            {copy.actionLabel}
          </Link>
          <span className="text-xs text-muted">
            Shared account base, premium gated content
          </span>
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
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border bg-surface/70 px-4 py-4"
        >
          <dt className="text-xs uppercase tracking-[0.25em] text-muted">
            {item.label}
          </dt>
          <dd className="mt-2 text-xl font-semibold text-foreground">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ClubItemCard({ item }: { item: ClubItem }) {
  return (
    <article
      className={`overflow-hidden rounded-3xl border p-5 shadow-[0_0_30px_rgba(0,0,0,0.22)] ${accentClasses[item.accent]}`}
    >
      {item.coverImageUrl ? (
        <div className="mb-4 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
          <Image
            src={item.coverImageUrl}
            alt={`${item.title} preview`}
            width={1200}
            height={675}
            className="h-48 w-full object-cover"
            sizes="(min-width: 1024px) 420px, 100vw"
          />
        </div>
      ) : (
        <div className="mb-4 flex h-48 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/30 text-[11px] uppercase tracking-[0.3em] text-muted">
          No preview
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
              {kindLabel[item.kind]}
            </span>
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
              {item.status === "preview" ? "Preview" : "Coming soon"}
            </span>
          </div>
          <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
        </div>
        <div className="rounded-2xl border border-border bg-background/50 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-[0.24em] text-muted">
            File
          </div>
          <div className="mt-1 text-sm text-foreground">{item.fileSizeLabel}</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-muted">{item.description}</p>

      <div className="mt-5 grid gap-2 text-sm text-foreground/90">
        {item.details.map((detail) => (
          <div key={detail} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-neon-cyan" />
            <span>{detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background/50 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
        <Link
          href={`/the-club/${item.slug}`}
          className="inline-flex shrink-0 items-center rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-4 py-2 text-sm font-medium text-neon-magenta transition-colors hover:bg-neon-magenta/15"
        >
          Open
        </Link>
      </div>
    </article>
  );
}

export function ClubDetailPanel({
  item,
}: {
  item: ClubItem;
}) {
  return (
    <section
      className={`rounded-3xl border p-6 shadow-[0_0_40px_rgba(0,0,0,0.24)] ${accentClasses[item.accent]}`}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
              {kindLabel[item.kind]}
            </span>
            <span className="rounded-full border border-border/70 bg-background/60 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-muted">
              {item.status === "preview" ? "Preview" : "Coming soon"}
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[0.02em] text-foreground">
            {item.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            {item.description}
          </p>
          <div className="mt-6 grid gap-3 text-sm text-foreground/90">
            {item.details.map((detail) => (
              <div key={detail} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-neon-magenta" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background/55 p-5">
          {item.coverImageUrl ? (
            <div className="mb-5 overflow-hidden rounded-2xl border border-border/70 bg-background/40">
              <Image
                src={item.coverImageUrl}
                alt={`${item.title} preview`}
                width={1400}
                height={788}
                className="h-52 w-full object-cover"
                sizes="(min-width: 1024px) 480px, 100vw"
              />
            </div>
          ) : (
            <div className="mb-5 flex h-52 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/30 text-[11px] uppercase tracking-[0.3em] text-muted">
              No preview
            </div>
          )}
          <p className="text-xs uppercase tracking-[0.3em] text-neon-cyan/80">
            Download state
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-sm text-muted">File name</div>
              <div className="mt-1 text-foreground">{item.fileName}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Size</div>
              <div className="mt-1 text-foreground">{item.fileSizeLabel}</div>
            </div>
            <div>
              <div className="text-sm text-muted">Status</div>
              <div className="mt-1 text-foreground">
                {item.status === "preview"
                  ? "Preview available, private asset pending"
                  : "Coming soon"}
              </div>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/60 p-4 text-sm leading-7 text-muted">
            Downloads are delivered via signed URLs. Previews use stored cover
            images when available.
          </div>
        </div>
      </div>
    </section>
  );
}
