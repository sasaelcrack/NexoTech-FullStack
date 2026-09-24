const WhatsAppButton = () => {
  const numero = "573001234567";
  const mensaje = "Hola, quiero más información sobre NexoTech";
  const enlace = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

  return (
    <a
      href={enlace}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribir por WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-900/30 transition hover:-translate-y-1 hover:bg-green-600 active:scale-95"
    >
      <svg viewBox="0 0 32 32" className="w-8 h-8 fill-white">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 2.822.738 5.47 2.03 7.766L0 32l8.462-2.02A15.93 15.93 0 0016 32c8.837 0 16-7.163 16-16S24.837 0 16 0zm0 29.333c-2.53 0-4.902-.68-6.94-1.87l-.497-.294-5.02 1.198 1.226-4.892-.325-.51A13.27 13.27 0 012.667 16C2.667 8.64 8.64 2.667 16 2.667S29.333 8.64 29.333 16 23.36 29.333 16 29.333zm7.29-9.86c-.4-.2-2.37-1.17-2.74-1.303-.368-.135-.635-.2-.903.2-.267.4-1.036 1.303-1.27 1.57-.234.267-.468.3-.868.1-.4-.2-1.69-.623-3.22-1.986-1.19-1.06-1.994-2.37-2.227-2.77-.234-.4-.025-.617.175-.816.18-.18.4-.468.6-.702.2-.234.267-.4.4-.667.134-.267.067-.5-.033-.7-.1-.2-.903-2.176-1.237-2.98-.325-.78-.656-.674-.903-.686l-.77-.014c-.267 0-.7.1-1.066.5s-1.4 1.368-1.4 3.335 1.434 3.868 1.634 4.135c.2.267 2.822 4.31 6.84 6.04.956.413 1.702.66 2.284.845.96.305 1.833.262 2.523.159.77-.115 2.37-.968 2.704-1.903.334-.935.334-1.736.234-1.903-.1-.167-.367-.267-.767-.467z" />
      </svg>
    </a>
  );
};

export default WhatsAppButton;
