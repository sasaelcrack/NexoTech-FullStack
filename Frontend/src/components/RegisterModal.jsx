import { useState, useEffect } from "react";
import Input from "./Input";
import Select from "./Select";
import Button from "./Button";
import { API_URL } from "../config";

const initialForm = {
  nombre: "",
  apellido: "",
  tipoDocumento: "",
  numeroDocumento: "",
  direccion: "",
  telefono: "",
  correo: "",
  password: "",
  confirmPassword: "",
};

function RegisterModal({ isOpen, onClose }) {
  const [formData, setFormData] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [errorServidor, setErrorServidor] = useState("");
  const [cargando, setCargando] = useState(false);

  // Bloquea el scroll del fondo cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  const validateField = (name, value, data = formData) => {
    switch (name) {
      case "nombre":
      case "apellido":
        if (!value.trim()) return "Este campo es obligatorio.";
        if (value.trim().length < 2) return "Debe tener al menos 2 caracteres.";
        if (value.trim().length > 30) return "Máximo 30 caracteres.";
        if (!/^[A-Za-zÀ-ÿ\s]+$/.test(value)) return "Solo se permiten letras.";
        return "";

      case "tipoDocumento":
        if (!value) return "Selecciona un tipo de documento.";
        return "";

      case "numeroDocumento":
        if (!value.trim()) return "El número de documento es obligatorio.";
        if (!/^[0-9]{6,10}$/.test(value)) return "Debe tener entre 6 y 10 dígitos numéricos.";
        return "";

      case "direccion":
        if (!value.trim()) return "La dirección es obligatoria.";
        if (value.trim().length < 5) return "Debe tener al menos 5 caracteres.";
        if (value.trim().length > 80) return "Máximo 80 caracteres.";
        return "";

      case "telefono":
        if (!value.trim()) return "El teléfono es obligatorio.";
        if (!/^[0-9]{10}$/.test(value)) return "Debe tener exactamente 10 dígitos.";
        return "";

      case "correo":
        if (!value.trim()) return "El correo es obligatorio.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Ingresa un correo válido.";
        return "";

      case "password":
        if (!value) return "La contraseña es obligatoria.";
        if (value.length < 8 || value.length > 20) return "Debe tener entre 8 y 20 caracteres.";
        if (!/(?=.*[A-Z])(?=.*[0-9])/.test(value))
          return "Debe incluir al menos una mayúscula y un número.";
        return "";

      case "confirmPassword":
        if (!value) return "Confirma tu contraseña.";
        if (value !== data.password) return "Las contraseñas no coinciden.";
        return "";

      default:
        return "";
    }
  };

  const handleChange = (e) => {
    let { name, value } = e.target;

    // Restringe caracteres no permitidos según el campo, mientras se escribe
    if (name === "numeroDocumento" || name === "telefono") {
      value = value.replace(/[^0-9]/g, "");
    }
    if (name === "nombre" || name === "apellido") {
      value = value.replace(/[^A-Za-zÀ-ÿ\s]/g, "");
    }

    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);

    const message = validateField(name, value, updatedData);
    setErrors((prev) => {
      const newErrors = { ...prev, [name]: message };
      // Si cambia la contraseña, revalida también la confirmación
      if (name === "password" && updatedData.confirmPassword) {
        newErrors.confirmPassword = validateField(
          "confirmPassword",
          updatedData.confirmPassword,
          updatedData
        );
      }
      return newErrors;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorServidor("");

    const newErrors = {};
    const fields = step === 1
      ? ["nombre", "apellido", "tipoDocumento", "numeroDocumento", "direccion", "telefono", "correo"]
      : ["password", "confirmPassword"];
    fields.forEach((field) => {
      newErrors[field] = validateField(field, formData[field], formData);
    });
    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((msg) => msg !== "");
    if (hasErrors) return;

    if (step === 1) {
      setStep(2);
      return;
    }

    setCargando(true);

    try {
      const response = await fetch(`${API_URL}/usuarios/registro`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nombre: formData.nombre,
          apellido: formData.apellido,
          tipo_documento: formData.tipoDocumento,
          numero_documento: formData.numeroDocumento,
          direccion: formData.direccion,
          telefono: formData.telefono,
          correo: formData.correo,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
          throw new Error(data.detail || data.mensaje || "No fue posible registrar el usuario.");
      }

      setSuccess(true);
    } catch (error) {
      setErrorServidor(error.message);
    } finally {
      setCargando(false);
    }
  };

  const handleClose = () => {
    setFormData(initialForm);
    setErrors({});
    setSuccess(false);
    setStep(1);
    setErrorServidor("");
    onClose();
  };

  // Punto 18: refuerza visualmente la validación en tiempo real
  // deshabilitando el envío mientras haya errores o campos vacíos.
  const fieldsForStep = step === 1
    ? ["nombre", "apellido", "tipoDocumento", "numeroDocumento", "direccion", "telefono", "correo"]
    : ["password", "confirmPassword"];
  const hasVisibleErrors = fieldsForStep.some((field) => errors[field]);
  const isFormEmpty = fieldsForStep.some((field) => formData[field].trim() === "");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#05070c]/80 px-4 py-6 backdrop-blur-md sm:py-10"
      onClick={handleClose}
    >
      <div
        className="my-auto w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-white/15 bg-[#141722] p-5 shadow-2xl shadow-black/50 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-7 flex items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">NexoTech / Registro</p>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Crear <span className="text-[#4ea1ff]">Cuenta</span>
            </h2>
            <p className="mt-2 text-sm text-slate-400">{step === 1 ? "Completa tus datos para continuar." : "Crea y confirma tu contraseña."}</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Cerrar registro"
            className="rounded-full p-2 text-2xl leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            &times;
          </button>
        </div>

        {success ? (
          <div className="text-center py-10">
            <p className="text-green-400 text-lg font-medium mb-2">
              ¡Registro exitoso!
            </p>
            <p className="text-gray-400 text-sm mb-6">
              Tu cuenta ha sido creada correctamente.
            </p>
            <Button onClick={handleClose}>Volver al inicio de sesión</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {step === 1 && <>
            <div className="mb-2 grid gap-x-5 sm:grid-cols-2">
              <Input
                label="Nombre"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                error={errors.nombre}
                placeholder="Juan"
                maxLength={30}
              />
              <Input
                label="Apellido"
                name="apellido"
                value={formData.apellido}
                onChange={handleChange}
                error={errors.apellido}
                placeholder="Pérez"
                maxLength={30}
              />
            </div>

            <div className="grid gap-x-5 sm:grid-cols-2">
              <Select
                label="Tipo de documento"
                name="tipoDocumento"
                value={formData.tipoDocumento}
                onChange={handleChange}
                error={errors.tipoDocumento}
                options={[
                  { value: "CC", label: "Cédula de Ciudadanía" },
                  { value: "TI", label: "Tarjeta de Identidad" },
                  { value: "CE", label: "Cédula de Extranjería" },
                  { value: "PA", label: "Pasaporte" },
                ]}
              />
              <Input
                label="Número de documento"
                name="numeroDocumento"
                value={formData.numeroDocumento}
                onChange={handleChange}
                error={errors.numeroDocumento}
                placeholder="1234567890"
                maxLength={10}
              />
            </div>

            <Input
              label="Dirección"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              error={errors.direccion}
              placeholder="Calle 10 # 20-30"
              maxLength={80}
            />

            <div className="grid gap-x-5 sm:grid-cols-2">
              <Input
                label="Teléfono"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                error={errors.telefono}
                placeholder="3001234567"
                maxLength={10}
              />
              <Input
                label="Correo electrónico"
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                error={errors.correo}
                placeholder="tucorreo@ejemplo.com"
              />
            </div>
            </>}

            {step === 2 && <>
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span className="text-gray-300">{formData.correo}</span>
              <button type="button" onClick={() => setStep(1)} className="text-[#4ea1ff] hover:underline">Cambiar</button>
            </div>
            <div className="grid gap-x-5 sm:grid-cols-2">
              <Input
                label="Contraseña"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                placeholder="••••••••"
                maxLength={20}
              />
              <Input
                label="Confirmar contraseña"
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                placeholder="••••••••"
                maxLength={20}
              />
            </div>
            </>}

            {errorServidor && (
              <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-center text-sm text-red-300">{errorServidor}</p>
            )}

            <div className="mt-4 border-t border-white/10 pt-5">
              <Button type="submit" disabled={cargando || hasVisibleErrors || isFormEmpty}>
                {cargando ? "Registrando..." : step === 1 ? "Siguiente" : "Crear cuenta"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default RegisterModal;
