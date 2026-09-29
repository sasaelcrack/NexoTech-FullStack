import { useState } from "react";
import { API_URL } from "../config";

function Chatbot() {
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [mensajes, setMensajes] = useState([{ autor: "bot", texto: "Hola, ¿en qué puedo ayudarte con NexoTech?" }]);
  const [enviando, setEnviando] = useState(false);
  const [origenRespuesta, setOrigenRespuesta] = useState("");

  const enviar = async (e) => {
    e.preventDefault();
    const texto = mensaje.trim();
    if (!texto || enviando) return;
    setMensajes((prev) => [...prev, { autor: "usuario", texto }]);
    setMensaje("");
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/chatbot/mensaje`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensaje: texto }) });
      const data = await res.json();
      setOrigenRespuesta(res.ok ? data.origen || "local" : "sin conexion");
      setMensajes((prev) => [...prev, { autor: "bot", texto: res.ok ? data.respuesta : "No pude responder en este momento." }]);
    } catch {
      setOrigenRespuesta("sin conexion");
      setMensajes((prev) => [...prev, { autor: "bot", texto: "No pude conectarme en este momento." }]);
    } finally {
      setEnviando(false);
    }
  };

  return <div className="fixed bottom-20 right-5 z-40 sm:bottom-5 sm:right-24">
    {abierto && <section className="mb-3 flex h-[28rem] w-[min(22rem,calc(100vw-2.5rem))] animate-[riseIn_.22s_ease-out] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a26] shadow-2xl shadow-black/40"><header className="flex items-center justify-between px-4 py-3 border-b border-white/5"><div><p className="text-sm font-medium text-white">Asistente NexoTech</p><p className="text-xs text-gray-500">{origenRespuesta === "gemini" ? "Gemini IA · catálogo actualizado" : origenRespuesta === "local" ? "Respaldo local · catálogo actualizado" : origenRespuesta === "sin conexion" ? "Sin conexión al asistente" : "Compras, pagos y soporte"}</p></div><button onClick={() => setAbierto(false)} className="rounded-lg px-2 text-gray-400 hover:bg-white/10 hover:text-white cursor-pointer">×</button></header><div className="flex-1 overflow-y-auto p-4 space-y-3">{mensajes.map((item, indice) => <p key={indice} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${item.autor === "usuario" ? "ml-auto bg-[#4ea1ff]/20 text-white" : "bg-white/5 text-gray-200"}`}>{item.texto}</p>)}</div><form onSubmit={enviar} className="flex gap-2 p-3 border-t border-white/5"><input value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Escribe tu pregunta" className="min-w-0 flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-[#4ea1ff]" /><button disabled={enviando} className="rounded-lg bg-[#4ea1ff] px-3 py-2 text-sm text-white hover:bg-[#3a8fee] disabled:opacity-50 cursor-pointer">Enviar</button></form></section>}
    <button onClick={() => setAbierto((valor) => !valor)} className="h-12 w-12 rounded-full bg-[#4ea1ff] text-white shadow-lg shadow-[#4ea1ff]/30 transition hover:-translate-y-1 hover:bg-[#3a8fee] active:scale-95 cursor-pointer" aria-label="Abrir asistente">💬</button>
  </div>;
}

export default Chatbot;
