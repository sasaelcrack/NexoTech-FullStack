import { useState } from "react";
import img1 from "../assets/images/1.png";
import img3 from "../assets/images/3.png";
import img5 from "../assets/images/5.png";
import img7 from "../assets/images/7.png";

const gallery = [
  { image: img1, label: "El equipo", title: "Personas que hacen que las ideas avancen." },
  { image: img3, label: "La experiencia", title: "Tecnología pensada para personas." },
  { image: img5, label: "La colaboración", title: "Cada proyecto nace de escuchar." },
  { image: img7, label: "El resultado", title: "Soluciones que dejan huella." },
];

const principles = [
  { key: "mision", label: "01 / Misión", title: "Convertir la tecnología en una ventaja real.", text: "Brindamos soluciones accesibles y de alta calidad para ayudar a empresas y personas a modernizar sus procesos." },
  { key: "vision", label: "02 / Visión", title: "Ser el equipo que imagina un paso adelante.", text: "Queremos ser reconocidos por unir desarrollo de software, innovación y una relación de confianza con cada cliente." },
  { key: "valores", label: "03 / Valores", title: "La forma en que construimos importa.", text: "Innovación constante, trabajo en equipo, responsabilidad, transparencia y calidad en cada proyecto." },
];

function QuienesSomos() {
  const [activeImage, setActiveImage] = useState(0);
  const [activePrinciple, setActivePrinciple] = useState("mision");
  const selectedPrinciple = principles.find((principle) => principle.key === activePrinciple);

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[#0b0d14] px-6 py-14 text-white sm:px-10 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <section className="grid items-end gap-8 border-b border-white/10 pb-14 lg:grid-cols-[1fr_0.7fr]">
          <div><p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-[#62b0ff]">Quiénes somos / NexoTech</p><h1 className="max-w-3xl font-display text-5xl font-bold leading-none tracking-tight sm:text-7xl">La tecnología funciona mejor cuando <span className="text-[#4ea1ff]">tiene sentido.</span></h1></div>
          <p className="max-w-md text-lg leading-relaxed text-slate-300">Somos un equipo que combina estrategia, diseño y desarrollo para convertir retos complejos en experiencias digitales claras.</p>
        </section>

        <section className="grid gap-8 py-14 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative min-h-[430px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#171b28]"><img src={gallery[activeImage].image} alt={gallery[activeImage].label} className="h-full min-h-[430px] w-full object-cover transition duration-500" /><div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-transparent to-transparent" /><div className="absolute bottom-7 left-7 right-7"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">{gallery[activeImage].label}</p><h2 className="mt-2 max-w-lg text-2xl font-bold sm:text-3xl">{gallery[activeImage].title}</h2></div></div>
          <div className="flex flex-col justify-between gap-8"><div><p className="text-sm leading-relaxed text-slate-400">Una cultura construida alrededor de la curiosidad, el cuidado por los detalles y las ganas de hacer las cosas mejor.</p><div className="mt-7 grid grid-cols-2 gap-3">{gallery.map((item, index) => <button key={item.label} onClick={() => setActiveImage(index)} className={`group relative h-28 overflow-hidden rounded-2xl border text-left transition ${activeImage === index ? "border-[#4ea1ff] ring-2 ring-[#4ea1ff]/20" : "border-white/10 hover:border-white/40"}`}><img src={item.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-xs font-semibold backdrop-blur-sm">{item.label}</span></button>)}</div></div><div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-5 text-center"><div><strong className="block text-2xl text-[#62b0ff]">01</strong><span className="text-xs text-slate-400">Mirada humana</span></div><div><strong className="block text-2xl text-[#62b0ff]">02</strong><span className="text-xs text-slate-400">Diseño útil</span></div><div><strong className="block text-2xl text-[#62b0ff]">03</strong><span className="text-xs text-slate-400">Código claro</span></div></div></div>
        </section>

        <section className="border-t border-white/10 py-14"><div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">Lo que defendemos</p><h2 className="mt-3 font-display text-4xl font-bold">Principios en movimiento.</h2><p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">Explora cada principio. La interfaz cambia porque nuestras ideas también están vivas.</p></div><div className="grid gap-3">{principles.map((principle) => <button key={principle.key} onClick={() => setActivePrinciple(principle.key)} className={`group grid w-full gap-4 rounded-2xl border p-5 text-left transition sm:grid-cols-[0.35fr_1fr] sm:items-center ${activePrinciple === principle.key ? "border-[#4ea1ff] bg-[#151d2d]" : "border-white/10 bg-white/[0.03] hover:border-white/30"}`}><span className="text-xs font-bold uppercase tracking-[0.2em] text-[#62b0ff]">{principle.label}</span><span className="text-lg font-semibold text-slate-200 group-hover:text-white">{principle.title}</span></button>)}<div className="mt-2 rounded-2xl border border-[#4ea1ff]/30 bg-[#4ea1ff]/10 p-6"><p className="text-base leading-relaxed text-slate-200">{selectedPrinciple.text}</p></div></div></div></section>
      </div>
    </main>
  );
}

export default QuienesSomos;