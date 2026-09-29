import { useEffect, useState } from "react";
import { API_URL, authHeaders } from "../config";

function formatoFecha(valor) {
  return valor ? new Date(valor).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "Sin fecha";
}

function SupportInbox({ token }) {
  const [pqrs, setPqrs] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [conversaciones, setConversaciones] = useState([]);
  const [conversacionActiva, setConversacionActiva] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");

  const cargarBandeja = async () => {
    setCargando(true);
    setError("");
    try {
      const [resPqrs, resChats, resClientes] = await Promise.all([
        fetch(`${API_URL}/pqr/`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/conversaciones/`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/usuarios/referencias`, { headers: authHeaders(token) }),
      ]);
      const [dataPqrs, dataChats, dataClientes] = await Promise.all([resPqrs.json(), resChats.json(), resClientes.json()]);
      if (!resPqrs.ok) throw new Error(dataPqrs.detail || "No se pudieron cargar las PQR");
      if (!resChats.ok) throw new Error(dataChats.detail || "No se pudieron cargar las conversaciones");
      setPqrs(dataPqrs);
      setClientes(resClientes.ok ? dataClientes : []);
      setConversaciones(dataChats);
      setConversacionActiva((actual) => dataChats.find((chat) => chat.id === actual?.id) || dataChats[0] || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const nombreCliente = (clienteId) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    return cliente ? `${cliente.nombre} ${cliente.apellido}` : `Cliente #${clienteId}`;
  };

  useEffect(() => {
    cargarBandeja();
    // La bandeja se carga una vez al abrir esta sección.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const responderPqr = async (pqrId, estado) => {
    const respuesta = (respuestas[pqrId] || "").trim();
    if (!respuesta) return;
    setProcesando(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/pqr/${pqrId}/respuesta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ respuesta, estado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo responder la PQR");
      setPqrs((prev) => prev.map((pqr) => pqr.id === pqrId ? data : pqr));
      setRespuestas((prev) => ({ ...prev, [pqrId]: "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  const enviarMensaje = async () => {
    const texto = mensaje.trim();
    if (!texto || !conversacionActiva) return;
    setProcesando(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/conversaciones/${conversacionActiva.id}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ mensaje: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "No se pudo enviar el mensaje");
      const actualizada = { ...conversacionActiva, mensajes: [...conversacionActiva.mensajes, data] };
      setConversacionActiva(actualizada);
      setConversaciones((prev) => prev.map((chat) => chat.id === actualizada.id ? actualizada : chat));
      setMensaje("");
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <p className="text-gray-400">Cargando bandeja de soporte...</p>;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1d2032] to-[#171924] p-5 shadow-lg shadow-black/10">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-white">PQR recibidas</h2><p className="mt-1 text-sm text-gray-500">Gestiona y responde las solicitudes de clientes.</p></div><span className="nt-badge border-[#4ea1ff]/40 text-[#78b9ff]">{pqrs.length} total</span></div>
          <div className="mt-4 space-y-3 max-h-[34rem] overflow-y-auto pr-1">
            {pqrs.length === 0 ? <p className="text-sm text-gray-500">No hay solicitudes registradas.</p> : pqrs.map((pqr) => (
              <article key={pqr.id} className="rounded-xl border border-white/8 bg-[#10121d]/75 p-4 transition hover:border-[#4ea1ff]/35 hover:bg-[#151a29]">
                <div className="flex justify-between gap-3"><h3 className="text-sm font-medium text-white">{pqr.asunto}</h3><span className={`nt-badge capitalize ${pqr.estado === "cerrada" ? "border-gray-500/50 text-gray-400" : pqr.estado === "respondida" ? "border-[#7c5cff]/50 text-[#b5a8ff]" : "border-[#ffb86b]/50 text-[#ffca8f]"}`}>{pqr.estado}</span></div>
                <p className="text-xs text-gray-500 mt-1">{nombreCliente(pqr.cliente_id)} · {formatoFecha(pqr.fecha_creacion)}</p>
                <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap">{pqr.descripcion}</p>
                {pqr.respuesta ? <div className="mt-3 border-l-2 border-[#4ea1ff] bg-[#4ea1ff]/[.06] px-3 py-2 text-sm text-gray-300"><span className="mb-1 block text-xs font-medium text-[#78b9ff]">Respuesta enviada</span>{pqr.respuesta}</div> : (
                  <div className="mt-3 space-y-2">
                    <textarea value={respuestas[pqr.id] || ""} onChange={(e) => setRespuestas((prev) => ({ ...prev, [pqr.id]: e.target.value }))} rows="3" maxLength="2000" placeholder="Escribe la respuesta" className="w-full p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#4ea1ff] resize-y" />
                    <div className="flex gap-2"><button onClick={() => responderPqr(pqr.id, "respondida")} disabled={procesando || !(respuestas[pqr.id] || "").trim()} className="px-3 py-2 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-xs text-white cursor-pointer">Responder</button><button onClick={() => responderPqr(pqr.id, "cerrada")} disabled={procesando || !(respuestas[pqr.id] || "").trim()} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-xs text-white cursor-pointer">Responder y cerrar</button></div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="bg-[#1a1a26] border border-white/5 rounded-xl p-5 flex flex-col min-h-[34rem]">
          <div className="flex justify-between items-start gap-3 mb-4"><div><h2 className="font-display text-lg font-semibold text-white">Conversaciones</h2><p className="text-sm text-gray-500">Mensajes de clientes.</p></div>{conversaciones.length > 1 && <select value={conversacionActiva?.id || ""} onChange={(e) => setConversacionActiva(conversaciones.find((chat) => chat.id === Number(e.target.value)) || null)} className="max-w-36 bg-white/5 border border-white/10 text-sm text-white rounded-lg p-2"><option value="">Chat</option>{conversaciones.map((chat) => <option key={chat.id} value={chat.id} className="bg-[#1a1a26]">Cliente #{chat.usuario_id}</option>)}</select>}</div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {conversacionActiva ? conversacionActiva.mensajes.map((item) => <div key={item.id} className={`max-w-[85%] rounded-xl px-3 py-2 ${item.remitente === "soporte" ? "ml-auto bg-[#4ea1ff]/20 text-white" : "bg-white/5 text-gray-200"}`}><p className="text-sm whitespace-pre-wrap">{item.mensaje}</p><p className="text-[11px] opacity-60 mt-1">{item.remitente === "soporte" ? "Soporte" : "Cliente"} · {formatoFecha(item.fecha)}</p></div>) : <p className="text-sm text-gray-500 text-center py-8">No hay conversaciones abiertas.</p>}
          </div>
          <div className="mt-4 pt-4 border-t border-white/5 flex gap-2"><textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows="2" maxLength="2000" disabled={!conversacionActiva} placeholder="Responder al cliente" className="flex-1 p-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-600 outline-none focus:border-[#4ea1ff] resize-none disabled:opacity-50" /><button onClick={enviarMensaje} disabled={procesando || !conversacionActiva || !mensaje.trim()} className="self-end px-4 py-2.5 rounded-lg bg-[#4ea1ff] hover:bg-[#3a8fee] disabled:opacity-50 text-white text-sm font-medium cursor-pointer">Enviar</button></div>
        </section>
      </div>
    </div>
  );
}

export default SupportInbox;
