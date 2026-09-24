import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredSession } from "../config";

function ProtectedRoute({ rolesPermitidos, children }) {
  const navigate = useNavigate();
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const usuarioGuardado = getStoredSession();

    if (!token || !usuarioGuardado || !rolesPermitidos.includes(usuarioGuardado.rol_id)) {
      navigate("/login");
      return;
    }

    setAutorizado(true);
  }, [navigate, rolesPermitidos]);

  if (!autorizado) return null;

  return children;
}

export default ProtectedRoute;