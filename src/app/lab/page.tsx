import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LAB",
  description: "WHATIF LAB — experimental UI prototypes and motion studies.",
  robots: { index: false },
};

const R2_BASE =
  process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/+$/, "") ||
  "https://pub-9339dc326a024891a297479881e66962.r2.dev";

interface Experiment {
  code: string;
  title: string;
  concept: string;
  href: string;
  thumb: string;
  stack: string;
  date: string;
  accent: string;
}

const EXPERIMENTS: Experiment[] = [
  {
    code: "EXP-04",
    title: "DETAIL FLOW",
    concept:
      "ギャラリー詳細ページの再発明。作品が奥行きのある回廊に浮かび、慣性スクロールでシームレスに前後の作品へ移動する。静止した瞬間にスペックが遅れて滑り込む。",
    href: "/lab/detail-scroll/index.html",
    thumb: "/lab/detail-scroll/assets/ep/e03.webp",
    stack: "CSS 3D · VIRTUAL SCROLL",
    date: "2026.07",
    accent: "#ff6b35",
  },
  {
    code: "EXP-03",
    title: "CHARACTER ARCHIVE",
    concept:
      "RPGのパーティ編成画面をモチーフにしたキャラクター紹介。切り替えのたびに画面全体がキャラ固有のアクセントカラーに染まる。壁紙ショップのオーバーレイ付き。",
    href: "/lab/character-archive/index.html",
    thumb: "/lab/character-archive/assets/chars/w01.webp",
    stack: "GAME UI · SWIPE ROSTER",
    date: "2026.07",
    accent: "#56ccf2",
  },
  {
    code: "EXP-02",
    title: "WHAT THE LAND",
    concept:
      "92秒のショートフィルムをスクロールで再生する長尺イントロ。低解像度リール全量＋再生ヘッド周辺の高解像度先読みの2層ロード。ギャラリーへの入口を常時保持。",
    href: "/lab/intro-scroll/long.html",
    thumb: "/lab/intro-scroll/frames/story_hi/f_0001.webp",
    stack: "SCROLL SCRUB · CANVAS",
    date: "2026.07",
    accent: "#b18cff",
  },
  {
    code: "EXP-01",
    title: "A FILM YOU SCROLL",
    concept:
      "縦スクロール量を動画のフレーム進行に直結させるティザー版イントロ。sticky + Canvas 連番フレームで video.currentTime のスクラブを回避し滑らかさを担保。",
    href: "/lab/intro-scroll/short.html",
    thumb: "/lab/intro-scroll/frames/hero/f_0001.webp",
    stack: "SCROLL SCRUB · 3 ACTS",
    date: "2026.07",
    accent: "#3ee08c",
  },
];

interface PromoVideo {
  code: string;
  title: string;
  concept: string;
  src: string;
  stack: string;
  date: string;
}

const PROMOS: PromoVideo[] = [
  {
    code: "MOV-04",
    title: "WALLPAPER PROMO",
    concept: "The Club 壁紙パックのティザー。音ハメ主導のカット構成。",
    src: `${R2_BASE}/lab/promo/WallpaperPromo.mp4`,
    stack: "REMOTION",
    date: "2026.06",
  },
  {
    code: "MOV-03",
    title: "IMAGINE PROMO — DARK",
    concept: "IMAGINE エディタ紹介のダークバリアント。",
    src: `${R2_BASE}/lab/promo/ImaginePromoDark.mp4`,
    stack: "REMOTION",
    date: "2026.06",
  },
  {
    code: "MOV-02",
    title: "IMAGINE PROMO",
    concept: "IMAGINE エディタのメインプロモーション。",
    src: `${R2_BASE}/lab/promo/ImaginePromo.mp4`,
    stack: "REMOTION",
    date: "2026.06",
  },
  {
    code: "MOV-01",
    title: "BANNER SEQUENCE",
    concept: "バナー生成フローのモーションスタディ。",
    src: `${R2_BASE}/lab/promo/BannerSequence.mp4`,
    stack: "REMOTION",
    date: "2026.06",
  },
];

function SectionHead({ kicker, note }: { kicker: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/15 pb-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.5em] text-white">
        {kicker}
      </h2>
      <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
        {note}
      </p>
    </div>
  );
}

export default function LabPage() {
  return (
    <div className="-mt-14 flex-1 bg-[#0a0a0d] pt-14 text-[#f4f2ec]">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        {/* ===== intro ===== */}
        <header className="py-8 sm:py-14">
          <p className="font-mono text-[9px] uppercase tracking-[0.5em] text-[#ff6b35]">
            WHATIF // RESEARCH &amp; DEVELOPMENT
          </p>
          <h1 className="mt-2 text-5xl font-black italic tracking-tight sm:text-7xl">
            LAB
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/60">
            次期UIとブランド表現の実験場。プロトタイプは本番データから独立した
            スタンドアロン構成で、ここからいつでも起動できる。
          </p>
        </header>

        {/* ===== ui experiments ===== */}
        <section className="mt-4">
          <SectionHead kicker="UI Experiments" note={`${EXPERIMENTS.length} PROTOTYPES`} />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {EXPERIMENTS.map((exp) => (
              <a
                key={exp.code}
                href={exp.href}
                target="_blank"
                rel="noopener"
                className="group relative block overflow-hidden border border-white/15 bg-[#101014] transition-colors hover:border-white/40"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={exp.thumb}
                    alt={exp.title}
                    loading="lazy"
                    className="h-full w-full object-cover object-top opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101014] via-transparent to-transparent" />
                  <span
                    className="absolute left-4 top-4 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[0.3em] text-[#0a0a0d]"
                    style={{ background: exp.accent }}
                  >
                    {exp.code}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xl font-black italic tracking-tight">
                      {exp.title}
                    </h3>
                    <span className="font-mono text-[9px] tracking-[0.2em] text-white/40">
                      {exp.date}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/55">{exp.concept}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-white/40">
                      {exp.stack}
                    </span>
                    <span
                      className="font-mono text-[9px] uppercase tracking-[0.3em] transition-transform group-hover:translate-x-1"
                      style={{ color: exp.accent }}
                    >
                      LAUNCH →
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* ===== promo / motion ===== */}
        <section className="mt-16">
          <SectionHead kicker="Promo / Motion" note={`${PROMOS.length} RENDERS · R2`} />
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            {PROMOS.map((mov) => (
              <div
                key={mov.code}
                className="overflow-hidden border border-white/15 bg-[#101014]"
              >
                <video
                  src={mov.src}
                  controls
                  preload="metadata"
                  playsInline
                  className="aspect-video w-full bg-black"
                />
                <div className="flex items-baseline justify-between gap-3 p-5">
                  <div>
                    <h3 className="text-lg font-black italic tracking-tight">
                      {mov.title}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-white/55">{mov.concept}</p>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[9px] tracking-[0.2em] text-white/40">
                    <div>{mov.code}</div>
                    <div className="mt-1">{mov.stack}</div>
                    <div className="mt-1">{mov.date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.3em] text-white/30">
            SOURCE: projects/whatif/lab/video (Remotion / Premiere — local workspace)
          </p>
        </section>
      </div>
    </div>
  );
}
