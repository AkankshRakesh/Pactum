
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_ORIGIN = process.env.NEXT_PUBLIC_LB;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const incomingUrl = new URL(request.url);

  // Django expects trailing slashes. Normalize the upstream path here
  // so Django does not redirect the browser to a different origin path.
  const pathString = path.map(encodeURIComponent).join("/");
  const upstreamUrl = new URL(
    `/${pathString}${pathString.endsWith("/") ? "" : "/"}`,
    API_ORIGIN
  );
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers();

  for (const name of [
    "accept",
    "content-type",
    "origin",
    "referer",
    "x-csrftoken",
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const cookies = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => /^(csrftoken|sessionid)=/.test(cookie));

  if (cookies.length) {
    headers.set("cookie", cookies.join("; "));
  }

  const method = request.method;
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  // Follow any remaining upstream redirects on the server, not in the browser.
  const upstreamResponse = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "follow",
  });

  const responseHeaders = new Headers();

  for (const [name, value] of upstreamResponse.headers.entries()) {
    if (
      ![
        "connection",
        "content-encoding",
        "content-length",
        "keep-alive",
        "transfer-encoding",
      ].includes(name.toLowerCase()) &&
      name.toLowerCase() !== "set-cookie" &&
      name.toLowerCase() !== "location"
    ) {
      responseHeaders.set(name, value);
    }
  }

  for (const cookie of upstreamResponse.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;
