export interface ConsumedManagementLink {
  token: string;
  action: "cancel" | "reschedule" | null;
}

/**
 * Consumes a bearer token from the URL fragment and clears it before returning
 * the token to application state. Fragments are never sent in HTTP requests.
 */
export function consumeManagementLinkFragment(params: {
  href: string;
  replaceState: (url: string) => void;
}): ConsumedManagementLink {
  const url = new URL(params.href);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token = fragment.get("token")?.trim() ?? "";
  const rawAction = fragment.get("action");
  const action = rawAction === "cancel" || rawAction === "reschedule" ? rawAction : null;

  url.hash = "";
  url.searchParams.delete("token");
  params.replaceState(`${url.pathname}${url.search}`);

  return { token, action };
}
