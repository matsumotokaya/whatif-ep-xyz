const CHECKOUT_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

export function stripeCheckoutSuccessUrl(url: URL): string {
  const target = new URL(url);
  const hash = target.hash;
  target.hash = "";
  target.searchParams.delete("session_id");

  const separator = target.search ? "&" : "?";
  return `${target.toString()}${separator}session_id=${CHECKOUT_SESSION_PLACEHOLDER}${hash}`;
}
