function Button({ children, type = "button", onClick, variant = "primary", fullWidth = true, disabled = false }) {
  const base = "px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 cursor-pointer active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:ring-4 focus-visible:ring-[#4ea1ff]/20";

  const variants = {
    primary: "nt-button-primary text-white hover:-translate-y-0.5",
    secondary: "border border-white/12 bg-white/[0.06] text-white hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10",
    ghost: "bg-transparent text-[#8ac7ff] hover:text-white hover:bg-white/10",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""}`}
    >
      {children}
    </button>
  );
}

export default Button;
