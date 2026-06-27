import { describe, expect, it } from "bun:test";
import {
  canUserEdit,
  computeEffectivePermissions,
  DEFAULT_PERMISSIONS,
  isValidCode,
  isValidTabId,
  MAX_CODE_LENGTH,
  MAX_TAB_ID_LENGTH,
  MAX_TAB_NAME_LENGTH,
  normalizePermissions,
  OWNER_PERMISSIONS,
  sanitizeTabName,
} from "../validation";

describe("sanitizeTabName", () => {
  it("trims whitespace", () => {
    expect(sanitizeTabName("  hello  ")).toBe("hello");
  });

  it("returns null for non-string input", () => {
    expect(sanitizeTabName(123)).toBeNull();
    expect(sanitizeTabName(null)).toBeNull();
    expect(sanitizeTabName(undefined)).toBeNull();
    expect(sanitizeTabName({})).toBeNull();
  });

  it("returns null for empty string after trim", () => {
    expect(sanitizeTabName("")).toBeNull();
    expect(sanitizeTabName("   ")).toBeNull();
  });

  it("returns null when exceeding max length", () => {
    const longName = "a".repeat(MAX_TAB_NAME_LENGTH + 1);
    expect(sanitizeTabName(longName)).toBeNull();
  });

  it("accepts exactly max length", () => {
    const maxName = "a".repeat(MAX_TAB_NAME_LENGTH);
    expect(sanitizeTabName(maxName)).toBe(maxName);
  });
});

describe("isValidTabId", () => {
  it("accepts valid tab IDs", () => {
    expect(isValidTabId("tab-main")).toBe(true);
    expect(isValidTabId("my-tab_1")).toBe(true);
    expect(isValidTabId("a")).toBe(true);
  });

  it("rejects invalid characters", () => {
    expect(isValidTabId("tab main")).toBe(false);
    expect(isValidTabId("tab@main")).toBe(false);
    expect(isValidTabId("tab.main")).toBe(false);
    expect(isValidTabId("tab/main")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidTabId("")).toBe(false);
  });

  it("rejects exceeding max length", () => {
    const longId = "a".repeat(MAX_TAB_ID_LENGTH + 1);
    expect(isValidTabId(longId)).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isValidTabId(null)).toBe(false);
    expect(isValidTabId(123)).toBe(false);
    expect(isValidTabId(undefined)).toBe(false);
  });
});

describe("isValidCode", () => {
  it("accepts normal code strings", () => {
    expect(isValidCode("console.log('hello')")).toBe(true);
    expect(isValidCode("")).toBe(true);
  });

  it("rejects code exceeding max length", () => {
    const longCode = "x".repeat(MAX_CODE_LENGTH + 1);
    expect(isValidCode(longCode)).toBe(false);
  });

  it("rejects non-string types", () => {
    expect(isValidCode(null)).toBe(false);
    expect(isValidCode(123)).toBe(false);
    expect(isValidCode({})).toBe(false);
  });
});

describe("normalizePermissions", () => {
  it("accepts valid permission objects", () => {
    const input = {
      canEdit: true,
      canCreateTab: false,
      canDeleteTab: true,
      canRenameTab: false,
    };
    expect(normalizePermissions(input)).toEqual(input);
  });

  it("rejects objects with extra keys", () => {
    const input = {
      canEdit: true,
      canCreateTab: false,
      canDeleteTab: false,
      canRenameTab: false,
      isAdmin: true,
    };
    expect(normalizePermissions(input)).toBeNull();
  });

  it("rejects objects with non-boolean values", () => {
    const input = {
      canEdit: "yes",
      canCreateTab: false,
      canDeleteTab: false,
      canRenameTab: false,
    };
    expect(normalizePermissions(input)).toBeNull();
  });

  it("rejects null/undefined/primitives", () => {
    expect(normalizePermissions(null)).toBeNull();
    expect(normalizePermissions(undefined)).toBeNull();
    expect(normalizePermissions("string")).toBeNull();
    expect(normalizePermissions(42)).toBeNull();
  });

  it("rejects arrays", () => {
    expect(normalizePermissions([true, false, false, false])).toBeNull();
  });
});

describe("computeEffectivePermissions", () => {
  it("forces all false when canEdit is false", () => {
    const input = {
      canEdit: false,
      canCreateTab: true,
      canDeleteTab: true,
      canRenameTab: true,
    };
    expect(computeEffectivePermissions(input)).toEqual(DEFAULT_PERMISSIONS);
  });

  it("preserves other permissions when canEdit is true", () => {
    const input = {
      canEdit: true,
      canCreateTab: true,
      canDeleteTab: false,
      canRenameTab: true,
    };
    expect(computeEffectivePermissions(input)).toEqual(input);
  });

  it("owner permissions stay fully permissive", () => {
    expect(computeEffectivePermissions(OWNER_PERMISSIONS)).toEqual(
      OWNER_PERMISSIONS
    );
  });
});

describe("canUserEdit", () => {
  it("room creator can always edit", () => {
    expect(canUserEdit("alice", "alice", DEFAULT_PERMISSIONS, "bob")).toBe(
      true
    );
  });

  it("non-editor cannot edit when someone else is editing", () => {
    expect(canUserEdit("bob", "alice", DEFAULT_PERMISSIONS, "alice")).toBe(
      false
    );
  });

  it("user with edit permission can edit when no current editor", () => {
    const perms = { ...DEFAULT_PERMISSIONS, canEdit: true };
    expect(canUserEdit("bob", "alice", perms, "")).toBe(true);
  });

  it("user with edit permission can edit when they are the current editor", () => {
    const perms = { ...DEFAULT_PERMISSIONS, canEdit: true };
    expect(canUserEdit("bob", "alice", perms, "bob")).toBe(true);
  });

  it("user without edit permission cannot edit even with no current editor", () => {
    expect(canUserEdit("bob", "alice", DEFAULT_PERMISSIONS, "")).toBe(false);
  });
});
