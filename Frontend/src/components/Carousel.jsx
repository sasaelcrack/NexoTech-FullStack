import { useState } from "react";

import img1 from "../assets/images/1.png";
import img2 from "../assets/images/2.png";
import img3 from "../assets/images/3.png";
import img4 from "../assets/images/4.png";
import img5 from "../assets/images/5.png";
import img6 from "../assets/images/6.png";
import img7 from "../assets/images/7.png";
import img8 from "../assets/images/8.png";
import img9 from "../assets/images/9.png";
import img10 from "../assets/images/10.png";

const slides = [
  { image: img1, title: "Nuestro Equipo", description: "Profesionales comprometidos trabajando juntos por la innovación." },
  { image: img2, title: "Tecnología de Punta", description: "Utilizamos las últimas herramientas para desarrollar soluciones eficientes." },
  { image: img3, title: "Atención al Cliente", description: "Brindamos soporte cercano y personalizado en cada proyecto." },
  { image: img4, title: "Innovación Constante", description: "Buscamos siempre nuevas formas de mejorar nuestros servicios." },
  { image: img5, title: "Trabajo en Equipo", description: "La colaboración es la base de nuestros mejores resultados." },
  { image: img6, title: "Oficinas Modernas", description: "Espacios diseñados para potenciar la creatividad y productividad." },
  { image: img7, title: "Soluciones a la Medida", description: "Cada cliente recibe un servicio adaptado a sus necesidades." },
  { image: img8, title: "Compromiso con la Calidad", description: "Cada proyecto se entrega cumpliendo los más altos estándares." },
  { image: img9, title: "Crecimiento Sostenido", description: "Acompañamos a nuestros clientes en cada etapa de su desarrollo." },
  { image: img10, title: "Confianza y Resultados", description: "Nuestros clientes avalan la calidad de nuestro trabajo." },
];

function Carousel() {
  const [current, setCurrent] = useState(0);

  const prevSlide = () => {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="relative mx-auto max-w-5xl text-center">
      <button
        onClick={prevSlide}
        aria-label="Imagen anterior"
        className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-xl text-white backdrop-blur transition hover:bg-[#4ea1ff]"
      >
        &#10094;
      </button>

      <div className="relative overflow-hidden rounded-2xl shadow-xl shadow-black/30">
        <img
          src={slides[current].image}
          alt={slides[current].title}
          className="block h-[420px] w-full object-cover transition-opacity duration-500 sm:h-[500px]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-7 pb-7 pt-20 text-left">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">NexoTech / {String(current + 1).padStart(2, "0")}</p>
          <h2 className="mb-1 text-2xl font-bold sm:text-3xl">{slides[current].title}</h2>
          <p className="text-sm text-slate-200">{slides[current].description}</p>
        </div>
      </div>

      <button
        onClick={nextSlide}
        aria-label="Imagen siguiente"
        className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-xl text-white backdrop-blur transition hover:bg-[#4ea1ff]"
      >
        &#10095;
      </button>

      <div className="mt-5 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            aria-label={`Ver imagen: ${slide.title}`}
            className={`h-2.5 rounded-full transition-all duration-200 ${
              index === current ? "w-8 bg-[#4ea1ff]" : "w-2.5 bg-slate-500 hover:bg-slate-300"
            }`}
          ></button>
        ))}
      </div>
    </div>
  );
}

export default Carousel;