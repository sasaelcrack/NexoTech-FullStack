import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, authHeaders, getStoredSession } from "../config";
import DashboardLayout from "../components/DashboardLayout";
import SupportInbox from "../components/SupportInbox";
import ConfirmDialog from "../components/ConfirmDialog";
import Toast from "../components/Toast";
import TableControls from "../components/TableControls";
import ProductoImagen from "../components/ProductoImagen";
import { IconGrid, IconUsers, IconBox, IconWrench, IconMessage, IconReceipt, IconEdit, IconPower, IconTrash } from "../components/icons";

const menu = [
  { key: "resumen", label: "Resumen", icon: IconGrid },
  { key: "usuarios", label: "Usuarios", icon: IconUsers },
  { key: "productos", label: "Productos", icon: IconBox },
  { key: "servicios", label: "Servicios", icon: IconWrench },
  { key: "soporte", label: "Soporte", icon: IconMessage },
  { key: "reportes", label: "Reportes", icon: IconReceipt },
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

function Admin() {
  const [activeKey, setActiveKey] = useState("resumen");

  // --- Usuarios ---
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({ nombre: "", apellido: "", correo: "", telefono: "" });

  // --- Productos ---
  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState("");
  const [editandoProducto, setEditandoProducto] = useState(null);
  const [creandoProducto, setCreandoProducto] = useState(false);
  const [formProducto, setFormProducto] = useState({ nombre: "", descripcion: "", precio: "", stock: "" });
  const [imagenActualProducto, setImagenActualProducto] = useState("");
  const [archivoImagenProducto, setArchivoImagenProducto] = useState(null);
  const [vistaPreviaImagenProducto, setVistaPreviaImagenProducto] = useState("");
  const [quitarImagenProducto, setQuitarImagenProducto] = useState(false);
  const [guardandoImagenProducto, setGuardandoImagenProducto] = useState(false);
  const [editandoServicio, setEditandoServicio] = useState(null);
  const [creandoServicio, setCreandoServicio] = useState(false);
  const [formServicio, setFormServicio] = useState({ nombre: "", descripcion: "", precio: "" });
  const [resumen, setResumen] = useState(null);
  const [reporteVentas, setReporteVentas] = useState(null);
  const [errorAnalitica, setErrorAnalitica] = useState("");
  const [filtrosReporte, setFiltrosReporte] = useState({ fecha_desde: "", fecha_hasta: "", estado: "", cliente_id: "", producto_id: "", servicio_id: "" });
  const [notificacion, setNotificacion] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const [filtroUsuarios, setFiltroUsuarios] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroProductos, setFiltroProductos] = useState("");
  const [filtroServicios, setFiltroServicios] = useState("");
  const [paginaUsuarios, setPaginaUsuarios] = useState(1);
  const [paginaProductos, setPaginaProductos] = useState(1);
  const [paginaServicios, setPaginaServicios] = useState(1);
  const [busquedaReporte, setBusquedaReporte] = useState("");
  const [paginaReporte, setPaginaReporte] = useState(1);

  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const usuarioGuardado = getStoredSession();

  useEffect(() => {
    if (!token || !usuarioGuardado || usuarioGuardado.rol_id !== 1) {
      navigate("/login");
      return;
    }
    cargarUsuarios();
    cargarProductos();
    cargarAnalitica();
    // Estas funciones dependen del estado de la sesión y se ejecutan al montar el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarAnalitica = async () => {
    setErrorAnalitica("");
    try {
      const [resResumen, resReporte] = await Promise.all([
        fetch(`${API_URL}/dashboard/admin`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/reportes/ventas`, { headers: authHeaders(token) }),
      ]);
      const [dataResumen, dataReporte] = await Promise.all([resResumen.json(), resReporte.json()]);
      if (!resResumen.ok) throw new Error(dataResumen.detail || "No se pudo cargar el resumen");
      if (!resReporte.ok) throw new Error(dataReporte.detail || "No se pudo cargar el reporte de ventas");
      setResumen(dataResumen);
      setReporteVentas(dataReporte);
    } catch (err) {
      setErrorAnalitica(err.message);
    }
  };

  const consultaReporte = (filtros = filtrosReporte) => {
    const parametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => { if (valor) parametros.set(clave, valor); });
    const query = parametros.toString();
    return `${API_URL}/reportes/ventas${query ? `?${query}` : ""}`;
  };

  const filtrarReporte = async () => {
    setErrorAnalitica("");
    try {
      const res = await fetch(consultaReporte(), { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo filtrar el reporte");
      setReporteVentas(data);
    } catch (err) {
      setErrorAnalitica(err.message);
    }
  };

  const descargarReporte = async (formato) => {
    setErrorAnalitica("");
    try {
      const url = consultaReporte().replace("/ventas", `/ventas/${formato}`);
      const res = await fetch(url, { headers: authHeaders(token) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "No se pudo descargar el reporte");
      }
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(await res.blob());
      enlace.download = `reporte-ventas.${formato === "excel" ? "xlsx" : "pdf"}`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (err) {
      setErrorAnalitica(err.message);
    }
  };

  // --- Lógica de Usuarios (sin cambios) ---
  const cargarUsuarios = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API_URL}/usuarios/`, { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al cargar usuarios");
      setUsuarios(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const abrirEdicion = (u) => {
    setEditando(u.id);
    setFormEdit({ nombre: u.nombre, apellido: u.apellido, correo: u.correo, telefono: u.telefono || "" });
  };

  const cerrarEdicion = () => setEditando(null);

  const guardarEdicion = async (id) => {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(formEdit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al actualizar usuario");
      cerrarEdicion();
      cargarUsuarios();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const cambiarEstado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al cambiar estado");
      cargarUsuarios();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const cambiarRol = async (id, rolId) => {
    try {
      const res = await fetch(`${API_URL}/usuarios/${id}/rol`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ rol_id: Number(rolId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al cambiar rol");
      cargarUsuarios();
      cargarAnalitica();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const eliminarUsuario = (id) => {
    setConfirmacion({
      title: "Eliminar usuario",
      description: "Esta acción eliminará la cuenta seleccionada. No se puede deshacer.",
      confirmLabel: "Sí, eliminar usuario",
      danger: true,
      onConfirm: async () => {
        try {
      const res = await fetch(`${API_URL}/usuarios/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Error al eliminar usuario");
      }
      cargarUsuarios();
    } catch (err) {
          setNotificacion({ type: "error", message: err.message });
        }
      },
    });
  };

  // --- Lógica de Productos (nueva) ---
  const cargarProductos = async () => {
    setCargandoProductos(true);
    try {
      const [resProductos, resServicios] = await Promise.all([
        fetch(`${API_URL}/productos/gestion`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/servicios/gestion`, { headers: authHeaders(token) }),
      ]);
      const [dataProductos, dataServicios] = await Promise.all([resProductos.json(), resServicios.json()]);
      if (!resProductos.ok) throw new Error(dataProductos.detail || "Error al cargar productos");
      if (!resServicios.ok) throw new Error(dataServicios.detail || "Error al cargar servicios");
      setProductos(dataProductos);
      setServicios(dataServicios);
    } catch (err) {
      setErrorProductos(err.message);
    } finally {
      setCargandoProductos(false);
    }
  };

  const abrirCreacionProducto = () => {
    setFormProducto({ nombre: "", descripcion: "", precio: "", stock: "" });
    setImagenActualProducto("");
    setArchivoImagenProducto(null);
    setVistaPreviaImagenProducto("");
    setQuitarImagenProducto(false);
    setCreandoProducto(true);
  };

  const abrirEdicionProducto = (p) => {
    setEditandoProducto(p.id);
    setFormProducto({
      nombre: p.nombre,
      descripcion: p.descripcion || "",
      precio: p.precio,
      stock: p.stock,
    });
    setImagenActualProducto(p.imagen_url || "");
    setArchivoImagenProducto(null);
    setVistaPreviaImagenProducto("");
    setQuitarImagenProducto(false);
  };

  const cerrarModalProducto = () => {
    setEditandoProducto(null);
    setCreandoProducto(false);
    setImagenActualProducto("");
    setArchivoImagenProducto(null);
    setVistaPreviaImagenProducto("");
    setQuitarImagenProducto(false);
  };

  const seleccionarImagenProducto = (event) => {
    const archivo = event.target.files?.[0] || null;
    if (archivo && archivo.size > 5 * 1024 * 1024) {
      setNotificacion({ type: "error", message: "La imagen no puede superar los 5 MB." });
      event.target.value = "";
      return;
    }
    setArchivoImagenProducto(archivo);
    setQuitarImagenProducto(false);
    if (!archivo) {
      setVistaPreviaImagenProducto("");
      return;
    }
    const lector = new FileReader();
    lector.onload = () => setVistaPreviaImagenProducto(typeof lector.result === "string" ? lector.result : "");
    lector.readAsDataURL(archivo);
  };

  const guardarProducto = async () => {
    const precio = precioCOPDesdeEntrada(formProducto.precio);
    const stock = Number(formProducto.stock);
    if (!formProducto.nombre.trim() || !Number.isInteger(precio) || precio <= 0 || !Number.isInteger(stock) || stock < 0) {
      setNotificacion({ type: "error", message: "Completa el nombre, un precio entero mayor que cero y un stock válido." });
      return;
    }
    const esCreacion = creandoProducto;
    const url = esCreacion ? `${API_URL}/productos/` : `${API_URL}/productos/${editandoProducto}`;
    setGuardandoImagenProducto(true);
    try {
      const res = await fetch(url, {
        method: esCreacion ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ ...formProducto, precio, stock }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al guardar producto");
      const productoId = esCreacion ? data.id : editandoProducto;
      if (esCreacion) {
        setCreandoProducto(false);
        setEditandoProducto(productoId);
      }
      if (archivoImagenProducto) {
        const formData = new FormData();
        formData.append("imagen", archivoImagenProducto);
        const respuestaImagen = await fetch(`${API_URL}/productos/${productoId}/imagen`, {
          method: "POST",
          headers: authHeaders(token),
          body: formData,
        });
        const datosImagen = await respuestaImagen.json();
        if (!respuestaImagen.ok) throw new Error(datosImagen.detail || "No se pudo subir la foto del producto");
      } else if (quitarImagenProducto && imagenActualProducto) {
        const respuestaImagen = await fetch(`${API_URL}/productos/${productoId}/imagen`, {
          method: "DELETE",
          headers: authHeaders(token),
        });
        const datosImagen = await respuestaImagen.json();
        if (!respuestaImagen.ok) throw new Error(datosImagen.detail || "No se pudo quitar la foto del producto");
      }
      cerrarModalProducto();
      cargarProductos();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    } finally {
      setGuardandoImagenProducto(false);
    }
  };

  const cambiarEstadoProducto = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";
    try {
      const res = await fetch(`${API_URL}/productos/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al cambiar estado");
      cargarProductos();
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
      const res = await fetch(`${API_URL}/productos/${id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Error al eliminar producto");
      }
      cargarProductos();
    } catch (err) {
          setNotificacion({ type: "error", message: err.message });
        }
      },
    });
  };

  const abrirCreacionServicio = () => {
    setFormServicio({ nombre: "", descripcion: "", precio: "" });
    setCreandoServicio(true);
  };

  const abrirEdicionServicio = (servicio) => {
    setEditandoServicio(servicio.id);
    setFormServicio({
      nombre: servicio.nombre,
      descripcion: servicio.descripcion || "",
      precio: servicio.precio,
    });
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
    const esCreacion = creandoServicio;
    const url = esCreacion ? `${API_URL}/servicios/` : `${API_URL}/servicios/${editandoServicio}`;
    try {
      const res = await fetch(url, {
        method: esCreacion ? "POST" : "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ ...formServicio, precio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al guardar servicio");
      cerrarModalServicio();
      cargarProductos();
    } catch (err) {
      setNotificacion({ type: "error", message: err.message });
    }
  };

  const cambiarEstadoServicio = async (id, estadoActual) => {
    try {
      const res = await fetch(`${API_URL}/servicios/${id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ estado: estadoActual === "activo" ? "inactivo" : "activo" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al cambiar estado del servicio");
      cargarProductos();
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
          const res = await fetch(`${API_URL}/servicios/${id}`, { method: "DELETE", headers: authHeaders(token) });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Error al eliminar servicio");
          }
          cargarProductos();
        } catch (err) {
          setNotificacion({ type: "error", message: err.message });
        }
      },
    });
  };

  if (cargando) return <p className="text-white p-10">Cargando usuarios...</p>;
  if (error) return <p className="text-red-400 p-10">{error}</p>;

  const kpis = resumen ? [
    { label: "Administradores activos", value: resumen.usuarios.administradores },
    { label: "Empleados activos", value: resumen.usuarios.empleados },
    { label: "Clientes activos", value: resumen.usuarios.clientes },
  ] : [];
  const pqrPorEstado = resumen ? [
    { label: "Abiertas", value: resumen.atencion.abiertas, color: "bg-[#ffb86b]" },
    { label: "Respondidas", value: resumen.atencion.respondidas, color: "bg-[#7c5cff]" },
    { label: "Cerradas", value: resumen.atencion.cerradas, color: "bg-[#4ea1ff]" },
  ] : [];
  const maxPqrEstado = Math.max(...pqrPorEstado.map((pqr) => pqr.value), 1);
  const ventasPorDia = Object.values((reporteVentas?.ventas || []).reduce((acumulado, venta) => {
    const fecha = venta.fecha ? new Date(venta.fecha).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "Sin fecha";
    if (!acumulado[fecha]) acumulado[fecha] = { fecha, total: 0 };
    if (venta.estado === "pagada") acumulado[fecha].total += Number(venta.total);
    return acumulado;
  }, {})).slice(-7).map((dia, indice, lista) => ({ ...dia, acumulado: lista.slice(0, indice + 1).reduce((total, actual) => total + actual.total, 0) }));
  const maxIngresoDia = Math.max(...ventasPorDia.map((dia) => dia.acumulado), 1);
  const puntosIngresos = ventasPorDia.map((dia, indice) => `${ventasPorDia.length === 1 ? 50 : (indice / (ventasPorDia.length - 1)) * 100},${100 - (dia.acumulado / maxIngresoDia) * 90}`).join(" ");
  const paginaTabla = 6;
  const usuariosFiltrados = usuarios.filter((item) => `${item.nombre} ${item.apellido} ${item.correo}`.toLowerCase().includes(filtroUsuarios.toLowerCase()) && (!filtroRol || String(item.rol_id) === filtroRol));
  const productosFiltrados = productos.filter((item) => item.nombre.toLowerCase().includes(filtroProductos.toLowerCase()));
  const serviciosFiltrados = servicios.filter((item) => item.nombre.toLowerCase().includes(filtroServicios.toLowerCase()));
  const paginasUsuarios = Math.max(1, Math.ceil(usuariosFiltrados.length / paginaTabla));
  const paginasProductos = Math.max(1, Math.ceil(productosFiltrados.length / paginaTabla));
  const paginasServicios = Math.max(1, Math.ceil(serviciosFiltrados.length / paginaTabla));
  const usuariosVisibles = usuariosFiltrados.slice((paginaUsuarios - 1) * paginaTabla, paginaUsuarios * paginaTabla);
  const productosVisibles = productosFiltrados.slice((paginaProductos - 1) * paginaTabla, paginaProductos * paginaTabla);
  const serviciosVisibles = serviciosFiltrados.slice((paginaServicios - 1) * paginaTabla, paginaServicios * paginaTabla);
  const ventasReporteFiltradas = (reporteVentas?.ventas || []).filter((venta) => `${venta.id} ${venta.cliente_nombre} ${venta.cliente_correo} ${venta.responsable} ${venta.estado}`.toLowerCase().includes(busquedaReporte.toLowerCase()));
  const paginasReporte = Math.max(1, Math.ceil(ventasReporteFiltradas.length / paginaTabla));
  const ventasReporteVisibles = ventasReporteFiltradas.slice((paginaReporte - 1) * paginaTabla, paginaReporte * paginaTabla);

  return (
    <DashboardLayout
      menu={menu}
      activeKey={activeKey}
      onSelect={setActiveKey}
      usuario={usuarioGuardado}
      title={
        activeKey === "resumen"
          ? "Resumen general"
          : activeKey === "usuarios"
          ? "Gestión de usuarios"
          : activeKey === "productos"
          ? "Gestión de productos"
          : activeKey === "servicios"
          ? "Gestión de servicios"
          : activeKey === "soporte"
          ? "Bandeja de soporte"
          : "Reporte de ventas"
      }
    >
      {activeKey === "resumen" && (
        <div>
          {errorAnalitica && <p className="text-red-400 text-sm mb-4">{errorAnalitica}</p>}
          {!resumen ? <p className="text-gray-400">Cargando indicadores...</p> : <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kpis.map((k) => (
                <div key={k.label} className="bg-[#1a1a26] border border-white/5 rounded-xl p-5">
                  <p className="font-display text-3xl font-semibold text-white break-words">{k.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-5">
              <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5">
                <div className="flex items-baseline justify-between gap-3 mb-5">
                  <h2 className="text-base font-medium text-white">PQR por estado</h2>
                  <span className="text-xs text-gray-500">{resumen.atencion.total} en total</span>
                </div>
                <div className="h-60 flex items-end justify-around gap-5 border-b border-white/10 pb-1">
                  {pqrPorEstado.map((pqr) => (
                    <div key={pqr.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2">
                      <span className="text-sm text-white font-medium">{pqr.value}</span>
                      <div className={`w-full max-w-20 rounded-t ${pqr.color}`} style={{ height: `${Math.max((pqr.value / maxPqrEstado) * 100, pqr.value ? 5 : 1)}%` }} />
                      <span className="text-xs text-gray-500 text-center">{pqr.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5">
                <h2 className="text-base font-medium text-white mb-5">Tendencia de ingresos</h2>
                {ventasPorDia.length === 0 ? <p className="text-sm text-gray-500">Aún no hay ventas pagadas para graficar.</p> : <>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-48 overflow-visible">
                    <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,.15)" strokeWidth="1" />
                    <polyline points={puntosIngresos} fill="none" stroke="#4ea1ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    {ventasPorDia.map((dia, indice) => <circle key={dia.fecha} cx={ventasPorDia.length === 1 ? 50 : (indice / (ventasPorDia.length - 1)) * 100} cy={100 - (dia.total / maxIngresoDia) * 90} r="1.8" fill="#7c5cff" vectorEffect="non-scaling-stroke" />)}
                  </svg>
                  <div className="grid grid-cols-7 gap-1 mt-3 text-[11px] text-gray-500">{ventasPorDia.map((dia) => <span key={dia.fecha} className="text-center truncate" title={formatoCOP(dia.total)}>{dia.fecha}</span>)}</div>
                </>}
              </section>
            </div>
          </>}
        </div>
      )}

      {activeKey === "usuarios" && (
        <div className="nt-table-wrap">
          <TableControls search={filtroUsuarios} onSearchChange={(value) => { setFiltroUsuarios(value); setPaginaUsuarios(1); }} filterValue={filtroRol} onFilterChange={(value) => { setFiltroRol(value); setPaginaUsuarios(1); }} filterOptions={[{ value: "1", label: "Administradores" }, { value: "2", label: "Empleados" }, { value: "3", label: "Clientes" }]} page={paginaUsuarios} totalPages={paginasUsuarios} totalItems={usuariosFiltrados.length} pageSize={paginaTabla} onPrevious={() => setPaginaUsuarios((page) => Math.max(1, page - 1))} onNext={() => setPaginaUsuarios((page) => Math.min(paginasUsuarios, page + 1))} placeholder="Buscar usuario..." />
          {usuarios.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              Aún no hay usuarios registrados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nt-table text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-white/5">
                  <th className="p-4 font-medium">Nombre</th>
                  <th className="p-4 font-medium">Correo</th>
                  <th className="p-4 font-medium">Teléfono</th>
                  <th className="p-4 font-medium">Rol</th>
                  <th className="p-4 font-medium">Estado</th>
                  <th className="p-4 font-medium">Acciones</th>
                </tr>
              </thead>
            <tbody>
              {usuariosVisibles.map((u) => (
                <tr
                 key={u.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="p-4 text-white font-medium whitespace-nowrap">{u.nombre} {u.apellido}</td>
                  <td className="p-4 text-gray-300 whitespace-nowrap">{u.correo}</td>
                  <td className="p-4 text-gray-300">{u.telefono || "—"}</td>
                  <td className="p-4">
                    <select value={u.rol_id} onChange={(e) => cambiarRol(u.id, e.target.value)} className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs text-white cursor-pointer">
                      <option value="1" className="bg-[#1a1a26]">Admin</option>
                      <option value="2" className="bg-[#1a1a26]">Empleado</option>
                      <option value="3" className="bg-[#1a1a26]">Cliente</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        u.estado === "activo"
                          ? "bg-[#4ea1ff]/10 text-[#4ea1ff]"
                          : "bg-white/5 text-gray-500"
                      }`}
                   >
                      {u.estado}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEdicion(u)} className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white cursor-pointer">
                        Editar
                      </button>
                      <button onClick={() => cambiarEstado(u.id, u.estado)} className="px-3 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-white cursor-pointer">
                        {u.estado === "activo" ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => eliminarUsuario(u.id)} className="px-3 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 cursor-pointer">
                       Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )}

      {activeKey === "productos" && (
        <div className="nt-table-wrap">
          <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Productos tecnológicos</h2>
              <p className="mt-1 text-sm text-gray-500">Administra los productos que NexoTech ofrece a sus clientes.</p>
            </div>
            <button onClick={abrirCreacionProducto} className="rounded-lg bg-[#4ea1ff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3a8fee]">+ Nuevo producto</button>
          </div>

          <TableControls search={filtroProductos} onSearchChange={(value) => { setFiltroProductos(value); setPaginaProductos(1); }} page={paginaProductos} totalPages={paginasProductos} totalItems={productosFiltrados.length} pageSize={paginaTabla} onPrevious={() => setPaginaProductos((page) => Math.max(1, page - 1))} onNext={() => setPaginaProductos((page) => Math.min(paginasProductos, page + 1))} placeholder="Buscar producto..." />

          {cargandoProductos ? (
            <p className="text-white p-6">Cargando productos...</p>
          ) : errorProductos ? (
            <p className="text-red-400 p-6">{errorProductos}</p>
          ) : productos.length === 0 ? (
            <div className="p-10 text-center text-gray-500 text-sm">
              Aún no hay productos registrados. Crea el primero con el botón de arriba.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nt-table text-sm min-w-[900px]">
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
                  <tr
                    key={p.id}
                    className="border-b border-white/5 last:border-0 transition-colors hover:bg-[#4ea1ff]/[0.04]"
                  >
                    <td className="p-4 font-medium text-white"><div className="flex min-w-64 items-center gap-3"><ProductoImagen src={p.imagen_url} nombre={p.nombre} className="h-14 w-14 rounded-xl border border-white/10 bg-[#101827] text-base" /><span className="max-w-64 whitespace-normal font-medium leading-5">{p.nombre}</span></div></td>
                    <td className="max-w-[18rem] p-4 text-gray-400"><span className="line-clamp-2">{p.descripcion || "Sin descripción"}</span></td>
                    <td className="p-4 font-semibold text-white">{formatoCOP(p.precio)}</td>
                    <td className="p-4">
                      <span className={`inline-flex min-w-16 justify-center rounded-full border px-2.5 py-1 text-xs font-medium ${p.stock <= 3 ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-300" : "border-white/10 bg-white/5 text-gray-300"}`}>
                        {p.stock} unidades
                      </span>
                    </td>
                  <td className="p-4">
                    <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                        p.estado === "activo"
                        ? "border-[#4ea1ff]/30 bg-[#4ea1ff]/10 text-[#78b9ff]"
                        : "border-white/10 bg-white/5 text-gray-500"
                    }`}
                  >
                    {p.estado}
                  </span>
                  </td>
                  <td className="p-4">
                    <div className="grid min-w-[190px] grid-cols-2 gap-2">
                      <button title="Editar producto" aria-label="Editar producto" onClick={() => abrirEdicionProducto(p)} className="flex min-h-9 items-center justify-center rounded-md border border-[#4ea1ff]/25 bg-[#4ea1ff]/10 px-3 text-[#9bcaff] transition hover:bg-[#4ea1ff]/20 cursor-pointer">
                        <span className="h-4 w-4">{IconEdit}</span>
                      </button>
                      <button title={p.estado === "activo" ? "Desactivar producto" : "Activar producto"} aria-label={p.estado === "activo" ? "Desactivar producto" : "Activar producto"} onClick={() => cambiarEstadoProducto(p.id, p.estado)} className="flex min-h-9 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-3 text-amber-200 transition hover:bg-amber-300/20 cursor-pointer">
                        <span className="h-4 w-4">{IconPower}</span>
                      </button>
                      <button title="Eliminar producto" aria-label="Eliminar producto" onClick={() => eliminarProducto(p.id)} className="col-span-2 flex min-h-9 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 px-3 text-red-300 transition hover:bg-red-400/20 cursor-pointer">
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

        </div>
      )}

      {activeKey === "servicios" && (
        <div className="nt-table-wrap">
          <div className="flex flex-col gap-3 border-b border-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">Servicios tecnológicos</h2>
              <p className="mt-1 text-sm text-gray-500">Administra las soluciones que NexoTech ofrece a sus clientes.</p>
            </div>
            <button onClick={abrirCreacionServicio} className="rounded-lg bg-[#4ea1ff] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#3a8fee]">+ Nuevo servicio</button>
          </div>
          <TableControls search={filtroServicios} onSearchChange={(value) => { setFiltroServicios(value); setPaginaServicios(1); }} page={paginaServicios} totalPages={paginasServicios} totalItems={serviciosFiltrados.length} pageSize={paginaTabla} onPrevious={() => setPaginaServicios((page) => Math.max(1, page - 1))} onNext={() => setPaginaServicios((page) => Math.min(paginasServicios, page + 1))} placeholder="Buscar servicio..." />
          {cargandoProductos ? <p className="p-6 text-white">Cargando servicios...</p> : errorProductos ? <p className="p-6 text-red-400">{errorProductos}</p> : servicios.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">Aún no hay servicios registrados. Crea la primera solución.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nt-table min-w-[900px] text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-white/5"><th className="p-4 font-medium">Nombre</th><th className="p-4 font-medium">Descripción</th><th className="p-4 font-medium">Precio</th><th className="p-4 font-medium">Estado</th><th className="p-4 font-medium">Acciones</th></tr></thead>
                <tbody>{serviciosVisibles.map((servicio) => (
                  <tr key={servicio.id} className="border-b border-white/5 last:border-0 transition-colors hover:bg-[#4ea1ff]/[0.04]">
                    <td className="p-4 font-medium text-white"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7c5cff]/10 text-sm font-semibold text-[#b6a5ff]">{servicio.nombre.slice(0, 1).toUpperCase()}</span><span>{servicio.nombre}</span></div></td>
                    <td className="max-w-[18rem] p-4 text-gray-400"><span className="line-clamp-2">{servicio.descripcion || "Sin descripción"}</span></td>
                    <td className="p-4 font-semibold text-white">{formatoCOP(servicio.precio)}</td>
                    <td className="p-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${servicio.estado === "activo" ? "border-[#4ea1ff]/30 bg-[#4ea1ff]/10 text-[#78b9ff]" : "border-white/10 bg-white/5 text-gray-500"}`}>{servicio.estado}</span></td>
                    <td className="p-4"><div className="grid min-w-[190px] grid-cols-2 gap-2"><button title="Editar servicio" aria-label="Editar servicio" onClick={() => abrirEdicionServicio(servicio)} className="flex min-h-9 items-center justify-center rounded-md border border-[#7c5cff]/25 bg-[#7c5cff]/10 px-3 text-[#c2b5ff] transition hover:bg-[#7c5cff]/20 cursor-pointer"><span className="h-4 w-4">{IconEdit}</span></button><button title={servicio.estado === "activo" ? "Desactivar servicio" : "Activar servicio"} aria-label={servicio.estado === "activo" ? "Desactivar servicio" : "Activar servicio"} onClick={() => cambiarEstadoServicio(servicio.id, servicio.estado)} className="flex min-h-9 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-3 text-amber-200 transition hover:bg-amber-300/20 cursor-pointer"><span className="h-4 w-4">{IconPower}</span></button><button title="Eliminar servicio" aria-label="Eliminar servicio" onClick={() => eliminarServicio(servicio.id)} className="col-span-2 flex min-h-9 items-center justify-center rounded-md border border-red-400/20 bg-red-400/10 px-3 text-red-300 transition hover:bg-red-400/20 cursor-pointer"><span className="h-4 w-4">{IconTrash}</span></button></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeKey === "soporte" && <SupportInbox token={token} />}

      {activeKey === "reportes" && (
        <div className="space-y-5">
          {errorAnalitica && <p className="text-red-400 text-sm">{errorAnalitica}</p>}
          {!reporteVentas ? <p className="text-gray-400">Cargando reporte...</p> : <>
            <div className="flex flex-wrap items-end gap-3 bg-[#1a1a26] border border-white/5 rounded-xl p-4">
              <label className="text-xs text-gray-400">Desde<input type="date" value={filtrosReporte.fecha_desde} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, fecha_desde: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white" /></label>
              <label className="text-xs text-gray-400">Hasta<input type="date" value={filtrosReporte.fecha_hasta} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, fecha_hasta: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white" /></label>
              <label className="text-xs text-gray-400">Estado<select value={filtrosReporte.estado} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, estado: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white"><option value="" className="bg-[#1a1a26]">Todos</option><option value="pendiente" className="bg-[#1a1a26]">Pendiente</option><option value="pagada" className="bg-[#1a1a26]">Pagada</option><option value="cancelada" className="bg-[#1a1a26]">Cancelada</option><option value="completada" className="bg-[#1a1a26]">Completada</option></select></label>
              <label className="text-xs text-gray-400">Cliente<select value={filtrosReporte.cliente_id} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, cliente_id: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white"><option value="" className="bg-[#1a1a26]">Todos</option>{usuarios.filter((usuario) => usuario.rol_id === 3).map((cliente) => <option key={cliente.id} value={cliente.id} className="bg-[#1a1a26]">{cliente.nombre} {cliente.apellido}</option>)}</select></label>
              <label className="text-xs text-gray-400">Producto<select value={filtrosReporte.producto_id} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, producto_id: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white"><option value="" className="bg-[#1a1a26]">Todos</option>{productos.map((producto) => <option key={producto.id} value={producto.id} className="bg-[#1a1a26]">{producto.nombre}</option>)}</select></label>
              <label className="text-xs text-gray-400">Servicio<select value={filtrosReporte.servicio_id} onChange={(e) => setFiltrosReporte({ ...filtrosReporte, servicio_id: e.target.value })} className="block mt-1 p-2 rounded-lg bg-white/5 border border-white/10 text-white"><option value="" className="bg-[#1a1a26]">Todos</option>{servicios.map((servicio) => <option key={servicio.id} value={servicio.id} className="bg-[#1a1a26]">{servicio.nombre}</option>)}</select></label>
              <button onClick={filtrarReporte} className="px-4 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] text-sm text-white cursor-pointer">Filtrar</button>
              <button onClick={() => descargarReporte("pdf")} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white cursor-pointer">Descargar PDF</button>
              <button onClick={() => descargarReporte("excel")} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-sm text-white cursor-pointer">Descargar Excel</button>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <div className="bg-[#1a1a26] border border-white/5 rounded-xl p-5"><p className="font-display text-3xl font-semibold text-white">{reporteVentas.total_registros}</p><p className="text-sm text-gray-500 mt-1">Ventas registradas</p></div>
              <div className="bg-[#1a1a26] border border-white/5 rounded-xl p-5"><p className="font-display text-3xl font-semibold text-white">{formatoCOP(reporteVentas.total_pagado)}</p><p className="text-sm text-gray-500 mt-1">Total pagado</p></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5"><div className="flex items-baseline justify-between gap-3 mb-5"><h2 className="text-sm font-medium text-white">Ingresos pagados acumulados</h2><span className="text-xs text-[#78b9ff]">{formatoCOP(reporteVentas.total_pagado)}</span></div>{ventasPorDia.length === 0 ? <p className="text-sm text-gray-500">No hay ventas pagadas para graficar.</p> : <div className="h-52 flex items-end gap-3">{ventasPorDia.map((dia) => <div key={dia.fecha} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><span className="text-[11px] text-gray-400">{formatoCOP(dia.acumulado)}</span><div className="w-full max-w-10 rounded-t bg-[#4ea1ff]" style={{ height: `${Math.max((dia.acumulado / maxIngresoDia) * 100, 2)}%` }} /><span className="text-[11px] text-gray-500 whitespace-nowrap">{dia.fecha}</span></div>)}</div>}</section>
              <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5"><div className="flex items-baseline justify-between gap-3 mb-5"><h2 className="text-sm font-medium text-white">Tendencia de ingresos</h2><span className="text-xs text-[#78b9ff]">Acumulado: {formatoCOP(reporteVentas.total_pagado)}</span></div>{ventasPorDia.length === 0 ? <p className="text-sm text-gray-500">No hay ventas pagadas para graficar.</p> : <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-52 overflow-visible"><line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,.15)" strokeWidth="1" /><polyline points={puntosIngresos} fill="none" stroke="#4ea1ff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{ventasPorDia.map((dia, indice) => <circle key={dia.fecha} cx={ventasPorDia.length === 1 ? 50 : (indice / (ventasPorDia.length - 1)) * 100} cy={100 - (dia.acumulado / maxIngresoDia) * 90} r="1.8" fill="#7c5cff" vectorEffect="non-scaling-stroke" />)}</svg>}</section>
            </div>
            <div className="nt-table-wrap">
              <TableControls search={busquedaReporte} onSearchChange={(value) => { setBusquedaReporte(value); setPaginaReporte(1); }} page={paginaReporte} totalPages={paginasReporte} totalItems={ventasReporteFiltradas.length} pageSize={paginaTabla} onPrevious={() => setPaginaReporte((page) => Math.max(1, page - 1))} onNext={() => setPaginaReporte((page) => Math.min(paginasReporte, page + 1))} placeholder="Buscar venta, cliente o responsable..." />
              <table className="nt-table text-sm min-w-[1050px]"><thead><tr><th>Venta</th><th>Cliente</th><th>Ítems</th><th>Responsable</th><th>Fecha</th><th>Estado</th><th>Subtotal</th><th>IVA</th><th>Total</th></tr></thead><tbody>
                {ventasReporteVisibles.length === 0 ? <tr><td colSpan="9" className="p-8 text-center text-gray-500">No hay ventas que coincidan.</td></tr> : ventasReporteVisibles.map((venta) => <tr key={venta.id} className="border-b border-white/5 last:border-0"><td className="p-4 text-white">#{venta.id}</td><td className="p-4 text-gray-300"><span className="block">{venta.cliente_nombre}</span><span className="text-xs text-gray-500">{venta.cliente_correo}</span></td><td className="p-4 text-gray-300">{venta.items?.join(", ") || "—"}</td><td className="p-4 text-gray-300">{venta.responsable}</td><td className="p-4 text-gray-300">{venta.fecha ? new Date(venta.fecha).toLocaleDateString("es-CO") : "—"}</td><td className="p-4 capitalize text-[#4ea1ff]">{venta.estado}</td><td className="p-4 text-white">{formatoCOP(venta.subtotal)}</td><td className="p-4 text-white">{formatoCOP(venta.impuestos)}</td><td className="p-4 text-white">{formatoCOP(venta.total)}</td></tr>)}
              </tbody></table>
            </div>
          </>}
        </div>
      )}

      {editando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a26] p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-5">Editar usuario</h2>

            {["nombre", "apellido", "correo", "telefono"].map((campo) => (
              <div key={campo} className="mb-3">
                <label className="block text-sm text-gray-400 mb-1 capitalize">{campo}</label>
                <input
                  type={campo === "correo" ? "email" : "text"}
                  value={formEdit[campo]}
                  onChange={(e) => setFormEdit({ ...formEdit, [campo]: e.target.value })}
                  className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]"
                />
              </div>
            ))}

            <div className="flex gap-3 mt-5">
              <button onClick={() => guardarEdicion(editando)} className="flex-1 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] text-white font-medium cursor-pointer">
                Guardar
              </button>
              <button onClick={cerrarEdicion} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {(editandoProducto || creandoProducto) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1a26] p-6">
            <h2 className="font-display text-xl font-semibold text-white mb-5">
              {creandoProducto ? "Nuevo producto" : "Editar producto"}
            </h2>

            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                <input
                type="text"
                  required
                value={formProducto.nombre}
                onChange={(e) => setFormProducto({ ...formProducto, nombre: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea
                  required
                value={formProducto.descripcion}
                onChange={(e) => setFormProducto({ ...formProducto, descripcion: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="producto-imagen" className="mb-2 block text-sm text-gray-400">Foto del producto</label>
              <ProductoImagen
                src={archivoImagenProducto ? vistaPreviaImagenProducto : quitarImagenProducto ? "" : imagenActualProducto}
                nombre={formProducto.nombre}
                className="mb-3 h-28 w-28 rounded-xl text-2xl"
              />
              <div className="flex min-w-0 items-center gap-3">
                <input
                  id="producto-imagen"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={seleccionarImagenProducto}
                  className="sr-only"
                />
                <label htmlFor="producto-imagen" className="shrink-0 cursor-pointer rounded-md border border-[#4ea1ff]/25 bg-[#4ea1ff]/10 px-3 py-2 text-sm font-medium text-[#9bcaff] transition hover:bg-[#4ea1ff]/20">
                  Seleccionar foto
                </label>
                <span title={archivoImagenProducto?.name || ""} className="min-w-0 truncate text-sm text-gray-400">
                  {archivoImagenProducto?.name || (imagenActualProducto && !quitarImagenProducto ? "Foto guardada" : "Ningún archivo seleccionado")}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">JPG, PNG o WebP. Máximo 5 MB.</p>
              {imagenActualProducto && !quitarImagenProducto && !archivoImagenProducto && (
                <button type="button" onClick={() => setQuitarImagenProducto(true)} className="mt-2 text-sm text-red-300 hover:text-red-200">Quitar foto actual</button>
              )}
              {quitarImagenProducto && (
                <button type="button" onClick={() => setQuitarImagenProducto(false)} className="mt-2 text-sm text-[#9bcaff] hover:text-white">Conservar foto actual</button>
              )}
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-400 mb-1">Precio</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 50.000"
                  required
                value={formProducto.precio}
                onChange={(e) => setFormProducto({ ...formProducto, precio: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]"
              />
            </div>

            <div className="mb-5">
              <label className="block text-sm text-gray-400 mb-1">Stock</label>
              <input
                type="number"
                value={formProducto.stock}
                onChange={(e) => setFormProducto({ ...formProducto, stock: e.target.value })}
                className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={guardarProducto} disabled={guardandoImagenProducto} className="flex-1 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] text-white font-medium cursor-pointer disabled:cursor-wait disabled:opacity-60">
                {guardandoImagenProducto ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={cerrarModalProducto} className="flex-1 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      {(editandoServicio || creandoServicio) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-4 backdrop-blur-sm sm:items-center">
          <div className="my-4 max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-[#202231] p-6 shadow-2xl shadow-black/50">
            <h2 className="mb-5 font-display text-xl font-semibold text-white">{creandoServicio ? "Nuevo servicio" : "Editar servicio"}</h2>
            <label className="mb-1 block text-sm text-gray-400">Nombre</label>
            <input value={formServicio.nombre} onChange={(e) => setFormServicio({ ...formServicio, nombre: e.target.value })} minLength="2" maxLength="100" required className="mb-3 w-full rounded-lg border border-white/15 bg-[#151724] p-2.5 text-white outline-none placeholder:text-gray-600 focus:border-[#4ea1ff]" />
            <label className="mb-1 block text-sm text-gray-400">Descripción</label>
            <textarea value={formServicio.descripcion} onChange={(e) => setFormServicio({ ...formServicio, descripcion: e.target.value })} maxLength="500" className="mb-3 w-full rounded-lg border border-white/15 bg-[#151724] p-2.5 text-white outline-none placeholder:text-gray-600 focus:border-[#4ea1ff]" rows="4" />
            <label className="mb-1 block text-sm text-gray-400">Precio en pesos colombianos</label>
            <input type="text" inputMode="numeric" placeholder="Ej. 50.000" required value={formServicio.precio} onChange={(e) => setFormServicio({ ...formServicio, precio: e.target.value })} className="mb-5 w-full rounded-lg border border-white/15 bg-[#151724] p-2.5 text-white outline-none focus:border-[#4ea1ff]" />
            <div className="flex gap-3"><button onClick={guardarServicio} className="flex-1 rounded-lg bg-[#4ea1ff] py-2 font-medium text-white hover:bg-[#3a8fee]">Guardar</button><button onClick={cerrarModalServicio} className="flex-1 rounded-lg bg-white/10 py-2 text-white hover:bg-white/20">Cancelar</button></div>
          </div>
        </div>
      )}
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

export default Admin;
