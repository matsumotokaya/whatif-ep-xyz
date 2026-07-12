"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface BannerSummary {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  elementCount: number;
  updatedAt: string | null;
}

interface FixtureMeta {
  count: number;
  width: number;
  height: number;
}

type LoadState = "loading" | "ready" | "unauthorized" | "error";

function aspectLabel(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.02) return "9:16";
  if (Math.abs(ratio - 16 / 9) < 0.02) return "16:9";
  if (Math.abs(ratio - 4 / 5) < 0.02) return "4:5";
  if (Math.abs(ratio - 1) < 0.02) return "1:1";
  return `${width}×${height}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// slug for filenames/imports, PascalCase for the Remotion composition id
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "sequence";
}

function toCamel(slug: string): string {
  return slug.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function toPascal(slug: string): string {
  const camel = toCamel(slug);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function buildInstructions(slug: string, meta: FixtureMeta): string {
  const camel = toCamel(slug);
  const pascal = toPascal(slug);
  const isSequence = meta.count > 1;

  const rootSnippet = isSequence
    ? `import ${camel}Raw from "./fixtures/${slug}.json";
const ${camel} = ${camel}Raw as BannerData[];

// inside <RemotionRoot>:
<Composition
  id="${pascal}"
  component={BannerSequence}
  durationInFrames={sequenceDuration(${camel})}
  fps={30}
  width={${camel}[0].width}
  height={${camel}[0].height}
  defaultProps={{ banners: ${camel} }}
/>`
    : `import ${camel}Raw from "./fixtures/${slug}.json";
const ${camel} = (${camel}Raw as BannerData[])[0];

// inside <RemotionRoot>:
<Still
  id="${pascal}"
  component={BannerRenderer}
  width={${camel}.width}
  height={${camel}.height}
  defaultProps={{ banner: ${camel} }}
/>`;

  return `# 1. Save the downloaded JSON here:
lab/video/imagine-promo/src/fixtures/${slug}.json

# 2. Add to lab/video/imagine-promo/src/Root.tsx
#    (BannerRenderer / BannerSequence / sequenceDuration are already
#    imported there if you have other banner compositions; add them
#    from "./banner/BannerRenderer" and "./banner/BannerSequence" if not)
${rootSnippet}

# 3. Preview
cd lab/video/imagine-promo && npm run dev
# -> Remotion Studio, select "${pascal}" in the sidebar

# 4. Render the final MP4
npx remotion render ${pascal} out/${slug}.mp4`;
}

export function VideoFactoryClient() {
  const [state, setState] = useState<LoadState>("loading");
  const [banners, setBanners] = useState<BannerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [sequence, setSequence] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [fixtureMeta, setFixtureMeta] = useState<FixtureMeta | null>(null);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (searchTerm: string) => {
    setState("loading");
    try {
      const query = searchTerm
        ? `?search=${encodeURIComponent(searchTerm)}`
        : "";
      const res = await fetch(`/api/video-factory/banners${query}`);
      if (res.status === 401 || res.status === 403) {
        setState("unauthorized");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const payload = await res.json();
      setBanners(payload.banners ?? []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const bannerById = useMemo(
    () => new Map(banners.map((banner) => [banner.id, banner])),
    [banners]
  );

  // keep the slug in sync with the sequence until the user edits it by hand
  useEffect(() => {
    if (slugTouched) return;
    if (sequence.length === 0) {
      setSlug("");
      return;
    }
    const first = bannerById.get(sequence[0]);
    const base = first ? slugify(first.name) : "sequence";
    setSlug(sequence.length > 1 ? `${base}-seq${sequence.length}` : base);
  }, [sequence, bannerById, slugTouched]);

  const toggle = (id: string) => {
    setFixtureMeta(null);
    setSequence((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const move = (index: number, delta: number) => {
    setSequence((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const downloadFixtures = async () => {
    if (sequence.length === 0) return;
    setDownloading(true);
    setDownloadError(null);
    setFixtureMeta(null);
    try {
      const res = await fetch(
        `/api/video-factory/banners?id=${sequence.join(",")}`
      );
      if (!res.ok) {
        setDownloadError(`取得に失敗しました (${res.status})`);
        return;
      }
      const payload = await res.json();
      const fixtures = payload.fixtures ?? [];
      if (fixtures.length === 0) {
        setDownloadError("取得できるバナーがありませんでした");
        return;
      }
      const blob = new Blob([JSON.stringify(fixtures, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug || "sequence"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setFixtureMeta({
        count: fixtures.length,
        width: fixtures[0].width,
        height: fixtures[0].height,
      });
    } catch {
      setDownloadError("取得に失敗しました");
    } finally {
      setDownloading(false);
    }
  };

  const instructions = useMemo(
    () => (fixtureMeta ? buildInstructions(slug || "sequence", fixtureMeta) : null),
    [fixtureMeta, slug]
  );

  const copyInstructions = async () => {
    if (!instructions) return;
    await navigator.clipboard.writeText(instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (state === "unauthorized") {
    return (
      <p className="py-24 text-center font-mono text-xs tracking-[0.3em] text-white/50">
        ADMIN ONLY — ログインとadminロールが必要です
      </p>
    );
  }

  return (
    <div>
      {/* search */}
      <div className="flex items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") load(search);
          }}
          placeholder="バナー名で検索…"
          className="w-full max-w-sm border border-white/20 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none"
        />
        <button
          onClick={() => load(search)}
          className="border border-white/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/70 transition-colors hover:border-white/50 hover:text-white"
        >
          Search
        </button>
      </div>

      {/* sequence tray */}
      <div className="mt-6 border border-white/15 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
            Sequence — {sequence.length} banners
          </h2>
          <div className="flex items-center gap-2">
            <input
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(slugify(event.target.value));
              }}
              placeholder="composition-slug"
              disabled={sequence.length === 0}
              className="w-48 border border-white/20 bg-black/30 px-2.5 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none disabled:opacity-40"
            />
            <button
              onClick={downloadFixtures}
              disabled={sequence.length === 0 || downloading}
              className="border border-[#ff6b35] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ff6b35] transition-colors hover:bg-[#ff6b35] hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
            >
              {downloading ? "Fetching…" : "Download fixtures JSON"}
            </button>
          </div>
        </div>
        {downloadError && (
          <p className="mt-2 text-xs text-red-400">{downloadError}</p>
        )}
        {sequence.length === 0 ? (
          <p className="mt-3 text-xs text-white/40">
            下の一覧からバナーをクリックして、動画のシーケンス順に追加してください。
          </p>
        ) : (
          <ol className="mt-3 space-y-1">
            {sequence.map((id, index) => {
              const banner = bannerById.get(id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-3 border border-white/10 bg-black/30 px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-[10px] text-[#ff6b35]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {banner?.name ?? id}
                  </span>
                  <span className="font-mono text-[10px] text-white/40">
                    {aspectLabel(banner?.width ?? null, banner?.height ?? null)}
                  </span>
                  <button
                    onClick={() => move(index, -1)}
                    className="px-1 text-white/50 hover:text-white"
                    aria-label="move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(index, 1)}
                    className="px-1 text-white/50 hover:text-white"
                    aria-label="move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggle(id)}
                    className="px-1 text-white/50 hover:text-red-400"
                    aria-label="remove"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {instructions && (
          <div className="mt-4 border border-white/15 bg-black/40">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/50">
                Next steps
              </span>
              <button
                onClick={copyInstructions}
                className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#ff6b35] hover:text-white"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre p-3 font-mono text-[11px] leading-relaxed text-white/80">
              {instructions}
            </pre>
          </div>
        )}
      </div>

      {/* banner grid */}
      {state === "loading" && (
        <p className="py-16 text-center font-mono text-xs tracking-[0.3em] text-white/40">
          LOADING…
        </p>
      )}
      {state === "error" && (
        <p className="py-16 text-center text-sm text-red-400">
          読み込みに失敗しました
        </p>
      )}
      {state === "ready" && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {banners.map((banner) => {
            const selectedIndex = sequence.indexOf(banner.id);
            const selected = selectedIndex >= 0;
            return (
              <button
                key={banner.id}
                onClick={() => toggle(banner.id)}
                className={`group relative overflow-hidden border text-left transition-colors ${
                  selected
                    ? "border-[#ff6b35]"
                    : "border-white/15 hover:border-white/40"
                }`}
              >
                <div className="relative aspect-square bg-white/5">
                  {banner.thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={banner.thumbnailUrl}
                      alt={banner.name}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-mono text-[9px] tracking-[0.3em] text-white/30">
                      NO THUMB
                    </div>
                  )}
                  {selected && (
                    <span className="absolute left-2 top-2 bg-[#ff6b35] px-2 py-0.5 font-mono text-[10px] font-bold text-black">
                      {String(selectedIndex + 1).padStart(2, "0")}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs text-white/90">{banner.name}</p>
                  <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-white/40">
                    <span>
                      {aspectLabel(banner.width, banner.height) ?? "—"} ·{" "}
                      {banner.elementCount} elems
                    </span>
                    <span>{formatDate(banner.updatedAt)}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {banners.length === 0 && (
            <p className="col-span-full py-16 text-center text-sm text-white/40">
              バナーが見つかりません
            </p>
          )}
        </div>
      )}
    </div>
  );
}
