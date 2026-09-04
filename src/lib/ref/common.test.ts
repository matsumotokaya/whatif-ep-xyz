import { describe, expect, it } from "vitest";
import {
  parseRefFieldNames,
  REF_TRANSFORM_PARAMS,
  resolveRefImageQuery,
} from "./common";

// Kind-agnostic helpers in ./common that no kind module re-exports. The
// `fields` resolution and record projection are covered through the per-kind
// wrappers in designs.test.ts / assets.test.ts, where the real field lists
// live; what is left here is the query guard both /ref image aliases share.

const query = (search: string) => resolveRefImageQuery(new URLSearchParams(search));

describe("parseRefFieldNames", () => {
  it("reads a comma-separated string and an array the same way", () => {
    expect(parseRefFieldNames("id,name")).toEqual(["id", "name"]);
    expect(parseRefFieldNames(["id", "name"])).toEqual(["id", "name"]);
    expect(parseRefFieldNames(["id,name"])).toEqual(["id", "name"]);
  });

  it("trims, lower-cases and drops empty entries", () => {
    expect(parseRefFieldNames(" ID , , Name ")).toEqual(["id", "name"]);
    expect(parseRefFieldNames([" ", ""])).toEqual([]);
  });

  it("treats absent input as no request at all", () => {
    expect(parseRefFieldNames(undefined)).toEqual([]);
    expect(parseRefFieldNames(null)).toEqual([]);
    expect(parseRefFieldNames("")).toEqual([]);
  });
});

describe("resolveRefImageQuery", () => {
  it("serves the full image when nothing is asked for", () => {
    expect(query("")).toEqual({ size: "full", error: null });
    expect(query("size=full")).toEqual({ size: "full", error: null });
    expect(query("size=")).toEqual({ size: "full", error: null });
    expect(query("size=FULL")).toEqual({ size: "full", error: null });
  });

  it("serves the thumbnail only when it is named", () => {
    expect(query("size=thumb")).toEqual({ size: "thumb", error: null });
    expect(query("size=THUMB")).toEqual({ size: "thumb", error: null });
  });

  it("rejects a size it does not understand instead of guessing full", () => {
    // The old behaviour meant thumb for exactly "thumb" and, silently, full
    // for everything else — so a typo returned an image nobody asked for.
    const result = query("size=thumbnail");

    expect(result.size).toBeNull();
    expect(result.error).toContain('Unsupported `size` value "thumbnail"');
    expect(result.error).toContain("size=thumb|full");
  });

  it("rejects every transformation parameter it advertises", () => {
    // A 302 to the unmodified image let a consumer believe `?w=1920` had
    // worked and pay a per-call video generator to find out otherwise.
    for (const name of REF_TRANSFORM_PARAMS) {
      const result = query(`${name}=1`);

      expect(result.size).toBeNull();
      expect(result.error).toContain(name);
      expect(result.error).toContain("serves the stored image as-is");
      expect(result.error).toContain("width");
    }
  });

  it("names every offending parameter, folding case", () => {
    const result = query("w=1920&AR=16:9&cb=1");

    expect(result.error).toContain("w, ar");
    expect(result.error).toContain("parameters:");
  });

  it("leaves unrelated parameters alone", () => {
    // Cache-busters, analytics and whatever a chat client appends to a pasted
    // link never asked for a transformation; rejecting them would break
    // ordinary URLs.
    expect(query("cb=123")).toEqual({ size: "full", error: null });
    expect(query("v=2&utm_source=slack")).toEqual({
      size: "full",
      error: null,
    });
    expect(query("size=thumb&cb=123")).toEqual({ size: "thumb", error: null });
  });

  it("reports a transformation before a bad size", () => {
    // Both are wrong, but the transformation is the one the caller is counting
    // on and must hear about.
    expect(query("w=1920&size=bogus").error).toContain("transformation");
  });
});
