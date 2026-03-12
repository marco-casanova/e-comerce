import { API_BASE_URL } from "./apiConfig";
import { AppError, toAppError } from "../errors/appError";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

type AccessTokenProvider = () => string | null;

let accessTokenProvider: AccessTokenProvider = () => null;
const REQUEST_TIMEOUT_MS = 4500;

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const accessToken = accessTokenProvider();

  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError({
        message: "Network request timed out",
        code: "REQUEST_TIMEOUT",
      });
    }

    throw toAppError(error);
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new AppError({
      message:
        payload && typeof payload === "object" && "message" in payload
          ? String(payload.message)
          : `Request failed with status ${response.status}`,
      code:
        payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "REQUEST_FAILED",
      statusCode: response.status,
      details: payload,
    });
  }

  return payload as T;
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
