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

export function VideoFactoryClient() {
  const [state, setState] = useState<LoadState>("loading");
  const [banners, setBanners] = useState<BannerSummary[]>([]);
  const [search, setSearch] = useState("");
  const [sequence, setSequence] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  const toggle = (id: string) => {
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
    try {
      const res = await fetch(
        `/api/video-factory/banners?id=${sequence.join(",")}`
      );
      if (!res.ok) {
        setDownloadError(`取得に失敗しました (${res.status})`);
        return;
      }
      const payload = await res.json();
      const blob = new Blob([JSON.stringify(payload.fixtures, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "video-fixtures.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("取得に失敗しました");
    } finally {
      setDownloading(false);
    }
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
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/60">
            Sequence — {sequence.length} banners
          </h2>
          <button
            onClick={downloadFixtures}
            disabled={sequence.length === 0 || downloading}
            className="border border-[#ff6b35] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ff6b35] transition-colors hover:bg-[#ff6b35] hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
          >
            {downloading ? "Fetching…" : "Download fixtures JSON"}
          </button>
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
        <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-[0.15em] text-white/35">
          JSONは lab/video/imagine-promo/src/fixtures/ に置いて Remotion から読み込む。
          個別取得は scripts/fetch-banner.sh &lt;ID&gt; &lt;slug&gt; でも可。
        </p>
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
