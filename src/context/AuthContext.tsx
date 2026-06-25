'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { writeSsoCookie, clearSsoCookie } from '@/lib/ssoCookie';
import { notifySignupIfNeeded } from '@/lib/account-notifications';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  subscription_tier: 'free' | 'premium';
  subscription_status: 'active' | 'canceling' | 'canceled' | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithLegacyId: (legacyId: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    nextPath?: string
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function setAuthNextCookie(nextPath: string) {
  const safeNextPath =
    nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `whatif_auth_next=${encodeURIComponent(
    safeNextPath
  )}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
}

function legacyEmailFromId(rawId: string) {
  const cleaned = rawId
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");
  return cleaned ? `legacy+${cleaned}@club.whatif.local` : "";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const notifiedSignupUserIdsRef = useRef<Set<string>>(new Set());
  const pendingSignupNotificationUserIdsRef = useRef<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    // Sync the cross-subdomain SSO cookie so app.whatif-ep.xyz (IMAGINE)
    // can adopt this session. Side-effect only; never calls setSession here.
    const syncSsoCookie = (event: string, session: Session | null) => {
      try {
        // Only a confirmed sign-out should delete the shared cookie. A null
        // local session on this subdomain does not prove the sibling app is
        // also signed out, so clearing here can break cross-subdomain SSO.
        if (event === 'SIGNED_OUT') {
          clearSsoCookie();
          return;
        }
        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION'
        ) {
          if (session?.access_token && session?.refresh_token) {
            writeSsoCookie({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            });
          }
        }
      } catch {
        // Never let SSO cookie sync break auth.
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      syncSsoCookie('INITIAL_SESSION', session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        syncSsoCookie(event, session);
      }
    );

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, subscription_tier, subscription_status')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !session?.access_token || loading) {
      return;
    }

    if (notifiedSignupUserIdsRef.current.has(user.id)) {
      return;
    }

    if (pendingSignupNotificationUserIdsRef.current.has(user.id)) {
      return;
    }

    void (async () => {
      pendingSignupNotificationUserIdsRef.current.add(user.id);

      try {
        const retryDelaysMs = [0, 1500, 4000];

        for (const delayMs of retryDelaysMs) {
          if (delayMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, delayMs));
          }

          const result = await notifySignupIfNeeded(session.access_token);
          if (result?.sent || result?.alreadySent || result?.skipped === 'not_recent_signup') {
            notifiedSignupUserIdsRef.current.add(user.id);
            return;
          }

          if (result?.skipped !== 'email_not_verified') {
            return;
          }
        }
      } finally {
        pendingSignupNotificationUserIdsRef.current.delete(user.id);
      }
    })();
  }, [loading, session?.access_token, user?.email_confirmed_at, user?.id]);

  const signInWithGoogle = async (nextPath = '/') => {
    setAuthNextCookie(nextPath);

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signInWithLegacyId = async (legacyId: string, password: string) => {
    const email = legacyEmailFromId(legacyId);
    if (!email) {
      return { error: "有効なユーザーIDを入力してください。" };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const signUpWithEmail = async (email: string, password: string, nextPath = '/') => {
    setAuthNextCookie(nextPath);
    const emailRedirectTo = `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    return {
      error: error?.message || null,
      needsConfirmation: !error && !data?.session,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signInWithLegacyId,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
