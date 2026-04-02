import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Club",
  description: "WHATIF EP - The Club member area",
};

export default function TheClubPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-wider neon-text-magenta">
          The Club
        </h1>
        <p className="max-w-md text-muted">
          Member-only area for exclusive content and downloads.
        </p>
        <a
          href="https://workflowdesign.chicappa.jp/whatif-ep/the-club/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-neon-magenta/50 bg-neon-magenta/10 px-6 py-3 text-sm font-medium text-neon-magenta transition-all hover:bg-neon-magenta/20 hover:shadow-[0_0_20px_rgba(255,0,229,0.2)]"
        >
          Enter The Club
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>
    </div>
  );
}
