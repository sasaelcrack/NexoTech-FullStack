import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, authHeaders, getStoredSession } from "../config";
import DashboardLayout from "../components/DashboardLayout";
import ProductoImagen from "../components/ProductoImagen";
import TableControls from "../components/TableControls";
import { IconBox, IconWrench, IconCart, IconReceipt, IconUser, IconMessage } from "../components/icons";

const menu = [
  { key: "productos", label: "Productos", icon: IconBox },
  { key: "servicios", label: "Servicios", icon: IconWrench },
  { key: "carrito", label: "Carrito", icon: IconCart },
  { key: "pedidos", label: "Mis pedidos", icon: IconReceipt },
  { key: "facturas", label: "Mis facturas", icon: IconReceipt },
  { key: "pagos", label: "Mis pagos", icon: IconReceipt },
  { key: "soporte", label: "Soporte", icon: IconMessage },
  { key: "perfil", label: "Perfil", icon: IconUser },
];

const estadoColor = {
  pendiente: "bg-yellow-500/10 text-yellow-400",
  pagada: "bg-emerald-400/10 text-emerald-300",
  pagado: "bg-emerald-400/10 text-emerald-300",
  completada: "bg-emerald-400/10 text-emerald-300",
  fallido: "bg-red-500/10 text-red-400",
  cancelada: "bg-red-400/10 text-red-300",
  cancelado: "bg-white/5 text-gray-500",
};

const estadoLabel = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  pagado: "Pagado",
  completada: "Completada",
  fallido: "Fallido",
  cancelada: "Cancelada",
  cancelado: "Cancelado",
  emitida: "Emitida",
  abierta: "Abierta",
  respondida: "Respondida",
  cerrada: "Cerrada",
};

const tiposItemPermitidos = new Set(["producto", "servicio"]);
const PEDIDOS_POR_PAGINA = 5;

function formatoCOP(valor) {
  return Number(valor).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatoFecha(valor) {
  return valor ? new Date(valor).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";
}

function Cliente() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const usuarioGuardado = getStoredSession();

  const [activeKey, setActiveKey] = useState("productos");

  const [productos, setProductos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [catalogoServicios, setCatalogoServicios] = useState([]);
  const [perfil, setPerfil] = useState(null);
  const [formPerfil, setFormPerfil] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [paginaPedidos, setPaginaPedidos] = useState(1);
  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [filtroFacturas, setFiltroFacturas] = useState("");
  const [filtroPagos, setFiltroPagos] = useState("");
  const [paginaFacturas, setPaginaFacturas] = useState(1);
  const [paginaPagos, setPaginaPagos] = useState(1);
  const [pqrs, setPqrs] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [formPqr, setFormPqr] = useState({ asunto: "", descripcion: "" });
  const [nuevoMensaje, setNuevoMensaje] = useState("");

  const [carrito, setCarrito] = useState([]); // { tipo_item, id, nombre, precio, cantidad, stock }

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [mensajePerfil, setMensajePerfil] = useState("");
  const [procesandoCompra, setProcesandoCompra] = useState(false);
  const [mensajeCompra, setMensajeCompra] = useState("");
  const [resultadoPago, setResultadoPago] = useState("");
  const [mensajeSoporte, setMensajeSoporte] = useState("");
  const [guardandoSoporte, setGuardandoSoporte] = useState(false);
  const retornoProcesado = useRef(false);

  useEffect(() => {
    if (!token || !usuarioGuardado || usuarioGuardado.rol_id !== 3) {
      navigate("/login");
      return;
    }
    cargarTodo();
    // La carga inicial usa la sesión capturada al montar el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search);
    const resultado = parametros.get("payment");
    const paymentId = parametros.get("payment_id");
    if (retornoProcesado.current || !resultado) return;
    retornoProcesado.current = true;
    setActiveKey("pedidos");
    window.history.replaceState({}, "", window.location.pathname);

    if (resultado === "cancelled") {
      setResultadoPago("El pago no se completó. La compra permanece como pendiente en el historial.");
      return;
    }
    if (resultado !== "success" || !paymentId) {
      setResultadoPago("No se pudo identificar el pago al regresar de Stripe.");
      return;
    }

    const sincronizar = async () => {
      try {
        const res = await fetch(`${API_URL}/v1/payments/${paymentId}/sync`, {
          method: "POST",
          headers: authHeaders(token),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "No se pudo consultar el estado del pago");
        const mensajes = {
          APPROVED: "Pago aprobado. Tu factura fue generada correctamente.",
          PENDING: "Stripe recibió el pago; estamos esperando su confirmación final.",
          DECLINED: "El pago fue rechazado por Stripe.",
          EXPIRED: "La sesión de pago expiró.",
        };
        setResultadoPago(mensajes[data.status] || `Estado actual del pago: ${data.status}.`);
        cargarTodo();
      } catch (err) {
        setResultadoPago(err.message);
      }
    };
    sincronizar();
    // Se procesa exclusivamente el retorno desde Stripe de esta sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTodo = async () => {
    setCargando(true);
    setError("");
    try {
      const [resProd, resServ, resPerfil, resPedidos, resFacturas, resPagos, resPqrs, resConversaciones] = await Promise.all([
        fetch(`${API_URL}/productos/`),
        fetch(`${API_URL}/servicios/`),
        fetch(`${API_URL}/usuarios/me`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/ventas/mias`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/facturas/mias`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/v1/payments/mine`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/pqr/mias`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/conversaciones/mias`, { headers: authHeaders(token) }),
      ]);
      const [dataProd, dataServ, dataPerfil, dataPedidos, dataFacturas, dataPagos, dataPqrs, dataConversaciones] = await Promise.all([
        resProd.json(),
        resServ.json(),
        resPerfil.json(),
        resPedidos.json(),
        resFacturas.json(),
        resPagos.json(),
        resPqrs.json(),
        resConversaciones.json(),
      ]);
      if (!resProd.ok) throw new Error(dataProd.detail || "Error al cargar productos");
      if (!resServ.ok) throw new Error(dataServ.detail || "Error al cargar servicios");
      if (!resPerfil.ok) throw new Error(dataPerfil.detail || "Error al cargar perfil");
      if (!resPedidos.ok) throw new Error(dataPedidos.detail || "Error al cargar pedidos");
      if (!resFacturas.ok) throw new Error(dataFacturas.detail || "Error al cargar facturas");
      if (!resPagos.ok) throw new Error(dataPagos.detail || "Error al cargar pagos");
      if (!resPqrs.ok) throw new Error(dataPqrs.detail || "Error al cargar tus PQR");
      if (!resConversaciones.ok) throw new Error(dataConversaciones.detail || "Error al cargar tus conversaciones");

      setCatalogoProductos(dataProd);
      setCatalogoServicios(dataServ);
      setProductos(dataProd.filter((p) => p.estado === "activo"));
      setServicios(dataServ.filter((s) => s.estado === "activo"));
      setPerfil(dataPerfil);
      setFormPerfil(dataPerfil);
      setPedidos(dataPedidos);
      setPaginaPedidos(1);
      setFacturas(dataFacturas);
      setPagos(dataPagos);
      setPqrs(dataPqrs);
      setConversaciones(dataConversaciones);
      setConversacionActiva(dataConversaciones[0] || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const crearPqr = async (e) => {
    e.preventDefault();
    setGuardandoSoporte(true);
    setMensajeSoporte("");
    try {
      const res = await fetch(`${API_URL}/pqr/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(formPqr),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo crear la PQR");
      setPqrs((prev) => [data, ...prev]);
      setFormPqr({ asunto: "", descripcion: "" });
      setMensajeSoporte("Tu solicitud fue enviada correctamente.");
    } catch (err) {
      setMensajeSoporte(err.message);
    } finally {
      setGuardandoSoporte(false);
    }
  };

  const iniciarConversacion = async () => {
    const mensaje = nuevoMensaje.trim();
    if (!mensaje) return;
    setGuardandoSoporte(true);
    setMensajeSoporte("");
    try {
      const res = await fetch(`${API_URL}/conversaciones/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo iniciar la conversación");
      setConversaciones((prev) => [data, ...prev]);
      setConversacionActiva(data);
      setNuevoMensaje("");
      setMensajeSoporte("Conversación iniciada. Soporte te responderá por este medio.");
    } catch (err) {
      setMensajeSoporte(err.message);
    } finally {
      setGuardandoSoporte(false);
    }
  };

  const enviarMensaje = async () => {
    const mensaje = nuevoMensaje.trim();
    if (!mensaje || !conversacionActiva) return;
    setGuardandoSoporte(true);
    setMensajeSoporte("");
    try {
      const res = await fetch(`${API_URL}/conversaciones/${conversacionActiva.id}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ mensaje }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo enviar el mensaje");
      const actualizada = { ...conversacionActiva, mensajes: [...conversacionActiva.mensajes, data] };
      setConversacionActiva(actualizada);
      setConversaciones((prev) => prev.map((conversacion) => conversacion.id === actualizada.id ? actualizada : conversacion));
      setNuevoMensaje("");
    } catch (err) {
      setMensajeSoporte(err.message);
    } finally {
      setGuardandoSoporte(false);
    }
  };

  const agregarAlCarrito = (item, tipo_item) => {
    if (!tiposItemPermitidos.has(tipo_item)) return;
    setMensajeCompra("");
    setCarrito((prev) => {
      const existente = prev.find((c) => c.tipo_item === tipo_item && c.id === item.id);
      if (existente) {
        const nuevaCantidad = existente.cantidad + 1;
        if (tipo_item === "producto" && item.stock !== null && nuevaCantidad > item.stock) return prev;
        return prev.map((c) =>
          c.tipo_item === tipo_item && c.id === item.id ? { ...c, cantidad: nuevaCantidad } : c
        );
      }
      return [
        ...prev,
        {
          tipo_item,
          id: item.id,
          nombre: item.nombre,
          precio: Number(item.precio),
          cantidad: 1,
          stock: tipo_item === "producto" ? item.stock : null,
        },
      ];
    });
  };

  const cambiarCantidad = (tipo_item, id, delta) => {
    setCarrito((prev) =>
      prev
        .map((c) => {
          if (c.tipo_item !== tipo_item || c.id !== id) return c;
          const nueva = c.cantidad + delta;
          if (c.stock !== null && nueva > c.stock) return c;
          return { ...c, cantidad: nueva };
        })
        .filter((c) => c.cantidad > 0)
    );
  };

  const quitarDelCarrito = (tipo_item, id) => {
    setCarrito((prev) => prev.filter((c) => !(c.tipo_item === tipo_item && c.id === id)));
  };

  const cancelarCompraEnCarrito = () => {
    setCarrito([]);
    setMensajeCompra("Compra cancelada. No se creó ningún pedido ni pago.");
  };

  const nombreDetalle = (detalle) => {
    const catalogo = detalle.producto_id ? catalogoProductos : catalogoServicios;
    const item = catalogo.find((articulo) => articulo.id === (detalle.producto_id || detalle.servicio_id));
    return item?.nombre || detalle.nombre_item || "Artículo no disponible";
  };

  const totalCarrito = carrito.reduce((acc, c) => acc + c.precio * c.cantidad, 0);
  const cantidadEnCarrito = (tipo_item, id) => carrito.find((c) => c.tipo_item === tipo_item && c.id === id)?.cantidad || 0;

  const confirmarCompra = async () => {
    if (carrito.length === 0) return;
    setProcesandoCompra(true);
    setMensajeCompra("");
    try {
      const items = carrito.map((item) => {
        const id = Number(item.id);
        const tipoItem = tiposItemPermitidos.has(item.tipo_item)
          ? item.tipo_item
          : productos.some((producto) => producto.id === id)
          ? "producto"
          : servicios.some((servicio) => servicio.id === id)
          ? "servicio"
          : item.tipo_item;

        return {
          tipo_item: tipoItem,
          id,
          cantidad: Number(item.cantidad),
        };
      });
      const itemInvalido = items.find(
        (item) => !tiposItemPermitidos.has(item.tipo_item) || !Number.isInteger(item.id) || item.id < 1
      );
      if (itemInvalido) {
        setCarrito([]);
        throw new Error("Se descartó un artículo inválido del carrito. Vuelve a agregarlo.");
      }

      const res = await fetch(`${API_URL}/ventas/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((error) => error.msg).join(" ")
          : data.detail;
        throw new Error(detail || "No se pudo completar la compra");
      }

      const pagoRes = await fetch(`${API_URL}/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          ...authHeaders(token),
        },
        body: JSON.stringify({ venta_id: data.id }),
      });
      const pago = await pagoRes.json();
      if (!pagoRes.ok || !pago.checkout_url) {
        throw new Error(pago.detail || "No se pudo iniciar el pago con Stripe");
      }
      setCarrito([]);
      window.location.assign(pago.checkout_url);
    } catch (err) {
      setMensajeCompra(err.message);
    } finally {
      setProcesandoCompra(false);
    }
  };

  const descargarFactura = async (factura) => {
    try {
      const res = await fetch(`${API_URL}/facturas/${factura.id}/pdf`, { headers: authHeaders(token) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "No se pudo descargar la factura");
      }
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(await res.blob());
      enlace.download = `${factura.numero_factura}.pdf`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (err) {
      setResultadoPago(err.message);
    }
  };

  const guardarPerfil = async () => {
    setGuardandoPerfil(true);
    setMensajePerfil("");
    try {
      const { nombre, apellido, direccion, telefono } = formPerfil;
      const res = await fetch(`${API_URL}/usuarios/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          direccion: direccion?.trim() || null,
          telefono: telefono?.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = Array.isArray(data.detail)
          ? data.detail.map((error) => error.msg).join(" ")
          : data.detail;
        throw new Error(detail || "Error al actualizar perfil");
      }
      setPerfil(data);
      setMensajePerfil("Perfil actualizado correctamente.");
    } catch (err) {
      setMensajePerfil(err.message);
    } finally {
      setGuardandoPerfil(false);
    }
  };

  if (cargando) return <p className="text-white p-10">Cargando...</p>;
  if (error) return <p className="text-red-400 p-10">{error}</p>;

  const totalPaginasPedidos = Math.max(1, Math.ceil(pedidos.length / PEDIDOS_POR_PAGINA));
  const pedidosVisibles = pedidos.slice(
    (paginaPedidos - 1) * PEDIDOS_POR_PAGINA,
    paginaPedidos * PEDIDOS_POR_PAGINA,
  );
  const facturasFiltradas = facturas.filter((factura) => `${factura.numero_factura} ${factura.venta_id} ${factura.estado}`.toLowerCase().includes(filtroFacturas.toLowerCase()));
  const pagosFiltrados = pagos.filter((pago) => `${pago.reference} ${pago.venta_id} ${pago.provider} ${pago.status}`.toLowerCase().includes(filtroPagos.toLowerCase()));
  const elementosPorPagina = 6;
  const totalPaginasFacturas = Math.max(1, Math.ceil(facturasFiltradas.length / elementosPorPagina));
  const totalPaginasPagos = Math.max(1, Math.ceil(pagosFiltrados.length / elementosPorPagina));
  const facturasVisibles = facturasFiltradas.slice((paginaFacturas - 1) * elementosPorPagina, paginaFacturas * elementosPorPagina);
  const pagosVisibles = pagosFiltrados.slice((paginaPagos - 1) * elementosPorPagina, paginaPagos * elementosPorPagina);

  return (
    <DashboardLayout
      menu={menu}
      activeKey={activeKey}
      onSelect={setActiveKey}
      usuario={perfil}
      title={
        activeKey === "productos" ? "Productos disponibles" :
        activeKey === "servicios" ? "Servicios disponibles" :
        activeKey === "carrito" ? "Tu carrito" :
        activeKey === "pedidos" ? "Mis pedidos" :
        activeKey === "facturas" ? "Mis facturas" :
        activeKey === "pagos" ? "Mis pagos" :
        activeKey === "soporte" ? "Soporte y solicitudes" : "Mi perfil"
      }
    >
      {activeKey === "pedidos" && resultadoPago && (
        <p className="mb-4 rounded-lg border border-[#4ea1ff]/20 bg-[#4ea1ff]/10 px-4 py-3 text-sm text-[#8fc4ff]">{resultadoPago}</p>
      )}
      {activeKey === "productos" && (
        productos.length === 0 ? (
          <p className="text-gray-500 text-sm py-10 text-center">No hay productos disponibles.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {productos.map((p) => (
              <div key={p.id} className="nt-card group flex flex-col p-5 transition hover:-translate-y-1 hover:border-[#4ea1ff]/35">
                <ProductoImagen src={p.imagen_url} nombre={p.nombre} className="mb-4 aspect-[4/3] w-full rounded-xl text-4xl" />
                <h3 className="font-display font-semibold text-white">{p.nombre}</h3>
                <p className="text-gray-500 text-sm mt-1 mb-3 flex-1">{p.descripcion}</p>
                <p className="nt-tabular text-lg font-semibold text-[#8ac7ff]">{formatoCOP(p.precio)}</p>
                <p className={`mt-1 mb-4 text-xs ${p.stock !== null && p.stock <= 5 ? "text-amber-300" : "text-gray-500"}`}>{p.stock === null ? "Disponible" : `${p.stock} disponibles`}</p>
                <button
                  onClick={() => agregarAlCarrito(p, "producto")}
                  disabled={p.stock !== null && cantidadEnCarrito("producto", p.id) >= p.stock}
                  className="nt-button-primary w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  {cantidadEnCarrito("producto", p.id) > 0 ? `En el carrito (${cantidadEnCarrito("producto", p.id)})` : "Agregar al carrito"}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {activeKey === "servicios" && (
        servicios.length === 0 ? (
          <p className="text-gray-500 text-sm py-10 text-center">No hay servicios disponibles.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {servicios.map((s) => (
              <div key={s.id} className="nt-card group flex flex-col p-5 transition hover:-translate-y-1 hover:border-[#7c5cff]/40">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#9d8cff]/15 text-lg font-semibold text-[#b9adff]">✦</div>
                <h3 className="font-display font-semibold text-white">{s.nombre}</h3>
                <p className="text-gray-500 text-sm mt-1 mb-3 flex-1">{s.descripcion}</p>
                <p className="nt-tabular mb-4 text-lg font-semibold text-[#b9adff]">{formatoCOP(s.precio)}</p>
                <button
                  onClick={() => agregarAlCarrito(s, "servicio")}
                  className="nt-button-primary w-full rounded-lg py-2.5 text-sm font-medium text-white cursor-pointer"
                >
                  {cantidadEnCarrito("servicio", s.id) > 0 ? `En el carrito (${cantidadEnCarrito("servicio", s.id)})` : "Agregar al carrito"}
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {activeKey === "carrito" && (
        <div>
          {carrito.length === 0 ? (
            <p className="text-gray-500 text-sm py-10 text-center">Tu carrito está vacío.</p>
          ) : (
            <div className="nt-table-wrap">
              <div className="overflow-x-auto">
                <table className="nt-table text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-white/5">
                      <th className="p-4 font-medium">Ítem</th>
                      <th className="p-4 font-medium">Precio</th>
                      <th className="p-4 font-medium">Cantidad</th>
                      <th className="p-4 font-medium">Subtotal</th>
                      <th className="p-4 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrito.map((c) => (
                      <tr key={`${c.tipo_item}-${c.id}`} className="border-b border-white/5 last:border-0">
                        <td className="p-4 text-white">
                          {c.nombre}
                          <span className="text-xs text-gray-500 ml-2 capitalize">({c.tipo_item})</span>
                        </td>
                        <td className="p-4 text-gray-300">{formatoCOP(c.precio)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => cambiarCantidad(c.tipo_item, c.id, -1)} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white cursor-pointer">−</button>
                            <span className="text-white w-6 text-center">{c.cantidad}</span>
                            <button onClick={() => cambiarCantidad(c.tipo_item, c.id, 1)} disabled={c.stock !== null && c.cantidad >= c.stock} className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 text-white cursor-pointer">+</button>
                          </div>
                        </td>
                        <td className="p-4 text-[#4ea1ff] font-medium">{formatoCOP(c.precio * c.cantidad)}</td>
                        <td className="p-4">
                          <button onClick={() => quitarDelCarrito(c.tipo_item, c.id)} className="px-3 py-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 cursor-pointer">Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-t border-white/5">
                <p className="text-gray-400 text-sm">
                  Total: <span className="text-white font-display text-lg font-semibold">{formatoCOP(totalCarrito)}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button onClick={cancelarCompraEnCarrito} disabled={procesandoCompra} className="px-4 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-300 text-sm font-medium cursor-pointer">
                    Cancelar compra
                  </button>
                  <button onClick={confirmarCompra} disabled={procesandoCompra} className="px-5 py-2.5 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-white text-sm font-medium cursor-pointer">
                    {procesandoCompra ? "Procesando..." : "Confirmar compra"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {mensajeCompra && <p className="text-sm text-[#4ea1ff] mt-4">{mensajeCompra}</p>}
        </div>
      )}

      {activeKey === "pedidos" && (
        pedidos.length === 0 ? (
          <p className="text-gray-500 text-sm py-10 text-center">Aún no tienes pedidos.</p>
        ) : (
          <div className="space-y-4">
            {pedidosVisibles.map((ped) => (
              <div key={ped.id} className="bg-[#1a1a26] border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-white font-medium">Pedido #{ped.id}</p>
                    {ped.referencia_pago && <p className="text-xs text-gray-500">Referencia: {ped.referencia_pago}</p>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${estadoColor[ped.estado] || "bg-white/5 text-gray-400"}`}>
                    {estadoLabel[ped.estado] || ped.estado}
                  </span>
                </div>
                <ul className="text-sm text-gray-400 space-y-1 mb-3">
                  {ped.detalles.map((d) => (
                    <li key={d.id}>{d.cantidad}x {nombreDetalle(d)} — {formatoCOP(d.precio_unitario * d.cantidad)}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-3"><p className="nt-tabular font-medium text-[#8ac7ff]">{formatoCOP(ped.total)}</p></div>
              </div>
            ))}
            {totalPaginasPedidos > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-gray-500">
                  Mostrando {(paginaPedidos - 1) * PEDIDOS_POR_PAGINA + 1}-{Math.min(paginaPedidos * PEDIDOS_POR_PAGINA, pedidos.length)} de {pedidos.length} pedidos
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPaginaPedidos((pagina) => Math.max(1, pagina - 1))}
                    disabled={paginaPedidos === 1}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-gray-400">Página {paginaPedidos} de {totalPaginasPedidos}</span>
                  <button
                    type="button"
                    onClick={() => setPaginaPedidos((pagina) => Math.min(totalPaginasPedidos, pagina + 1))}
                    disabled={paginaPedidos === totalPaginasPedidos}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}

      {activeKey === "facturas" && (
        <section className="mt-8">
          {facturas.length === 0 ? <div className="nt-card p-10 text-center"><p className="text-sm text-gray-400">Todavía no tienes facturas emitidas.</p><p className="mt-2 text-xs text-gray-500">Tus facturas aparecerán aquí cuando se confirme un pago.</p></div> : <><TableControls search={filtroFacturas} onSearchChange={(value) => { setFiltroFacturas(value); setPaginaFacturas(1); }} page={paginaFacturas} totalPages={totalPaginasFacturas} totalItems={facturasFiltradas.length} pageSize={elementosPorPagina} onPrevious={() => setPaginaFacturas((page) => Math.max(1, page - 1))} onNext={() => setPaginaFacturas((page) => Math.min(totalPaginasFacturas, page + 1))} placeholder="Buscar factura..." /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {facturasVisibles.map((factura) => (
              <article key={factura.id} className="bg-[#1a1a26] border border-white/5 rounded-xl p-5">
                <div className="flex items-center justify-between gap-3"><p className="font-medium text-white">{factura.numero_factura}</p><span className="nt-badge border-emerald-400/40 text-emerald-300">{estadoLabel[factura.estado] || factura.estado}</span></div>
                <p className="text-xs text-gray-500 mt-1">Venta #{factura.venta_id} · {formatoFecha(factura.fecha)}</p>
                <p className="text-sm text-gray-400 mt-3">{factura.detalles.reduce((total, detalle) => total + detalle.cantidad, 0)} artículo(s)</p>
                <div className="mt-3 space-y-1 text-xs text-gray-400"><p>Subtotal: {formatoCOP(factura.subtotal)}</p><p>IVA (19%): {formatoCOP(factura.impuestos)}</p><p className="text-sm font-medium text-[#4ea1ff]">Total: {formatoCOP(factura.total)}</p></div>
                <div className="mt-3 flex items-center justify-end"><button onClick={() => descargarFactura(factura)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer">Descargar PDF</button></div>
              </article>
            ))}
          </div></>}
        </section>
      )}

      {activeKey === "pagos" && (
        <section className="mt-8">
          {pagos.length === 0 ? <div className="nt-card p-10 text-center"><p className="text-sm text-gray-400">Todavía no tienes pagos registrados.</p><p className="mt-2 text-xs text-gray-500">Cuando realices una compra, el estado del pago aparecerá aquí.</p></div> : <div className="nt-table-wrap"><TableControls search={filtroPagos} onSearchChange={(value) => { setFiltroPagos(value); setPaginaPagos(1); }} page={paginaPagos} totalPages={totalPaginasPagos} totalItems={pagosFiltrados.length} pageSize={elementosPorPagina} onPrevious={() => setPaginaPagos((page) => Math.max(1, page - 1))} onNext={() => setPaginaPagos((page) => Math.min(totalPaginasPagos, page + 1))} placeholder="Buscar pago..." />
            <table className="nt-table text-sm"><thead><tr><th>Referencia</th><th>Venta</th><th>Proveedor</th><th>Estado</th><th>Monto</th></tr></thead><tbody>
              {pagosVisibles.map((pago) => <tr key={pago.id}><td className="text-white font-medium">{pago.reference}</td><td className="text-gray-300">#{pago.venta_id}</td><td className="text-gray-300">{pago.provider === "stripe" ? "Stripe" : pago.provider || "No identificado"}</td><td><span className="nt-badge capitalize border-[#4ea1ff]/40 text-[#78b9ff]">{pago.status.toLowerCase()}</span></td><td className="text-white">{formatoCOP(pago.amount)}</td></tr>)}
            </tbody></table>
          </div>}
        </section>
      )}

      {activeKey === "soporte" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1d2032] to-[#171924] p-5 shadow-lg shadow-black/10">
            <h2 className="font-display text-lg font-semibold text-white">Crear una PQR</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Registra una petición, queja, reclamo o sugerencia.</p>
            <form onSubmit={crearPqr} className="space-y-3">
              <input value={formPqr.asunto} onChange={(e) => setFormPqr({ ...formPqr, asunto: e.target.value })} minLength="5" maxLength="150" required placeholder="Asunto" className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#4ea1ff]" />
              <textarea value={formPqr.descripcion} onChange={(e) => setFormPqr({ ...formPqr, descripcion: e.target.value })} minLength="10" maxLength="2000" required rows="4" placeholder="Cuéntanos qué ocurrió o qué necesitas" className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#4ea1ff] resize-y" />
              <button disabled={guardandoSoporte} className="px-4 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-white text-sm font-medium cursor-pointer">{guardandoSoporte ? "Enviando..." : "Enviar solicitud"}</button>
            </form>
            <div className="mt-6 border-t border-white/5 pt-4 space-y-3">
              <h3 className="text-sm font-medium text-white">Mis solicitudes</h3>
              {pqrs.length === 0 ? <p className="text-sm text-gray-500">Aún no has creado solicitudes.</p> : pqrs.map((pqr) => (
                <article key={pqr.id} className="rounded-xl border border-white/8 bg-[#10121d]/70 p-4 transition hover:border-[#4ea1ff]/30">
                  <div className="flex gap-3 justify-between"><p className="text-sm text-white font-medium">{pqr.asunto}</p><span className={`nt-badge capitalize ${pqr.estado === "cerrada" ? "border-gray-500/50 text-gray-400" : pqr.estado === "respondida" ? "border-[#7c5cff]/50 text-[#b5a8ff]" : "border-[#ffb86b]/50 text-[#ffca8f]"}`}>{pqr.estado}</span></div>
                  <p className="text-xs text-gray-500 mt-2">Creada el {formatoFecha(pqr.fecha_creacion)}</p>
                  {pqr.respuesta && <div className="mt-3 border-l-2 border-[#4ea1ff] bg-[#4ea1ff]/[.06] px-3 py-2 text-sm text-gray-300"><span className="block text-xs font-medium text-[#78b9ff] mb-1">Respuesta de soporte</span>{pqr.respuesta}</div>}
                </article>
              ))}
            </div>
          </section>

          <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5 flex flex-col min-h-[32rem]">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h2 className="font-display text-lg font-semibold text-white">Chat con soporte</h2><p className="text-sm text-gray-500">Puedes continuar una conversación o iniciar una nueva.</p></div>
              {conversaciones.length > 1 && <select value={conversacionActiva?.id || ""} onChange={(e) => setConversacionActiva(conversaciones.find((c) => c.id === Number(e.target.value)) || null)} className="max-w-36 bg-white/5 border border-white/10 text-sm text-white rounded-lg p-2"><option value="">Chat</option>{conversaciones.map((c) => <option key={c.id} value={c.id} className="bg-[#1a1a26]">Chat #{c.id}</option>)}</select>}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {conversacionActiva ? conversacionActiva.mensajes.map((item) => (
                <div key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${item.remitente === "cliente" ? "ml-auto bg-[#4ea1ff]/20 text-white" : "bg-white/5 text-gray-200"}`}>
                  <p className="text-sm whitespace-pre-wrap">{item.mensaje}</p><p className="text-[11px] opacity-60 mt-1">{item.remitente === "cliente" ? "Tú" : "Soporte"} · {formatoFecha(item.fecha)}</p>
                </div>
              )) : <p className="text-sm text-gray-500 py-8 text-center">Escribe tu primer mensaje para abrir un chat con soporte.</p>}
            </div>
            <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
              <textarea value={nuevoMensaje} onChange={(e) => setNuevoMensaje(e.target.value)} maxLength="2000" rows="2" placeholder={conversacionActiva ? "Escribe un mensaje" : "Escribe el motivo de contacto"} className="flex-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#4ea1ff] resize-none" />
              <button onClick={conversacionActiva ? enviarMensaje : iniciarConversacion} disabled={guardandoSoporte || !nuevoMensaje.trim()} className="self-end px-4 py-2.5 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-white text-sm font-medium cursor-pointer">Enviar</button>
            </div>
          </section>
          {mensajeSoporte && <p className="xl:col-span-2 text-sm text-[#4ea1ff]">{mensajeSoporte}</p>}
        </div>
      )}

      {activeKey === "perfil" && formPerfil && (
        <div className="max-w-md">
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Nombre</label>
            <input value={formPerfil.nombre} onChange={(e) => setFormPerfil({ ...formPerfil, nombre: e.target.value })} className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]" />
          </div>
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Apellido</label>
            <input value={formPerfil.apellido} onChange={(e) => setFormPerfil({ ...formPerfil, apellido: e.target.value })} className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]" />
          </div>
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Correo</label>
            <input value={formPerfil.correo} disabled className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed" />
          </div>
          <div className="mb-3">
            <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
            <input value={formPerfil.telefono || ""} onChange={(e) => setFormPerfil({ ...formPerfil, telefono: e.target.value })} className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]" />
          </div>
          <div className="mb-5">
            <label className="block text-sm text-gray-400 mb-1">Dirección</label>
            <input value={formPerfil.direccion || ""} onChange={(e) => setFormPerfil({ ...formPerfil, direccion: e.target.value })} className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white outline-none focus:border-[#4ea1ff]" />
          </div>

          {mensajePerfil && <p className="text-sm text-[#4ea1ff] mb-3">{mensajePerfil}</p>}

          <button onClick={guardarPerfil} disabled={guardandoPerfil} className="px-4 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-white font-medium cursor-pointer">
            {guardandoPerfil ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}

export default Cliente;
