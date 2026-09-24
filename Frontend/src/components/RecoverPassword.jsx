import { useState } from "react";
import { apiRequest } from "../apiClient";
import Input from "./Input";
import Button from "./Button";

function RecoverPassword({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const message = validateEmail(email);
    setError(message);

    if (message) return;

    setLoading(true);
    try {
      await apiRequest("/usuarios/recuperar", {
        method: "POST",
        body: { correo: email },
      });
      setSent(true);
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
          <p className="mb-4 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-center text-sm text-emerald-300">
            Si el correo existe, recibirás un enlace de recuperación.
          </p>
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
