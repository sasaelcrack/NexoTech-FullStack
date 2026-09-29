import { API_URL, authHeaders } from "./config";

function formatApiDetail(detail) {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => {
      if (typeof item === "string") return item;
      if (
        item?.type === "string_too_short" &&
        item?.loc?.at(-1) === "password" &&
        Number.isInteger(item?.ctx?.min_length)
      ) {
        return `La contraseña debe tener al menos ${item.ctx.min_length} caracteres.`;
      }
      if (typeof item?.msg === "string") return item.msg;
      return "Revisa los datos ingresados.";
    }).join(" ");
  }
  if (typeof detail?.message === "string") return detail.message;
  if (typeof detail?.msg === "string") return detail.msg;
  return "No fue posible completar la solicitud.";
}

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
      const detail = formatApiDetail(data?.detail ?? data?.mensaje);
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
