function ConfirmDialog({ open, title = "¿Confirmar acción?", description, confirmLabel = "Confirmar", danger = false, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <button aria-label="Cancelar" onClick={onCancel} className="absolute inset-0 bg-[#070811]/80 backdrop-blur-sm cursor-default" />
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#171925] shadow-2xl shadow-black/50">
        <div className={`h-1 ${danger ? "bg-red-400" : "bg-[#4ea1ff]"}`} />
        <div className="p-6">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${danger ? "bg-red-500/15 text-red-300" : "bg-[#4ea1ff]/15 text-[#78b9ff]"}`}>
            <span className="text-xl font-semibold">!</span>
          </div>
          <h2 id="confirm-dialog-title" className="mt-4 font-display text-xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">{description}</p>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={onCancel} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 cursor-pointer">Cancelar</button>
            <button onClick={onConfirm} className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition cursor-pointer ${danger ? "bg-red-500 hover:bg-red-400" : "bg-[#4ea1ff] hover:bg-[#3a8fee]"}`}>{confirmLabel}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
