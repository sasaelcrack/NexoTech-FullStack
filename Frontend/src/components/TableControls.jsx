function TableControls({ search, onSearchChange, page, totalPages, totalItems, pageSize, onPrevious, onNext, placeholder = "Buscar...", filterValue, onFilterChange, filterOptions = [] }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <label className="relative block w-full sm:w-64">
        <span className="sr-only">{placeholder}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="nt-input w-full rounded-lg py-2.5 pl-3 pr-3 text-sm text-white placeholder:text-gray-500 outline-none"
        />
      </label>
      {onFilterChange && <select value={filterValue} onChange={(event) => onFilterChange(event.target.value)} className="nt-input rounded-lg px-3 py-2.5 text-sm text-white outline-none"><option value="">Todos los roles</option>{filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 sm:justify-end">
        <span>{totalItems === 0 ? "Sin resultados" : `${Math.min((page - 1) * pageSize + 1, totalItems)}-${Math.min(page * pageSize, totalItems)} de ${totalItems}`}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPrevious} disabled={page === 1} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">Anterior</button>
          <span className="min-w-20 text-center">Página {page} de {totalPages}</span>
          <button type="button" onClick={onNext} disabled={page === totalPages} className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35">Siguiente</button>
        </div>
      </div>
    </div>
  );
}

export default TableControls;
