export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Unable to connect. Check your connection, then try again. Your last action may already be saved.",
      0,
    );
  }
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(
      result.error?.code || "ERROR",
      result.error?.message || "Something went wrong.",
      response.status,
    );
  return result.data as T;
}
const pendingKeys = new Map<string, string>();
export async function post<T = unknown>(
  path: string,
  body: unknown = {},
): Promise<T> {
  const fingerprint = path + JSON.stringify(body);
  const key = pendingKeys.get(fingerprint) || crypto.randomUUID();
  pendingKeys.set(fingerprint, key);
  try {
    const result = await api<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Idempotency-Key": key },
    });
    pendingKeys.delete(fingerprint);
    return result;
  } catch (e) {
    if (e instanceof ApiError && e.status >= 400 && e.status < 500)
      pendingKeys.delete(fingerprint);
    throw e;
  }
}
