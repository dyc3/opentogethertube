import {
	describe,
	it,
	expect,
	beforeAll,
	beforeEach,
	afterAll,
	afterEach,
	vi,
	MockInstance,
} from "vitest";
import InvidiousAdapter, { INVIDIOUS_SHORT_WATCH_RE } from "../../../services/invidious.js";
import { InvalidVideoIdException } from "../../../exceptions.js";

describe("INVIDIOUS_SHORT_WATCH_RE", () => {
  it("accepts /w/<id> with letters, digits, _ and -", () => {
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abcDEF123_-")).toBe(true);
  });

  it("accepts IDs longer than 11 chars (no strict length)", () => {
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abcdefghijklmnop")).toBe(true);
  });

  it("rejects when trailing slash is present", () => {
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc123/")).toBe(false);
  });

  it("rejects when illegal chars are present", () => {
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc.123")).toBe(false);
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/abc+123")).toBe(false);
    expect(INVIDIOUS_SHORT_WATCH_RE.test("/w/")).toBe(false);
  });
});

describe("InvidiousAdapter URL handling", () => {
  const mk = (u: string) => u; // small helper to keep strings readable
  let adapter: InvidiousAdapter;

  beforeEach(() => {
    adapter = new InvidiousAdapter();
    // Restrict to a known host so tests are deterministic
    adapter.allowedHosts = ["inv.nadeko.net"];
  });

  describe("canHandleURL", () => {
    it("accepts /watch?v=VIDEOID on allowed host", () => {
      expect(
        adapter.canHandleURL(mk("https://inv.nadeko.net/watch?v=abc123"))
      ).toBe(true);
    });

    it("accepts /watch?v=VIDEOID with extra params", () => {
      expect(
        adapter.canHandleURL(
          mk("https://inv.nadeko.net/watch?v=abc123&t=42s&foo=bar")
        )
      ).toBe(true);
    });

    it("accepts /w/VIDEOID on allowed host", () => {
      expect(adapter.canHandleURL(mk("https://inv.nadeko.net/w/abc123"))).toBe(
        true
      );
    });

    it("accepts /w/ with >11 length ID", () => {
      expect(
        adapter.canHandleURL(
          mk("https://inv.nadeko.net/w/abcdefghijklmnop_qwerty-XYZ")
        )
      ).toBe(true);
    });

    it("rejects unknown host even if path matches", () => {
      expect(adapter.canHandleURL(mk("https://other.com/w/abc123"))).toBe(
        false
      );
      expect(
        adapter.canHandleURL(mk("https://other.com/watch?v=abc123"))
      ).toBe(false);
    });

    it("rejects /watch without v param", () => {
      expect(adapter.canHandleURL(mk("https://inv.nadeko.net/watch"))).toBe(false);
    });

    it("rejects /w/ with invalid chars", () => {
      expect(adapter.canHandleURL(mk("https://inv.nadeko.net/w/abc.123"))).toBe(
        false
      );
    });
  });

  describe("getVideoId", () => {
    it("extracts host:id from /watch?v=ID", () => {
      const id = adapter.getVideoId(
        mk("https://inv.nadeko.net/watch?v=abc123_-")
      );
      expect(id).toBe("inv.nadeko.net:abc123_-");
    });

    it("extracts host:id from /w/ID", () => {
      const id = adapter.getVideoId(mk("https://inv.nadeko.net/w/AbC-123_"));
      expect(id).toBe("inv.nadeko.net:AbC-123_");
    });

    it("throws on missing id", () => {
      expect(() =>
        adapter.getVideoId(mk("https://inv.nadeko.net/watch"))
      ).toThrow(InvalidVideoIdException);
      expect(() =>
        adapter.getVideoId(mk("https://inv.nadeko.net/w/"))
      ).toThrow(InvalidVideoIdException);
    });
  });

  describe("isCollectionURL", () => {
    it("returns false for non-collection URLs by design", () => {
      expect(adapter.isCollectionURL("https://inv.nadeko.net/watch?v=abc")).toBe(
        false
      );
    });
  });
});