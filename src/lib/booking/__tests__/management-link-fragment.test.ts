import { describe, expect, it, vi } from "vitest";
import { consumeManagementLinkFragment } from "../management-link-fragment";

describe("management-link fragment consumption", () => {
  it("clears the fragment before returning its bearer token", () => {
    const events: string[] = [];
    const replaceState = vi.fn((url: string) => events.push(`cleared:${url}`));
    const result = consumeManagementLinkFragment({
      href: "https://example.test/booking/manage#token=secret-token&action=cancel",
      replaceState,
    });
    events.push(`returned:${result.token}`);

    expect(result).toEqual({ token: "secret-token", action: "cancel" });
    expect(events).toEqual([
      "cleared:/booking/manage",
      "returned:secret-token",
    ]);
    expect(replaceState).toHaveBeenCalledOnce();
  });

  it("removes legacy query tokens without accepting them", () => {
    const replaceState = vi.fn();
    const result = consumeManagementLinkFragment({
      href: "https://example.test/booking/manage?token=legacy&service=detail",
      replaceState,
    });
    expect(result.token).toBe("");
    expect(replaceState).toHaveBeenCalledWith("/booking/manage?service=detail");
  });
});
