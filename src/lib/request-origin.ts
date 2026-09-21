/** Route-handler URLs may use Next's internal hostname behind a proxy.
 * Host is the browser's target host; forwarded-proto is set by the deployment proxy.
 * Never accept an arbitrary forwarded-host as an additional allowed origin.
 */
export function isSameOrigin(request: Request): boolean {
  try {
    const value = request.headers.get("origin");
    if (!value) return false;
    const origin = new URL(value);
    const internal = new URL(request.url);
    const host = request.headers.get("host") || internal.host;
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
      internal.protocol.slice(0, -1);
    return (
      value === origin.origin &&
      ["http", "https"].includes(protocol) &&
      origin.host === host &&
      origin.protocol === `${protocol}:`
    );
  } catch {
    return false;
  }
}
