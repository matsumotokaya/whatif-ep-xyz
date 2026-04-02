export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-8">
      <div className="mx-auto max-w-7xl px-4 text-center">
        <p className="text-sm text-muted">
          &copy; {new Date().getFullYear()} WHATIF EP. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
