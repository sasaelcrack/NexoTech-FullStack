import { useCallback, useEffect, useState } from "react";
import { API_URL, authHeaders } from "../config";
import ProductoImagen from "./ProductoImagen";

const formatoCOP = (valor) => Number(valor || 0).toLocaleString("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function CarritosActivos({ token }) {
  const [carritos, setCarritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargarCarritos = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/carritos/activos`, { headers: authHeaders(token) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No se pudieron cargar los carritos activos");
      setCarritos(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setCargando(false);
    }
  }, [token]);

  useEffect(() => {
    cargarCarritos();
  }, [cargarCarritos]);

  return (
    <section className="nt-table-wrap">
      <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-white">Carritos activos</h2>
          <p className="mt-1 text-sm text-gray-500">Carritos guardados durante las últimas 24 horas; todavía no son ventas ni reservan stock.</p>
        </div>
        <button onClick={cargarCarritos} disabled={cargando} className="self-start rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10 disabled:opacity-50 sm:self-auto">
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && <p role="alert" className="p-4 text-sm text-red-300">{error}</p>}
      {cargando ? (
        <p className="p-6 text-sm text-gray-400">Cargando carritos...</p>
      ) : carritos.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-500">No hay carritos activos en las últimas 24 horas.</p>
      ) : (
        <div className="space-y-4 p-4">
          {carritos.map((carrito) => (
            <article key={carrito.usuario_id} className="rounded-xl border border-white/10 bg-[#111522]/75 p-4">
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-medium text-white">{carrito.cliente_nombre}</h3>
                  <p className="text-xs text-gray-500">{carrito.cliente_correo}</p>
                </div>
                <time className="text-xs text-gray-500" dateTime={carrito.actualizado_en}>
                  Actualizado {carrito.actualizado_en ? new Date(carrito.actualizado_en).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—"}
                </time>
              </header>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead><tr className="border-b border-white/10 text-left text-xs text-gray-500"><th className="py-2 pr-3">Artículo</th><th className="px-3 py-2">Cantidad</th><th className="px-3 py-2">Precio</th><th className="px-3 py-2">Subtotal</th><th className="py-2 pl-3">Disponibilidad</th></tr></thead>
                  <tbody>
                    {carrito.items.map((item) => (
                      <tr key={`${item.tipo_item}-${item.id}`} className="border-b border-white/5 last:border-0">
                        <td className="py-3 pr-3"><div className="flex items-center gap-3"><ProductoImagen src={item.imagen_url} nombre={item.nombre} className="h-10 w-10"/><div><p className="max-w-56 truncate font-medium text-white">{item.nombre}</p><p className="text-xs capitalize text-gray-500">{item.tipo_item}</p></div></div></td>
                        <td className="px-3 py-3 text-gray-300">{item.cantidad}</td>
                        <td className="px-3 py-3 text-gray-300">{formatoCOP(item.precio)}</td>
                        <td className="px-3 py-3 text-gray-300">{formatoCOP(item.subtotal)}</td>
                        <td className="py-3 pl-3"><span className={item.disponible ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{item.disponible ? "Disponible" : "No disponible / stock insuficiente"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="mt-3 flex flex-wrap justify-end gap-x-5 gap-y-1 border-t border-white/5 pt-3 text-xs text-gray-400">
                <span>Subtotal: {formatoCOP(carrito.subtotal)}</span>
                <span>IVA estimado: {formatoCOP(carrito.impuestos)}</span>
                <span className="font-semibold text-white">Total estimado: {formatoCOP(carrito.total_estimado)}</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default CarritosActivos;
