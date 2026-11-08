import "server-only";
import { connection } from "next/server";
import { auth } from "./auth";

export class ApiError extends Error {
  constructor(status, message, code = "bad_request") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export const created = (data) => json(data, 201);

function errorResponse(status, code, message) {
  return json({ error: { code, message } }, status);
}

// Cheap CSRF defence on top of SameSite=Lax cookies: state-changing requests
// that carry an Origin header must come from this same host.
function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError(403, "Bad origin", "forbidden");
  }
  if (originHost !== host) throw new ApiError(403, "Bad origin", "forbidden");
}

export async function readJson(request) {
  try {
    const body = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("not an object");
    }
    return body;
  } catch {
    throw new ApiError(400, "Request body must be a JSON object");
  }
}

/**
 * Wraps a route handler: forces request-time execution, verifies the Better
 * Auth session on EVERY call (the proxy is only an optimistic first gate),
 * checks origin on writes, and turns errors into a uniform JSON shape.
 *
 * handler({ request, userId, user, params }) -> data | Response
 */
export function route(handler) {
  return async (request, context) => {
    try {
      await connection();
      if (!["GET", "HEAD"].includes(request.method)) assertSameOrigin(request);

      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        return errorResponse(401, "unauthorized", "Sign in required");
      }
      const params = context?.params ? await context.params : {};
      const result = await handler({
        request,
        user: session.user,
        userId: session.user.id,
        params,
      });
      return result instanceof Response ? result : json(result);
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.status, err.code, err.message);
      }
      console.error("[api]", request.method, request.url, err);
      return errorResponse(500, "server_error", "Something went wrong");
    }
  };
}
