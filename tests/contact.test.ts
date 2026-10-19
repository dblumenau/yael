import { describe, expect, it } from "vitest";
import { isHoneypot, parseContact } from "../worker/contact";

describe("parseContact", () => {
  it("accepts a complete submission and trims it", () => {
    const r = parseContact({ contactName: " Ann ", email: "ann@example.com", comments: " hi " });
    expect(r).toEqual({ ok: true, value: { contactName: "Ann", email: "ann@example.com", comments: "hi" } });
  });
  it("rejects missing fields and a bad email", () => {
    const r = parseContact({ contactName: "", email: "nope", comments: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });
  it("rejects a message over 2000 characters and non-object bodies", () => {
    expect(parseContact({ contactName: "A", email: "a@b.co", comments: "x".repeat(2001) }).ok).toBe(false);
    expect(parseContact(null).ok).toBe(false);
  });
});

describe("isHoneypot", () => {
  it("passes an empty or absent website field", () => {
    expect(isHoneypot({ contactName: "A" })).toBe(false);
    expect(isHoneypot({ website: "" })).toBe(false);
    expect(isHoneypot({ website: "   " })).toBe(false);
  });
  it("flags any filled or non-string website field", () => {
    expect(isHoneypot({ website: "http://spam.example" })).toBe(true);
    expect(isHoneypot({ website: 1 })).toBe(true);
  });
});
