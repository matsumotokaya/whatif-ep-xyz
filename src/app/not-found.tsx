import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <h1 className="text-6xl font-bold neon-text-magenta">404</h1>
      <p className="mt-4 text-lg text-muted">Page not found</p>
      <Link
        href="/"
        className="mt-6 text-sm text-neon-cyan hover:underline transition-colors"
      >
        Back to home
      </Link>
    </div>
  );
}
