import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, getStoredSession } from "../config";
import DashboardLayout from "../components/DashboardLayout";
import SupportInbox from "../components/SupportInbox";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import TableControls from "../components/TableControls";
import { IconBox, IconWrench, IconMessage, IconGrid, IconReceipt, IconEdit, IconPower, IconTrash } from "../components/icons";

const menu = [
  { key: "resumen", label: "Resumen", icon: IconGrid },
  { key: "productos", label: "Productos", icon: IconBox },
  { key: "servicios", label: "Servicios", icon: IconWrench },
  { key: "ventas", label: "Ventas", icon: IconReceipt },
  { key: "facturas", label: "Facturas", icon: IconReceipt },
  { key: "soporte", label: "Soporte", icon: IconMessage },
];

const formatoCOP = (valor) => Number(valor || 0).toLocaleString("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const precioCOPDesdeEntrada = (valor) => {
  const texto = String(valor ?? "").trim().replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})+$/.test(texto)) return Number(texto.replace(/\./g, ""));
  return Number(texto.replace(",", "."));
};

function Empleado() {
  const token = localStorage.getItem("token");
  const usuario = getStoredSession();

  const authHeaders = useMemo(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [notificacion, setNotificacion] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);

  const [editando, setEditando] = useState(null);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", precio: "", stock: "" });

  const [editandoServicio, setEditandoServicio] = useState(null);
  const [creandoServicio, setCreandoServicio] = useState(false);
  const [formServicio, setFormServicio] = useState({ nombre: "", descripcion: "", precio: "" });
  const [filtroProductos, setFiltroProductos] = useState("");
  const [filtroServicios, setFiltroServicios] = useState("");
  const [filtroVentas, setFiltroVentas] = useState("");
  const [filtroFacturas, setFiltroFacturas] = useState("");
  const [paginaProductos, setPaginaProductos] = useState(1);
  const [paginaServicios, setPaginaServicios] = useState(1);
  const [paginaVentas, setPaginaVentas] = useState(1);
  const [paginaFacturas, setPaginaFacturas] = useState(1);

  const cargarTodo = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const [resProd, resServ, resResumen, resVentas, resFacturas, resUsuarios] = await Promise.all([
        fetch(`${API_URL}/productos/gestion`, { headers: authHeaders }),
        fetch(`${API_URL}/servicios/gestion`, { headers: authHeaders }),
        fetch(`${API_URL}/dashboard/empleado`, { headers: authHeaders }),
        fetch(`${API_URL}/ventas/`, { headers: authHeaders }),
        fetch(`${API_URL}/facturas/`, { headers: authHeaders }),
        fetch(`${API_URL}/usuarios/referencias`, { headers: authHeaders }),
      ]);
      const [dataProd, dataServ, dataResumen, dataVentas, dataFacturas, dataUsuarios] = await Promise.all([resProd.json(), resServ.json(), resResumen.json(), resVentas.json(), resFacturas.json(), resUsuarios.json()]);
      if (!resProd.ok) throw new Error(dataProd.mensaje || "Error al cargar productos");
      if (!resServ.ok) throw new Error(dataServ.mensaje || "Error al cargar servicios");
      if (!resResumen.ok) throw new Error(dataResumen.detail || "Error al cargar indicadores");
      if (!resVentas.ok) throw new Error(dataVentas.detail || "Error al cargar ventas");
      if (!resFacturas.ok) throw new Error(dataFacturas.detail || "Error al cargar facturas");
      if (!resUsuarios.ok) throw new Error(dataUsuarios.detail || "Error al cargar usuarios");
      setProductos(dataProd);
      setServicios(dataServ);
      setResumen(dataResumen);
      setVentas(dataVentas);
      setFacturas(dataFacturas);
      setUsuarios(dataUsuarios);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  // ---- Productos ----
  const abrirCreacion = () => {
    setForm({ nombre: "", descripcion: "", precio: "", stock: "" });
    setCreando(true);
  };

  const abrirEdicion = (p) => {
    setEditando(p.id);
    setForm({ nombre: p.nombre, descripcion: p.descripcion || "", precio: p.precio, stock: p.stock });
  };

  const cerrarModal = () => {
    setEditando(null);
    setCreando(false);
  };

  const guardarProducto = async () => {
    const precio = precioCOPDesdeEntrada(form.precio);
    const stock = Number(form.stock);
    if (!form.nombre.trim() || !Number.isInteger(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
      setNotificacion({ type: "error", message: "Completa el nombre, un precio entero mayor que cero y un stock válido." });
      return;
    }
    const url = creando ? `${API_URL}/productos/` : `${API_URL}/productos/${editando}`;
    const method = creando ? "POST" : "PUT";
    try {
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify({ ...form, precio, stock }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || data.detail || "Error al guardar producto");
      cerrarModal();
      cargarTodo();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const cambiarEstadoProducto = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`${API_URL}/productos/${id}/estado`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      cargarTodo();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const eliminarProducto = (id) => {
    setConfirmacion({
      title: "Eliminar producto",
      description: "El producto dejará de estar disponible. Esta acción no se puede deshacer.",
      confirmLabel: "Sí, eliminar producto",
      danger: true,
      onConfirm: async () => {
        try {
      const res = await fetch(`${API_URL}/productos/${id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error("Error al eliminar producto");
      cargarTodo();
    } catch (err) {
          setNotificacion({ type: "error", message: err.message });
        }
      },
    });
  };

  // ---- Servicios ----
  const abrirCreacionServicio = () => {
    setFormServicio({ nombre: "", descripcion: "", precio: "" });
    setCreandoServicio(true);
  };

  const abrirEdicionServicio = (s) => {
    setEditandoServicio(s.id);
    setFormServicio({ nombre: s.nombre, descripcion: s.descripcion || "", precio: s.precio });
  };

  const cerrarModalServicio = () => {
    setEditandoServicio(null);
    setCreandoServicio(false);
  };

  const guardarServicio = async () => {
    const precio = precioCOPDesdeEntrada(formServicio.precio);
    if (!formServicio.nombre.trim() || !Number.isInteger(precio) || precio <= 0) {
      setNotificacion({ type: "error", message: "Completa el nombre y un precio entero mayor que cero." });
      return;
    }
    const url = creandoServicio ? `${API_URL}/servicios/` : `${API_URL}/servicios/${editandoServicio}`;
    const method = creandoServicio ? "POST" : "PUT";
    try {
      const res = await fetch(url, { method, headers: authHeaders, body: JSON.stringify({ ...formServicio, precio }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || data.detail || "Error al guardar servicio");
      cerrarModalServicio();
      cargarTodo();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const cambiarEstadoServicio = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`${API_URL}/servicios/${id}/estado`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) throw new Error("Error al cambiar estado");
      cargarTodo();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const eliminarServicio = (id) => {
    setConfirmacion({
      title: "Eliminar servicio",
      description: "El servicio dejará de estar disponible. Esta acción no se puede deshacer.",
      confirmLabel: "Sí, eliminar servicio",
      danger: true,
      onConfirm: async () => {
        try {
      const res = await fetch(`${API_URL}/servicios/${id}`, { method: "DELETE", headers: authHeaders });
      if (!res.ok) throw new Error("Error al eliminar servicio");
      cargarTodo();
    } catch (err) {
          setNotificacion({ type: "error", message: err.message });
        }
      },
    });
  };

  if (cargando) return <p className="text-white p-10">Cargando...</p>;
  if (error) return <p className="text-red-400 p-10">{error}</p>;

  const ventasPorDia = Object.values(ventas.filter((venta) => venta.estado === "pagada").reduce((acumulado, venta) => {
    const fecha = venta.fecha ? new Date(venta.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "Sin fecha";
    if (!acumulado[fecha]) acumulado[fecha] = { fecha, total: 0 };
    acumulado[fecha].total += Number(venta.total);
    return acumulado;
  }, {})).slice(-7).map((dia, indice, lista) => ({
    ...dia,
    acumulado: lista.slice(0, indice + 1).reduce((total, actual) => total + actual.total, 0),
  }));
  const maxIngreso = Math.max(...ventasPorDia.map((dia) => dia.acumulado), 1);
  const puntosIngresos = ventasPorDia.map((dia, indice) => `${ventasPorDia.length === 1 ? 50 : (indice / (ventasPorDia.length - 1)) * 100},${100 - (dia.acumulado / maxIngreso) * 90}`).join(" ");
  const pqrPorEstado = [
    { label: "Abiertas", value: resumen?.atencion.abiertas || 0, color: "bg-[#ffb86b]" },
    { label: "Respondidas", value: resumen?.atencion.respondidas || 0, color: "bg-[#7c5cff]" },
    { label: "Cerradas", value: resumen?.atencion.cerradas || 0, color: "bg-[#4ea1ff]" },
  ];
  const maxPqr = Math.max(...pqrPorEstado.map((item) => item.value), 1);
  const nombreCliente = (id) => {
    const cliente = usuarios.find((item) => item.id === id);
    return cliente ? `${cliente.nombre} ${cliente.apellido}` : `Cliente #${id}`;
  };
  const correoCliente = (id) => usuarios.find((item) => item.id === id)?.correo || "";
  const productosFiltrados = productos.filter((item) => item.nombre.toLowerCase().includes(filtroProductos.toLowerCase()));
  const serviciosFiltrados = servicios.filter((item) => item.nombre.toLowerCase().includes(filtroServicios.toLowerCase()));
  const ventasFiltradas = ventas.filter((item) => `${item.id} ${nombreCliente(item.cliente_id)} ${item.estado}`.toLowerCase().includes(filtroVentas.toLowerCase()));
  const facturasFiltradas = facturas.filter((item) => `${item.numero_factura} ${item.venta_id} ${nombreCliente(item.cliente_id)} ${item.estado}`.toLowerCase().includes(filtroFacturas.toLowerCase()));
  const paginaCatalogo = 6;
  const paginasProductos = Math.max(1, Math.ceil(productosFiltrados.length / paginaCatalogo));
  const paginasServicios = Math.max(1, Math.ceil(serviciosFiltrados.length / paginaCatalogo));
  const paginasVentas = Math.max(1, Math.ceil(ventasFiltradas.length / paginaCatalogo));
  const paginasFacturas = Math.max(1, Math.ceil(facturasFiltradas.length / paginaCatalogo));
  const productosVisibles = productosFiltrados.slice((paginaProductos - 1) * paginaCatalogo, paginaProductos * paginaCatalogo);
  const serviciosVisibles = serviciosFiltrados.slice((paginaServicios - 1) * paginaCatalogo, paginaServicios * paginaCatalogo);
  const ventasVisibles = ventasFiltradas.slice((paginaVentas - 1) * paginaCatalogo, paginaVentas * paginaCatalogo);
  const facturasVisibles = facturasFiltradas.slice((paginaFacturas - 1) * paginaCatalogo, paginaFacturas * paginaCatalogo);

  return (
    <DashboardLayout
      menu={menu}
      activeKey={tab}
      onSelect={setTab}
      usuario={usuario}
      title={tab === "resumen" ? "Resumen operativo" : tab === "productos" ? "Gestión de productos" : tab === "servicios" ? "Gestión de servicios" : tab === "ventas" ? "Ventas" : tab === "facturas" ? "Facturas" : "Bandeja de soporte"}
    >

      {tab === "resumen" && resumen && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            {[['Ventas', resumen.ventas.total], ['Pagadas', resumen.ventas.pagadas], ['Ingresos', formatoCOP(resumen.ventas.ingresos)], ['Productos activos', resumen.catalogo.productos_activos], ['Servicios activos', resumen.catalogo.servicios_activos], ['PQR abiertas', resumen.atencion.abiertas]].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-white/5 bg-[#1a1a26] p-5">
                <p className="break-words font-display text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-sm text-gray-500">{label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <section className="rounded-xl border border-white/5 bg-[#1a1a26] p-5">
              <div className="mb-5 flex items-baseline justify-between gap-3"><h2 className="text-base font-medium text-white">Ingresos pagados acumulados</h2><span className="text-xs text-[#78b9ff]">{formatoCOP(resumen.ventas.ingresos)}</span></div>
              {ventasPorDia.length === 0 ? <p className="text-sm text-gray-500">No hay ventas pagadas para graficar.</p> : <div className="h-56 flex items-end gap-3">{ventasPorDia.map((dia) => <div key={dia.fecha} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[11px] text-gray-400">{formatoCOP(dia.acumulado)}</span><div className="w-full max-w-12 rounded-t bg-[#4ea1ff]" style={{ height: `${Math.max((dia.acumulado / maxIngreso) * 100, 2)}%` }} /><span className="whitespace-nowrap text-[11px] text-gray-500">{dia.fecha}</span></div>)}</div>}
            </section>
            <section className="rounded-xl border border-white/5 bg-[#1a1a26] p-5">
              <div className="mb-5 flex items-baseline justify-between gap-3"><h2 className="text-base font-medium text-white">Tendencia de ingresos</h2><span className="text-xs text-[#78b9ff]">Acumulado</span></div>
              {ventasPorDia.length === 0 ? <p className="text-sm text-gray-500">No hay ventas pagadas para graficar.</p> : <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-56 w-full overflow-visible"><line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,.15)" strokeWidth="1" /><polyline points={puntosIngresos} fill="none" stroke="#4ea1ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{ventasPorDia.map((dia, indice) => <circle key={dia.fecha} cx={ventasPorDia.length === 1 ? 50 : (indice / (ventasPorDia.length - 1)) * 100} cy={100 - (dia.acumulado / maxIngreso) * 90} r="1.8" fill="#7c5cff" vectorEffect="non-scaling-stroke" />)}</svg>}
            </section>
          </div>
          <section className="rounded-xl border border-white/5 bg-[#1a1a26] p-5"><div className="mb-5 flex items-baseline justify-between gap-3"><h2 className="text-base font-medium text-white">PQR por estado</h2><span className="text-xs text-gray-500">{resumen.atencion.total} en total</span></div><div className="flex h-48 items-end justify-around gap-5 border-b border-white/10 pb-1">{pqrPorEstado.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-sm font-medium text-white">{item.value}</span><div className={`w-full max-w-20 rounded-t ${item.color}`} style={{ height: `${Math.max((item.value / maxPqr) * 100, item.value ? 5 : 1)}%` }} /><span className="text-xs text-gray-500">{item.label}</span></div>)}</div></section>
        </div>
      )}

      {tab === "productos" && (
        <>
          <div className="mb-4 flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-display text-lg font-semibold text-white">Productos tecnológicos</h2><p className="mt-1 text-sm text-gray-500">Administra los productos disponibles para los clientes.</p></div>
            <button onClick={abrirCreacion} className="rounded-lg bg-[#4ea1ff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3a8fee]">+ Nuevo producto</button>
          </div>

          <TableControls search={filtroProductos} onSearchChange={(value) => { setFiltroProductos(value); setPaginaProductos(1); }} page={paginaProductos} totalPages={paginasProductos} totalItems={productosFiltrados.length} pageSize={paginaCatalogo} onPrevious={() => setPaginaProductos((page) => Math.max(1, page - 1))} onNext={() => setPaginaProductos((page) => Math.min(paginasProductos, page + 1))} placeholder="Buscar producto..." />

          {productos.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No hay productos registrados.</p>
          ) : (
            <div className="nt-table-wrap">
              <table className="nt-table min-w-[920px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="p-4 font-medium">Nombre</th>
                    <th className="p-4 font-medium">Descripción</th>
                    <th className="p-4 font-medium">Precio</th>
                    <th className="p-4 font-medium">Stock</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosVisibles.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 last:border-0 transition-colors hover:bg-[#4ea1ff]/[0.04]">
                      <td className="p-4 font-medium text-white"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#4ea1ff]/10 text-sm font-semibold text-[#78b9ff]">{p.nombre.slice(0, 1).toUpperCase()}</span><span>{p.nombre}</span></div></td>
                      <td className="max-w-[18rem] p-4 text-gray-400"><span className="line-clamp-2">{p.descripcion || "Sin descripción"}</span></td>
                      <td className="p-4 font-semibold text-white">{formatoCOP(p.precio)}</td>
                      <td className="p-4"><span className={`inline-flex min-w-16 justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${p.stock <= 5 ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" : "border-white/10 bg-white/5 text-gray-300"}`}>{p.stock} unidades</span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${p.estado === "activo" ? "border-[#4ea1ff]/30 bg-[#4ea1ff]/10 text-[#78b9ff]" : "border-white/10 bg-white/5 text-gray-500"}`}>{p.estado}</span>
                      </td>
                      <td className="p-4">
                        <div className="grid min-w-[190px] grid-cols-2 gap-2">
                        <button title="Editar producto" aria-label="Editar producto" onClick={() => abrirEdicion(p)} className="flex min-h-9 items-center justify-center rounded-md border border-[#4ea1ff]/25 bg-[#4ea1ff]/10 px-3 text-[#9bcaff] transition hover:bg-[#4ea1ff]/20">
                          <span className="h-4 w-4">{IconEdit}</span>
                        </button>
                        <button
                          title={p.estado === "activo" ? "Desactivar producto" : "Activar producto"}
                          aria-label={p.estado === "activo" ? "Desactivar producto" : "Activar producto"}
                          onClick={() => cambiarEstadoProducto(p.id, p.estado)}
                          className="flex min-h-9 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-3 text-amber-200 transition hover:bg-amber-300/20"
                        >
                          <span className="h-4 w-4">{IconPower}</span>
                        </button>
                        <button title="Eliminar producto" aria-label="Eliminar producto" onClick={() => eliminarProducto(p.id)} className="col-span-2 flex min-h-9 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 px-3 text-red-300 transition hover:bg-red-400/20">
                          <span className="h-4 w-4">{IconTrash}</span>
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(editando || creando) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
              <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a25] p-6 shadow-2xl shadow-black/40">
                <h2 className="mb-5 text-xl font-bold text-white">{creando ? "Nuevo producto" : "Editar producto"}</h2>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input aria-label="Nombre del producto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea aria-label="Descripción del producto" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="mb-3 min-h-24 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <label className="block text-sm text-gray-400 mb-1">Precio</label>
                <input aria-label="Precio del producto" type="text" inputMode="numeric" placeholder="Ej. 25.000" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <label className="block text-sm text-gray-400 mb-1">Stock</label>
                <input aria-label="Stock del producto" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="mb-5 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <div className="flex gap-3">
                  <button type="button" onClick={guardarProducto} className="flex-1 rounded-lg bg-[#4ea1ff] py-2.5 font-medium text-white hover:bg-[#3a8fee]">Guardar</button>
                  <button type="button" onClick={cerrarModal} className="flex-1 rounded-lg bg-white/10 py-2.5 text-white hover:bg-white/20">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "servicios" && (
        <>
          <div className="mb-4 flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="font-display text-lg font-semibold text-white">Servicios tecnológicos</h2><p className="mt-1 text-sm text-gray-500">Administra las soluciones disponibles para los clientes.</p></div>
            <button onClick={abrirCreacionServicio} className="rounded-lg bg-[#4ea1ff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3a8fee]">+ Nuevo servicio</button>
          </div>

          <TableControls search={filtroServicios} onSearchChange={(value) => { setFiltroServicios(value); setPaginaServicios(1); }} page={paginaServicios} totalPages={paginasServicios} totalItems={serviciosFiltrados.length} pageSize={paginaCatalogo} onPrevious={() => setPaginaServicios((page) => Math.max(1, page - 1))} onNext={() => setPaginaServicios((page) => Math.min(paginasServicios, page + 1))} placeholder="Buscar servicio..." />

          {servicios.length === 0 ? (
            <p className="text-gray-400 text-center py-10">No hay servicios registrados.</p>
          ) : (
            <div className="nt-table-wrap">
              <table className="nt-table min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                    <th className="p-4 font-medium">Nombre</th>
                    <th className="p-4 font-medium">Descripción</th>
                    <th className="p-4 font-medium">Precio</th>
                    <th className="p-4 font-medium">Estado</th>
                    <th className="p-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosVisibles.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 last:border-0 transition-colors hover:bg-[#4ea1ff]/[0.04]">
                      <td className="p-4 font-medium text-white"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7c5cff]/10 text-sm font-semibold text-[#b6a5ff]">{s.nombre.slice(0, 1).toUpperCase()}</span><span>{s.nombre}</span></div></td>
                      <td className="max-w-[18rem] p-4 text-gray-400"><span className="line-clamp-2">{s.descripcion || "Sin descripción"}</span></td>
                      <td className="p-4 font-semibold text-white">{formatoCOP(s.precio)}</td>
                      <td className="p-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${s.estado === "activo" ? "border-[#4ea1ff]/30 bg-[#4ea1ff]/10 text-[#78b9ff]" : "border-white/10 bg-white/5 text-gray-500"}`}>{s.estado}</span>
                      </td>
                      <td className="p-4">
                        <div className="grid min-w-[190px] grid-cols-2 gap-2">
                        <button title="Editar servicio" aria-label="Editar servicio" onClick={() => abrirEdicionServicio(s)} className="flex min-h-9 items-center justify-center rounded-md border border-[#7c5cff]/25 bg-[#7c5cff]/10 px-3 text-[#c2b5ff] transition hover:bg-[#7c5cff]/20">
                          <span className="h-4 w-4">{IconEdit}</span>
                        </button>
                        <button
                          title={s.estado === "activo" ? "Desactivar servicio" : "Activar servicio"}
                          aria-label={s.estado === "activo" ? "Desactivar servicio" : "Activar servicio"}
                          onClick={() => cambiarEstadoServicio(s.id, s.estado)}
                          className="flex min-h-9 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-3 text-amber-200 transition hover:bg-amber-300/20"
                        >
                          <span className="h-4 w-4">{IconPower}</span>
                        </button>
                        <button title="Eliminar servicio" aria-label="Eliminar servicio" onClick={() => eliminarServicio(s.id)} className="col-span-2 flex min-h-9 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 px-3 text-red-300 transition hover:bg-red-400/20">
                          <span className="h-4 w-4">{IconTrash}</span>
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(editandoServicio || creandoServicio) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
              <div className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a25] p-6 shadow-2xl shadow-black/40">
                <h2 className="mb-5 text-xl font-bold text-white">{creandoServicio ? "Nuevo servicio" : "Editar servicio"}</h2>
                <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input aria-label="Nombre del servicio" value={formServicio.nombre} onChange={(e) => setFormServicio({ ...formServicio, nombre: e.target.value })} className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea aria-label="Descripción del servicio" value={formServicio.descripcion} onChange={(e) => setFormServicio({ ...formServicio, descripcion: e.target.value })} className="mb-3 min-h-24 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <label className="block text-sm text-gray-400 mb-1">Precio</label>
                <input aria-label="Precio del servicio" type="text" inputMode="numeric" placeholder="Ej. 25.000" value={formServicio.precio} onChange={(e) => setFormServicio({ ...formServicio, precio: e.target.value })} className="mb-5 w-full rounded-lg border border-white/10 bg-white/5 p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
                <div className="flex gap-3">
                  <button type="button" onClick={guardarServicio} className="flex-1 rounded-lg bg-[#4ea1ff] py-2.5 font-medium text-white hover:bg-[#3a8fee]">Guardar</button>
                  <button type="button" onClick={cerrarModalServicio} className="flex-1 rounded-lg bg-white/10 py-2.5 text-white hover:bg-white/20">Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {tab === "ventas" && (
        <div className="nt-table-wrap"><div className="border-b border-white/5 p-4"><h2 className="font-display text-lg font-semibold text-white">Ventas registradas</h2><p className="mt-1 text-sm text-gray-500">Consulta el estado y valor de cada venta.</p></div><TableControls search={filtroVentas} onSearchChange={(value) => { setFiltroVentas(value); setPaginaVentas(1); }} page={paginaVentas} totalPages={paginasVentas} totalItems={ventasFiltradas.length} pageSize={paginaCatalogo} onPrevious={() => setPaginaVentas((page) => Math.max(1, page - 1))} onNext={() => setPaginaVentas((page) => Math.min(paginasVentas, page + 1))} placeholder="Buscar venta o cliente..." /><div className="overflow-x-auto"><table className="nt-table min-w-[850px] text-sm"><thead><tr><th>Venta</th><th>Cliente</th><th>Correo</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead><tbody>{ventasVisibles.length === 0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-500">No hay ventas que coincidan.</td></tr> : ventasVisibles.map((venta) => <tr key={venta.id}><td className="p-4 font-medium text-white">#{venta.id}</td><td className="p-4 text-gray-300">{nombreCliente(venta.cliente_id)}</td><td className="p-4 text-gray-400">{correoCliente(venta.cliente_id) || "—"}</td><td className="p-4 text-gray-300">{venta.fecha ? new Date(venta.fecha).toLocaleDateString("es-CO") : "—"}</td><td className="p-4"><span className="nt-badge capitalize border-[#4ea1ff]/40 text-[#78b9ff]">{venta.estado}</span></td><td className="p-4 font-medium text-white">{formatoCOP(venta.total)}</td></tr>)}</tbody></table></div></div>
      )}

      {tab === "facturas" && (
        <div className="nt-table-wrap"><div className="border-b border-white/5 p-4"><h2 className="font-display text-lg font-semibold text-white">Facturas emitidas</h2><p className="mt-1 text-sm text-gray-500">Consulta los comprobantes generados.</p></div><TableControls search={filtroFacturas} onSearchChange={(value) => { setFiltroFacturas(value); setPaginaFacturas(1); }} page={paginaFacturas} totalPages={paginasFacturas} totalItems={facturasFiltradas.length} pageSize={paginaCatalogo} onPrevious={() => setPaginaFacturas((page) => Math.max(1, page - 1))} onNext={() => setPaginaFacturas((page) => Math.min(paginasFacturas, page + 1))} placeholder="Buscar factura o cliente..." /><div className="overflow-x-auto"><table className="nt-table min-w-[850px] text-sm"><thead><tr><th>Factura</th><th>Venta</th><th>Cliente</th><th>Correo</th><th>Estado</th><th>Subtotal</th><th>IVA</th><th>Total</th></tr></thead><tbody>{facturasVisibles.length === 0 ? <tr><td colSpan="8" className="p-8 text-center text-gray-500">No hay facturas que coincidan.</td></tr> : facturasVisibles.map((factura) => <tr key={factura.id}><td className="p-4 font-medium text-white">{factura.numero_factura}</td><td className="p-4 text-gray-300">#{factura.venta_id}</td><td className="p-4 text-gray-300">{nombreCliente(factura.cliente_id)}</td><td className="p-4 text-gray-400">{correoCliente(factura.cliente_id) || "—"}</td><td className="p-4"><span className="nt-badge capitalize border-[#4ea1ff]/40 text-[#78b9ff]">{factura.estado}</span></td><td className="p-4 text-gray-300">{formatoCOP(factura.subtotal)}</td><td className="p-4 text-gray-300">{formatoCOP(factura.impuestos)}</td><td className="p-4 font-medium text-white">{formatoCOP(factura.total)}</td></tr>)}</tbody></table></div></div>
      )}

      {tab === "soporte" && <SupportInbox token={token} />}
      <Toast notice={notificacion} onClose={() => setNotificacion(null)} />
      <ConfirmDialog
        open={Boolean(confirmacion)}
        {...confirmacion}
        onCancel={() => setConfirmacion(null)}
        onConfirm={async () => {
          await confirmacion?.onConfirm();
          setConfirmacion(null);
        }}
      />
    </DashboardLayout>
  );
}

export default Empleado;
