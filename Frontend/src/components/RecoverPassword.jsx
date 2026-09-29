import { useState } from "react";
import { apiRequest } from "../apiClient";
import Input from "./Input";
import Button from "./Button";

function RecoverPassword({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (value) => {
    if (!value.trim()) {
      return "El correo es obligatorio.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Ingresa un correo electrónico válido.";
    }
    return "";
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setError(validateEmail(value));
    setSent(false);
    setResetUrl("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validateEmail(email);
    setError(message);

    if (message) return;

    setLoading(true);
    try {
      const { data } = await apiRequest("/usuarios/recuperar", {
        method: "POST",
        body: { correo: email },
      });
      setSent(true);
      setResetUrl(data.reset_url || "");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nt-auth-card relative w-full max-w-md p-6 sm:p-8">
      <h1 className="text-3xl font-bold text-center mb-1">
        Recuperar <span className="text-[#4ea1ff]">Contraseña</span>
      </h1>
      <p className="text-gray-400 text-sm text-center mb-8">
        Te enviaremos un enlace para restablecer tu contraseña
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <Input
          label="Correo electrónico"
          type="email"
          name="recoverEmail"
          value={email}
          onChange={handleChange}
          error={error}
          placeholder="tucorreo@ejemplo.com"
        />

        {sent && (
          <div className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-300">
            <p>{resetUrl ? "Entorno local: ya puedes restablecer tu contraseña." : "Si el correo existe, recibirás un enlace de recuperación."}</p>
            {resetUrl && <a href={resetUrl} className="mt-2 inline-block font-medium text-emerald-200 underline underline-offset-2">Abrir enlace de recuperación</a>}
          </div>
        )}

        <Button type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Recuperar contraseña"}
        </Button>
      </form>

      <button
        onClick={onBackToLogin}
        className="w-full text-center text-[#4ea1ff] hover:underline text-sm mt-6 cursor-pointer"
      >
        ← Volver al inicio de sesión
      </button>
    </div>
  );
}

export default RecoverPassword;
