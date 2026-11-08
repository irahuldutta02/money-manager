export class ApiClientError extends Error {
  constructor(message, status = 0, code = "error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** JSON fetch against our own API. Throws ApiClientError; 401 -> sign-in. */
export async function apiFetch(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiClientError("You appear to be offline.", 0, "network");
  }

  const data = await res.json().catch(() => null);

  if (res.status === 401) {
    const next = encodeURIComponent(location.pathname + location.search);
    // Hard navigation on purpose: resets the in-memory query cache too.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.assign(`/sign-in?next=${next}`);
    throw new ApiClientError("Sign in required", 401, "unauthorized");
  }
  if (!res.ok) {
    throw new ApiClientError(
      data?.error?.message ?? "Something went wrong. Please try again.",
      res.status,
      data?.error?.code ?? "error",
    );
  }
  return data;
}
