import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import Input from "../components/Input";
import Button from "../components/Button";

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("El enlace de recuperación no es válido.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(password)) {
      setError("La contraseña debe incluir una mayúscula y un número.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/usuarios/restablecer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "No fue posible actualizar la contraseña.");
      setSuccess(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#0b0d14] px-6 py-16 text-white">
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/10 bg-[#151925] p-8 shadow-2xl shadow-black/30">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">NexoTech / Seguridad</p>
        <h1 className="font-display text-3xl font-bold">Nueva contraseña</h1>
        <p className="mt-2 mb-8 text-sm leading-relaxed text-slate-400">Crea una contraseña segura para volver a entrar a tu cuenta.</p>

        {success ? (
          <div>
            <p className="mb-6 rounded-xl border border-green-400/20 bg-green-400/10 p-4 text-sm text-green-300">Tu contraseña fue actualizada correctamente.</p>
            <Button onClick={() => navigate("/login")}>Volver al inicio de sesión</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <Input label="Nueva contraseña" type="password" name="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" maxLength={64} />
            <Input label="Confirmar contraseña" type="password" name="confirmPassword" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repite tu contraseña" maxLength={64} />
            {error && <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={loading}>{loading ? "Guardando..." : "Guardar nueva contraseña"}</Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default ResetPassword;