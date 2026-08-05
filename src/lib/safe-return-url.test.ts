import { describe, expect, it } from "vitest";
import { safeLocalUrl } from "@/lib/safe-return-url";

describe("safeLocalUrl", () => {
  const origin = "https://whatif-ep.xyz";

  it("keeps local paths, queries, and fragments", () => {
    expect(
      safeLocalUrl(origin, "/mypage?from=portal#billing", "/account").toString()
    ).toBe("https://whatif-ep.xyz/mypage?from=portal#billing");
  });

  it.each([
    "https://attacker.example/path",
    "//attacker.example/path",
    "/\\attacker.example/path",
    "javascript:alert(1)",
  ])("rejects a non-local return target: %s", (value) => {
    expect(safeLocalUrl(origin, value, "/account").toString()).toBe(
      "https://whatif-ep.xyz/account"
    );
  });
});
