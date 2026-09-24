function Input({ label, type = "text", name, value, onChange, error, placeholder, maxLength }) {
  return (
    <div className="mb-5">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold text-slate-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`nt-input w-full rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition duration-200 ${
          error
            ? "border-red-500 focus:border-red-500"
            : ""
        }`}
      />
          {error && <p role="alert" className="mt-1.5 text-xs text-red-300">{error}</p>}
    </div>
  );
}

export default Input;
