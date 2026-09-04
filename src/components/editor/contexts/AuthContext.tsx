'use client';

// M1 auth adapter for the ported IMAGINE editor.
//
// IMAGINE's original AuthContext (cross-subdomain SSO cookie adoption,
// signup notification, sign-in methods) is intentionally NOT ported — see
// docs/archive/CONSOLIDATION_PLAN.md. The editor island reads the Gallery-side
// session/profile from the root <AuthProvider> (src/context/AuthContext.tsx,
// @supabase/ssr single-origin session) and maps the profile row to the
// camelCase shape the ported editor code expects.
//
// The editor only consumes: user, session, profile{email, fullName,
// avatarUrl, role, subscriptionTier}, loading, signOut, plus the
// hasPremiumAccess feature flag (see src/lib/access/entitlement.ts).

import { useMemo } from 'react';
import { useAuth as useGalleryAuth } from '@/context/AuthContext';
import { hasPremiumFeatureAccess } from '@/lib/access/entitlement';

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
  const { user, session, profile, loading, profileLoading, signOut } = useGalleryAuth();

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
        subscriptionExpiresAt: profile.subscription_expires_at ?? undefined,
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

  // Feature access (premium templates / premium image library), not billing
  // state. Admins pass; the optimistic pre-profile fallback above resolves to
  // false until the real profile row lands, which is what profileLoading is
  // for. Do NOT use this to render billing copy or badges.
  const hasPremiumAccess = useMemo(
    () =>
      hasPremiumFeatureAccess({
        role: mappedProfile?.role ?? null,
        tier: mappedProfile?.subscriptionTier ?? null,
      }),
    [mappedProfile],
  );

  return { user, session, profile: mappedProfile, loading, profileLoading, hasPremiumAccess, signOut };
};
