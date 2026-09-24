import { Link } from "react-router-dom";
import logo from "../assets/images/logo2.png";

function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-white/10 bg-[#0a101c] text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="flex items-center gap-2">
          <img src={logo} alt="NexoTech" className="h-7 w-auto object-contain" />
          <p className="font-display text-sm font-semibold tracking-tight">
            Nexo<span className="text-[#4ea1ff]">Tech</span>
          </p>
        </div>

        <nav>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-x-6 gap-y-2 p-0 text-sm text-gray-400">
            <li>
              <Link to="/" className="hover:text-[#4ea1ff] transition-colors duration-200">
                Inicio
              </Link>
            </li>
            <li>
              <Link to="/quienes-somos" className="hover:text-[#4ea1ff] transition-colors duration-200">
                ¿Quiénes Somos?
              </Link>
            </li>
            <li>
              <Link to="/contacto" className="hover:text-[#4ea1ff] transition-colors duration-200">
                Contacto
              </Link>
            </li>
          </ul>
        </nav>

        <p className="text-center text-xs text-gray-500 lg:text-right">
          &copy; {new Date().getFullYear()} NexoTech. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}

export default Footer;