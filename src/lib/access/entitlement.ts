// Feature-entitlement helper shared by server and client code.
//
// IMPORTANT: this module must stay a pure function with no "server-only"
// marker and no supabase / next-navigation imports, because both server
// components and the client-side editor import it.
//
// WHAT THIS IS: a *feature access* check - "may this account open premium
// templates, pick from the premium image library, and download The Club /
// wallpaper assets?". Admins need all of that for operations, so role
// 'admin' is granted the same feature access as a paying premium member.
//
// WHAT THIS IS NOT: a statement about billing. An admin is not a paying
// subscriber. Do NOT use this for:
//   - billing-state display (the crown icon, plan name, "Premium member"
//     badges, /account, /plans),
//   - Stripe consistency logic (checkout, portal, subscription confirm,
//     account-delete guards, subscription-sync / subscription-state).
// Using it there would break an admin's ability to actually subscribe and
// would misreport their billing state.
//
// FUTURE: when docs/BILLING_REBUILD_PLAN.md moves premium onto explicit
// entitlement rows, the 'admin' branch here is expected to be replaced by an
// entitlement with source='admin'.
export function hasPremiumFeatureAccess(input: {
  role?: string | null;
  tier?: string | null;
}): boolean {
  return input.role === 'admin' || input.tier === 'premium';
}
