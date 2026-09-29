import { useState } from "react";
import { apiRequest } from "../apiClient";
import { useNavigate } from "react-router-dom";
import Input from "../components/Input";
import Button from "../components/Button";
import RecoverPassword from "../components/RecoverPassword";
import RegisterModal from "../components/RegisterModal";

function Login() {
  const [view, setView] = useState("login"); // "login" | "recover"
  const [step, setStep] = useState("correo"); // "correo" | "password"
  const [showRegister, setShowRegister] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [remember, setRemember] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");
  const [cargando, setCargando] = useState(false);
  const navigate = useNavigate();

  const validateField = (name, value) => {
    let message = "";

    if (name === "email") {
      if (!value.trim()) {
        message = "El correo es obligatorio.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        message = "Ingresa un correo electrónico válido.";
      }
    }

    if (name === "password") {
      if (!value) {
        message = "La contraseña es obligatoria.";
      } else if (value.length < 8) {
        message = "La contraseña debe tener al menos 8 caracteres.";
      }
    }

    return message;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    const message = validateField(name, value);
    setErrors((prev) => ({ ...prev, [name]: message }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorServidor("");

    if (step === "correo") {
      const emailError = validateField("email", formData.email);
      setErrors({ email: emailError });
      if (!emailError) setStep("password");
      return;
    }

    const newErrors = {
      email: validateField("email", formData.email),
      password: validateField("password", formData.password),
    };
    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((msg) => msg !== "");
    if (hasErrors) return;

    setCargando(true);

      try {
        const { data } = await apiRequest("/usuarios/login", {
          method: "POST",
          body: {
            correo: formData.email,
            password: formData.password,
          },
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("usuario", JSON.stringify({
        id: data.usuario.id,
        rol_id: data.usuario.rol_id,
      }));

      const rolId = data.usuario.rol_id;

    if (rolId === 1) {
      navigate("/admin");
    } else if (rolId === 2) {
      navigate("/empleado");
    } else {
      navigate("/cliente");
    }
    } catch (error) {
      setErrorServidor(error.message);
    } finally {
      setCargando(false);
    }
  };

  const volverACorreo = () => {
    setStep("correo");
    setFormData((prev) => ({ ...prev, password: "" }));
    setErrors({});
    setErrorServidor("");
  };

  return (
    <main className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-[#070b14] px-5 py-12 text-white sm:px-6 sm:py-16">
      <div className="pointer-events-none absolute -left-28 top-12 h-72 w-72 rounded-full bg-[#4ea1ff]/10 blur-3xl" />
      <div className="relative grid w-full max-w-5xl gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <aside className="relative hidden overflow-hidden rounded-3xl border border-[#4ea1ff]/20 bg-gradient-to-br from-[#102d51] via-[#0d1b31] to-[#17152f] p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#4ea1ff]/20 blur-3xl" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8ac7ff]">NexoTech / acceso</p>
            <h2 className="mt-7 max-w-sm font-display text-4xl font-bold leading-tight text-white">Todo lo que necesitas para avanzar, en un solo lugar.</h2>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-slate-300">Gestiona tus proyectos, compras y soporte con una experiencia pensada para personas.</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3 border-t border-white/15 pt-5 text-xs text-slate-300">
            <span>Diseño útil</span><span>Soporte cercano</span><span>Datos claros</span>
          </div>
        </aside>
        {view === "login" ? (
        <div className="nt-auth-card relative w-full p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center mb-1">
            Inicia <span className="text-[#4ea1ff]">Sesión</span>
          </h1>
          <p className="text-gray-400 text-sm text-center mb-8">
            {step === "correo" ? "Ingresa tu correo para continuar" : "Ingresa tu contraseña para acceder"}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {step === "correo" ? (
              <Input
                label="Correo electrónico"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="tucorreo@ejemplo.com"
              />
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-gray-300">{formData.email}</span>
                  <button type="button" onClick={volverACorreo} className="text-[#4ea1ff] hover:underline">Cambiar</button>
                </div>
                <Input
                  label="Contraseña"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  placeholder="••••••••"
                />
              </>
            )}

            {step === "password" && <div className="flex items-center justify-between mb-6 text-sm">
              <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[#4ea1ff] cursor-pointer"
                />
                Recordarme
              </label>

              <button
                type="button"
                onClick={() => setView("recover")}
                className="text-[#4ea1ff] hover:underline cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>}

            {errorServidor && (
              <p className="mb-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300">{errorServidor}</p>
            )}

            <Button type="submit" disabled={cargando}>
              {cargando ? "Iniciando sesión..." : step === "correo" ? "Siguiente" : "Iniciar sesión"}
            </Button>
          </form>
            <p className="text-center text-gray-400 text-sm mt-6">
              ¿No tienes cuenta?{" "}
              <button
                onClick={() => setShowRegister(true)}
                className="text-[#4ea1ff] hover:underline font-medium cursor-pointer"
              >
                Crear una cuenta
              </button>
            </p>
        </div>
      ) : (
        <RecoverPassword onBackToLogin={() => setView("login")} />
      )}
      </div>
       <RegisterModal isOpen={showRegister} onClose={() => setShowRegister(false)} />
    </main>
  );
}

export default Login;
