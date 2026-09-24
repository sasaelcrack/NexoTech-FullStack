const defaultApiUrl = "http://127.0.0.1:8000/api";

export const API_URL = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");

export function getStoredSession() {
  try {
    const session = JSON.parse(localStorage.getItem("usuario") || "null");
    return session && Number.isInteger(session.id) && [1, 2, 3].includes(session.rol_id)
      ? session
      : null;
  } catch {
    localStorage.removeItem("usuario");
    return null;
  }
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
