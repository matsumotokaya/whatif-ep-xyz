import Link from "next/link";
import { getTotalCount } from "@/lib/episodes";

export default function Home() {
  const totalEpisodes = getTotalCount();

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      {/* Hero */}
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-bold tracking-widest sm:text-8xl">
          <span className="neon-text-cyan">WHAT</span>
          <span className="neon-text-magenta">IF</span>
        </h1>

        <p className="max-w-md text-lg text-muted">
          Digital Art Gallery — {totalEpisodes} Episodes
        </p>

        <Link
          href="/episodes"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-lg border border-neon-cyan/50 bg-neon-cyan/5 px-8 py-3 text-sm font-medium text-neon-cyan transition-all hover:bg-neon-cyan/10 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)]"
        >
          <span>Enter Gallery</span>
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
