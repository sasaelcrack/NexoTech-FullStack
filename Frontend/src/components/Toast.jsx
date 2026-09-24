import { useEffect } from "react";

function Toast({ notice, onClose }) {
  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timeout);
  }, [notice, onClose]);

  if (!notice) return null;
  const isError = notice.type === "error";
  return (
    <div className="fixed right-4 top-4 z-[110] w-[min(24rem,calc(100vw-2rem))] animate-[fadeIn_.2s_ease-out]">
      <div className={`flex gap-3 rounded-xl border p-4 shadow-xl shadow-black/30 ${isError ? "border-red-400/30 bg-[#2a1820]" : "border-[#4ea1ff]/30 bg-[#142238]"}`} role="alert">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isError ? "bg-red-400/20 text-red-300" : "bg-[#4ea1ff]/20 text-[#83c1ff]"}`}>{isError ? "!" : "✓"}</span>
        <p className="flex-1 text-sm leading-6 text-white">{notice.message}</p>
        <button onClick={onClose} aria-label="Cerrar mensaje" className="text-gray-400 hover:text-white cursor-pointer">×</button>
      </div>
    </div>
  );
}

export default Toast;
