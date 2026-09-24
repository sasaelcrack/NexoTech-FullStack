import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react"
import logo from "../assets/images/logo2.png";
import { API_URL, authHeaders, getStoredSession } from "../config";

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    const sesion = getStoredSession();
    setUsuario(sesion);
    setPerfil(null);

    if (!sesion) return undefined;

    const controller = new AbortController();
    fetch(`${API_URL}/usuarios/me`, {
      headers: authHeaders(localStorage.getItem("token")),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((datos) => setPerfil(datos))
      .catch(() => {});

    return () => controller.abort();
  }, [location]);


    const linksBase = [
    { to: "/", label: "Inicio" },
    { to: "/quienes-somos", label: "¿Quiénes Somos?" },
    { to: "/contacto", label: "Contacto" },
  ];

  const links = usuario
    ? linksBase
    : [...linksBase, { to: "/login", label: "Iniciar sesión" }];

  const panelPorRol = { 1: "/admin", 2: "/empleado", 3: "/cliente" };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14]/80 shadow-lg shadow-black/20 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-3 sm:flex-row sm:gap-0 sm:px-10">
        <Link to="/" className="flex items-center gap-3 transition hover:opacity-90">
          <img src={logo} alt="NexoTech" className="h-10 w-auto object-contain" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Nexo<span className="text-[#4ea1ff]">Tech</span>
          </h1>
        </Link>

                <nav className="flex w-full items-center justify-center gap-2 sm:w-auto">
          <ul className="flex flex-wrap justify-center gap-2 sm:gap-2 m-0 p-0 list-none">
            {links.map((link) => {
              const isActive = location.pathname === link.to;
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                      className={`block px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4 ${
                      isActive
                        ? "rounded-full bg-[#4ea1ff]/15 text-[#a8d5ff] shadow-sm shadow-[#4ea1ff]/20"
                        : "rounded-full text-gray-400 hover:bg-white/[0.06] hover:text-white hover:-translate-y-0.5"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {usuario && (
            <details className="relative ml-2">
              <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full border border-[#4ea1ff]/40 bg-[#0f172a] text-[#8ac7ff] transition hover:border-[#4ea1ff] hover:bg-[#4ea1ff]/25" aria-label="Menú de cuenta">
                <img src={logo} alt="" aria-hidden="true" className="h-full w-full object-contain" />
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#151925] p-2 shadow-xl shadow-black/30">
                <div className="border-b border-white/5 px-3 py-2">
                  <p className="truncate text-sm font-medium text-white">
                    {perfil ? `${perfil.nombre} ${perfil.apellido}` : "Cuenta NexoTech"}
                  </p>
                </div>
                <button
                  onClick={() => navigate(panelPorRol[usuario.rol_id])}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-[#8ac7ff] transition hover:bg-[#4ea1ff]/10"
                >
                  Ir al panel
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 transition hover:bg-white/10 hover:text-white"
                >
                  Cerrar sesión
                </button>
              </div>
            </details>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
