'use client';

// M1 auth adapter for the ported IMAGINE editor.
//
// IMAGINE's original AuthContext (cross-subdomain SSO cookie adoption,
// signup notification, sign-in methods) is intentionally NOT ported — see
// docs/CONSOLIDATION_PLAN.md. The editor island reads the Gallery-side
// session/profile from the root <AuthProvider> (src/context/AuthContext.tsx,
// @supabase/ssr single-origin session) and maps the profile row to the
// camelCase shape the ported editor code expects.
//
// The editor only consumes: user, session, profile{email, fullName,
// avatarUrl, role, subscriptionTier}, loading, signOut.

import { useMemo } from 'react';
import { useAuth as useGalleryAuth } from '@/context/AuthContext';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiresAt?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'canceling' | 'canceled' | null;
}

export const useAuth = () => {
  const { user, session, profile, loading, signOut } = useGalleryAuth();

  const mappedProfile: UserProfile | null = useMemo(() => {
    if (profile) {
      return {
        id: profile.id,
        email: profile.email ?? '',
        fullName: profile.full_name ?? undefined,
        avatarUrl: profile.avatar_url ?? undefined,
        role: profile.role,
        subscriptionTier: profile.subscription_tier,
        subscriptionStatus: profile.subscription_status,
      };
    }

    // Optimistic default while the profile row is loading (mirrors IMAGINE).
    if (user) {
      return {
        id: user.id,
        email: user.email || '',
        role: 'user' as const,
        subscriptionTier: 'free' as const,
      };
    }

    return null;
  }, [profile, user]);

  return { user, session, profile: mappedProfile, loading, signOut };
};
