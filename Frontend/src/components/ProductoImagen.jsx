import { useEffect, useState } from "react";

function ProductoImagen({ src, nombre, className = "" }) {
  const [falloCarga, setFalloCarga] = useState(false);

  useEffect(() => {
    setFalloCarga(false);
  }, [src]);

  const inicial = nombre?.trim()?.slice(0, 1).toUpperCase() || "?";

  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#4ea1ff]/10 text-sm font-semibold text-[#78b9ff] ${className}`}>
      {src && !falloCarga ? (
        <img
          src={src}
          alt={nombre ? `Foto de ${nombre}` : "Foto del producto"}
          loading="lazy"
          onError={() => setFalloCarga(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-label={nombre ? `Sin foto de ${nombre}` : "Sin foto del producto"}>{inicial}</span>
      )}
    </span>
  );
}

export default ProductoImagen;