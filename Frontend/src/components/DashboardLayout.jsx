import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/images/logo2.png";

const roleLabels = { 1: "Administrador", 2: "Empleado", 3: "Cliente" };

const IconChevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconLogout = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

const IconHome = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />
  </svg>
);

function DashboardLayout({ menu, activeKey, onSelect, usuario, title, children }) {
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickFuera(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener("mousedown", handleClickFuera);
    return () => document.removeEventListener("mousedown", handleClickFuera);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white selection:bg-[#4ea1ff] selection:text-white md:flex">
      {/* Sidebar */}
      <aside className="hidden shrink-0 flex-col border-r border-white/10 bg-[#0c1422]/80 backdrop-blur-xl md:flex md:w-72">
        <div className="relative flex items-center gap-3 overflow-hidden border-b border-white/10 px-6 py-6">
          <div aria-label="Logo NexoTech" className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0f172a] shadow-lg shadow-[#4ea1ff]/20">
            <img src={logo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="font-display text-base font-semibold text-white tracking-tight leading-none">
              Nexo<span className="text-[#4ea1ff]">Tech</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">{roleLabels[usuario?.rol_id]}</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {menu.map((item) => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                activeKey === item.key
                  ? "bg-[#4ea1ff]/12 text-[#a8d5ff] shadow-sm shadow-[#4ea1ff]/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5 hover:translate-x-0.5"
              }`}
            >
              {activeKey === item.key && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-[#4ea1ff]" />
              )}
              <span className="w-5 h-5 shrink-0">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer">
            <span className="w-5 h-5">{IconHome}</span>
            Volver al inicio
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior */}
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#070b14]/80 px-4 py-3 backdrop-blur-2xl sm:px-8 lg:px-10">
          <button onClick={() => navigate("/")} className="md:hidden shrink-0 font-display font-semibold text-white cursor-pointer">
            Nexo<span className="text-[#4ea1ff]">Tech</span>
          </button>
          <select
            value={activeKey}
            onChange={(e) => onSelect(e.target.value)}
            className="md:hidden min-w-0 max-w-[11rem] rounded-lg border border-white/10 bg-white/[0.06] px-2 py-2 text-sm text-white"
          >
            {menu.map((item) => (
              <option key={item.key} value={item.key} className="bg-[#1a1a26]">
                {item.label}
              </option>
            ))}
          </select>

          <div className="hidden md:block" />

          {/* Avatar + dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setMenuAbierto((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/5 transition-colors duration-150 cursor-pointer"
            >
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-[#4ea1ff]/40 bg-[#0f172a] text-gray-400">
                <img src={logo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              </span>
              <span className="hidden sm:block w-4 h-4 text-gray-500">{IconChevron}</span>
            </button>

            {menuAbierto && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#111b2c] shadow-xl shadow-black/40">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-sm text-white">Cuenta NexoTech</p>
                  <p className="text-xs text-gray-500">{roleLabels[usuario?.rol_id]}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors duration-150 cursor-pointer"
                >
                  <span className="w-4 h-4">{IconLogout}</span>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="nt-page-enter w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight text-white sm:mb-8 sm:text-3xl">
            {title}
          </h1>
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
