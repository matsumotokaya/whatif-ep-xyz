import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminAccess {
  isAuthenticated: boolean;
  isAdmin: boolean;
  role: string | null;
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      role: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = typeof profile?.role === "string" ? profile.role : null;

  return {
    isAuthenticated: true,
    isAdmin: role === "admin",
    role,
  };
}

export async function requireAdmin(nextPath: string) {
  const access = await getAdminAccess();

  if (!access.isAuthenticated) {
    const safeNextPath =
      nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
    redirect(`/auth/login?next=${encodeURIComponent(safeNextPath)}`);
  }

  if (!access.isAdmin) {
    redirect("/episodes");
  }

  return access;
}
