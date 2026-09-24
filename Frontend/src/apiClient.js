import { API_URL, authHeaders } from "./config";

export async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? authHeaders(options.token) : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      body: options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.blob();

    if (!response.ok) {
      const retryAfter = response.headers.get("Retry-After");
      const detail = data?.detail || data?.mensaje || "No fue posible completar la solicitud.";
      const error = new Error(response.status === 429 && retryAfter
        ? `${detail} Espera ${retryAfter} segundos.`
        : detail);
      error.status = response.status;
      throw error;
    }

    return { response, data };
  } finally {
    clearTimeout(timeout);
  }
}
