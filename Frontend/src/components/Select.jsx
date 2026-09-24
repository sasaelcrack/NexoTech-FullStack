function Select({ label, name, value, onChange, options, error }) {
  return (
    <div className="mb-5">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className={`nt-input w-full rounded-xl px-4 py-3 text-white outline-none transition duration-200 ${
          error
            ? "border-red-500 focus:border-red-500"
            : ""
        }`}
      >
        <option value="" className="bg-[#1e1e2f]">
          Selecciona una opción
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[#1e1e2f]">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p role="alert" className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export default Select;
