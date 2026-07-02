'use client';

// react-router-dom compatibility shim backed by next/navigation.
//
// The ported IMAGINE editor code (see docs/CONSOLIDATION_PLAN.md M1) was
// written against react-router-dom v7. Rather than rewriting every call site,
// this module re-implements the small API surface the editor actually uses
// (useNavigate / useLocation / useParams / useSearchParams / Link) on top of
// the Next.js App Router.
//
// TODO(post-M5): remove this shim once the ported pages are rewritten
// directly against next/navigation.

import {
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import NextLink from 'next/link';
import {
  useParams as useNextParams,
  usePathname,
  useRouter,
  useSearchParams as useNextSearchParams,
} from 'next/navigation';

// react-router keeps navigation `state` on the history entry. next/navigation
// has no equivalent, so we keep the latest pushed state in module scope. It
// survives client-side navigation while the editor island stays mounted and is
// lost on a full reload (guest designs are also persisted to localStorage, so
// nothing is permanently lost). Subscribers re-render via useSyncExternalStore
// so a same-URL navigation that only changes state still propagates.
let pendingState: unknown = null;
let stateVersion = 0;
const stateListeners = new Set<() => void>();

function setPendingState(state: unknown) {
  pendingState = state;
  stateVersion += 1;
  stateListeners.forEach((listener) => listener());
}

function subscribeToState(listener: () => void) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function getStateVersion() {
  return stateVersion;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export function useNavigate() {
  const router = useRouter();

  return useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        // Only `navigate(-1)` semantics are supported.
        router.back();
        return;
      }

      setPendingState(options?.state ?? null);

      if (options?.replace) {
        router.replace(to);
      } else {
        router.push(to);
      }
    },
    [router],
  );
}

export function useLocation() {
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  const version = useSyncExternalStore(subscribeToState, getStateVersion, getStateVersion);
  const search = searchParams?.toString() ?? '';

  return useMemo(
    () => ({
      pathname: pathname ?? '',
      search: search ? `?${search}` : '',
      hash: '',
      state: pendingState,
      key: `shim-${version}`,
    }),
    [pathname, search, version],
  );
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): Partial<T> {
  const params = useNextParams();
  return (params ?? {}) as Partial<T>;
}

// react-router returns [URLSearchParams, setSearchParams]. The editor only
// reads (destructures the first element), so the setter is a best-effort
// implementation via router.replace.
export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>) => void,
] {
  const nextSearchParams = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const search = nextSearchParams?.toString() ?? '';

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);

  const setSearchParams = useCallback(
    (next: URLSearchParams | Record<string, string>) => {
      const params =
        next instanceof URLSearchParams ? next : new URLSearchParams(next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname ?? '/');
    },
    [router, pathname],
  );

  return [searchParams, setSearchParams];
}

// react-router's declarative redirect. The ported pages use it for auth /
// admin gating (`if (!user) return <Navigate to="/auth/login" replace />`).
// Implemented as an effect-driven client redirect that renders nothing.
export function Navigate({ to, replace = true }: { to: string; replace?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  }, [router, to, replace]);

  return null;
}

export interface LinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  state?: unknown;
  replace?: boolean;
  children?: ReactNode;
}

export function Link({ to, state, replace, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (state !== undefined) {
      setPendingState(state);
    }
    onClick?.(event);
  };

  return (
    <NextLink href={to} replace={replace} onClick={handleClick} {...rest}>
      {children}
    </NextLink>
  );
}
