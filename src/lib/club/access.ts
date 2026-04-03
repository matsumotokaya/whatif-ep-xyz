import type { Session, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ClubProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  subscription_tier: "free" | "premium" | null;
  subscription_status: "active" | "canceling" | "canceled" | null;
}

export type ClubAccessState = "anonymous" | "free" | "premium";

export interface ClubAccess {
  user: User | null;
  session: Session | null;
  profile: ClubProfile | null;
  status: ClubAccessState;
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
      displayName: "Guest",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, subscription_tier, subscription_status")
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
    displayName: resolvedProfile?.full_name ?? user.email ?? "Member",
  };
}

export function canAccessClub(access: ClubAccess) {
  return access.status === "premium";
}

export async function requireClubAuth(nextPath: string) {
  const access = await getClubAccess();
  if (access.status === "anonymous") {
    const next = nextPath.startsWith("/") ? nextPath : "/";
    redirect(`/auth/login?next=${encodeURIComponent(next)}`);
  }
  return access;
}
