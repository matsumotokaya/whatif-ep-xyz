import { describe, expect, it } from "vitest";
import { stripeCheckoutSuccessUrl } from "@/lib/stripe-checkout-url";

describe("stripeCheckoutSuccessUrl", () => {
  it("keeps Stripe's Checkout Session placeholder unencoded", () => {
    expect(
      stripeCheckoutSuccessUrl(new URL("https://preview.example/success"))
    ).toBe(
      "https://preview.example/success?session_id={CHECKOUT_SESSION_ID}"
    );
  });

  it("replaces an existing session id and preserves query and fragment", () => {
    expect(
      stripeCheckoutSuccessUrl(
        new URL(
          "https://preview.example/success?return_to=%2Faccount&session_id=stale#billing"
        )
      )
    ).toBe(
      "https://preview.example/success?return_to=%2Faccount&session_id={CHECKOUT_SESSION_ID}#billing"
    );
  });

  it("never URL-encodes the placeholder braces", () => {
    expect(
      stripeCheckoutSuccessUrl(new URL("https://preview.example/success"))
    ).not.toContain("%7BCHECKOUT_SESSION_ID%7D");
  });
});
