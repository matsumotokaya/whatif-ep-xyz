import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPremiumFeatureAccess } from "@/lib/access/entitlement";

export interface ClubProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "user" | null;
  subscription_tier: "free" | "premium" | null;
  subscription_status: "active" | "canceling" | "canceled" | null;
}

export type ClubAccessState = "anonymous" | "free" | "premium";

export interface ClubAccess {
  user: User | null;
  session: Session | null;
  profile: ClubProfile | null;
  // Billing reality only. Never set this to "premium" for an admin: it drives
  // the billing-state copy on /the-club. Feature access is canAccessClub().
  status: ClubAccessState;
  role: "admin" | "user" | null;
  displayName: string;
}

export async function getClubAccess(): Promise<ClubAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      session: null,
      profile: null,
      status: "anonymous",
      role: null,
      displayName: "Guest",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, subscription_tier, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  const resolvedProfile = (profile as ClubProfile | null) ?? null;
  const status =
    resolvedProfile?.subscription_tier === "premium" ? "premium" : "free";

  return {
    user,
    session: null,
    profile: resolvedProfile,
    status,
    role: resolvedProfile?.role ?? null,
    displayName: resolvedProfile?.full_name ?? user.email ?? "Member",
  };
}

// Feature access, not billing state: admins are granted the same access as
// premium members (see src/lib/access/entitlement.ts).
export function canAccessClub(access: ClubAccess) {
  return hasPremiumFeatureAccess({
    role: access.role,
    tier: access.profile?.subscription_tier ?? null,
  });
}

export async function requireClubAuth(nextPath: string) {
  const access = await getClubAccess();
  if (access.status === "anonymous") {
    const next = nextPath.startsWith("/") ? nextPath : "/";
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }
  return access;
}
