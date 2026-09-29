import { describe, expect, it } from "vitest";
import { mayRegister, parseRegistration } from "../config";

describe("parseRegistration", () => {
  it("defaults to closed in production and open elsewhere", () => {
    expect(parseRegistration({}, true)).toEqual({ open: false, allowlist: [] });
    expect(parseRegistration({}, false)).toEqual({ open: true, allowlist: [] });
  });

  it("only explicit values override the default", () => {
    expect(parseRegistration({ REGISTRATION_OPEN: "true" }, true).open).toBe(true);
    expect(parseRegistration({ REGISTRATION_OPEN: " YES " }, true).open).toBe(true);
    expect(parseRegistration({ REGISTRATION_OPEN: "false" }, false).open).toBe(false);
    expect(parseRegistration({ REGISTRATION_OPEN: "maybe" }, true).open).toBe(false);   // unknown → default
    expect(parseRegistration({ REGISTRATION_OPEN: "" }, true).open).toBe(false);
  });

  it("parses the allowlist: comma-separated, trimmed, lower-cased, blanks dropped", () => {
    const p = parseRegistration({ REGISTRATION_ALLOWLIST: " A@x.com, ,b@Y.org ," }, true);
    expect(p.allowlist).toEqual(["a@x.com", "b@y.org"]);
    expect(mayRegister(p, "B@y.ORG ")).toBe(true);
    expect(mayRegister(p, "c@x.com")).toBe(false);
    expect(mayRegister(undefined, "c@x.com")).toBe(true);      // no policy (tests, local dev) = open
  });
});
