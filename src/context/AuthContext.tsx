'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { notifySignupIfNeeded } from '@/lib/account-notifications';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin';
  subscription_tier: 'free' | 'premium';
  subscription_status: 'active' | 'canceling' | 'canceled' | null;
  subscription_expires_at: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
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
  const [profileLoading, setProfileLoading] = useState(false);
  const notifiedSignupUserIdsRef = useRef<Set<string>>(new Set());
  const pendingSignupNotificationUserIdsRef = useRef<Set<string>>(new Set());

  const supabase = createClient();

  useEffect(() => {
    let isActive = true;

    // Single-origin session: the @supabase/ssr cookie session is the sole
    // source of truth. The former cross-subdomain SSO cookie (wf-sso-token)
    // sync/adoption was removed in consolidation M2.
    const applySession = (nextSession: Session | null) => {
      if (!isActive) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
    );

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, role, subscription_tier, subscription_status, subscription_expires_at')
          .eq('id', user.id)
          .single();

        setProfile(data ? (data as Profile) : null);
      } catch {
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    })();
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
        profileLoading,
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
