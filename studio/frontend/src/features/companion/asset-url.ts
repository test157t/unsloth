import { getAuthToken } from "@/features/auth";

/** Only private presentation assets receive Studio credentials, never external URLs. */
export function resolveCompanionAssetUrl(value: string): string {
  const url = new URL(value, window.location.origin);
  if (url.origin !== window.location.origin || !/^\/assets\/(vrm|call-mode|backgrounds)\//.test(url.pathname)) return value;
  url.pathname = `/api/companion${url.pathname}`;
  const token = getAuthToken();
  if (token) url.searchParams.set("token", token);
  return url.toString();
}
