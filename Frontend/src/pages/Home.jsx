import Carousel from "../components/Carousel";
import img2 from "../assets/images/2.png";
import img6 from "../assets/images/6.png";

function Home() {
  return (
    <main className="min-h-[calc(100vh-80px)] overflow-hidden bg-[#0b0d14] text-white">
      <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 sm:px-10 sm:pt-20">
        <div className="absolute -right-32 top-8 h-80 w-80 rounded-full bg-[#2387ff]/10 blur-3xl" />
        <div className="relative grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <p className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-[#62b0ff]">
              <span className="h-px w-10 bg-[#62b0ff]" /> Tecnología con propósito
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">
              Ideas que se convierten en <span className="text-[#4ea1ff]">impacto.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-300">
              Diseñamos soluciones digitales claras, útiles y preparadas para que tu negocio avance con confianza.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#proyectos" className="rounded-full bg-[#4ea1ff] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#4ea1ff]/20 transition hover:-translate-y-1 hover:bg-[#6ab8ff]">
                Conoce nuestro trabajo
              </a>
              <a href="/contacto" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-[#4ea1ff] hover:text-white">
                Hablemos de tu idea <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="mt-12 grid max-w-md grid-cols-3 gap-5 border-t border-white/10 pt-5">
              <div><strong className="block text-2xl text-white">10+</strong><span className="text-xs text-slate-400">Historias visuales</span></div>
              <div><strong className="block text-2xl text-white">100%</strong><span className="text-xs text-slate-400">Compromiso</span></div>
              <div><strong className="block text-2xl text-white">24/7</strong><span className="text-xs text-slate-400">Pensando soluciones</span></div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl">
            <div className="absolute -left-5 top-10 z-10 hidden rounded-2xl border border-white/15 bg-[#171b28]/90 p-4 shadow-2xl backdrop-blur sm:block">
              <span className="mb-2 block text-xs text-slate-400">Nuestro enfoque</span>
              <strong className="text-sm text-white">Humano + digital</strong>
            </div>
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#171b28] p-2 shadow-2xl shadow-black/40">
              <img src={img2} alt="Equipo trabajando en una solución tecnológica" className="h-[390px] w-full rounded-[1.5rem] object-cover sm:h-[500px]" />
              <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/20 bg-[#0b0d14]/75 p-5 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#62b0ff]">NexoTech / 2026</p>
                <p className="mt-1 text-xl font-bold">Construimos lo que sigue.</p>
              </div>
            </div>
            <img src={img6} alt="Espacio de trabajo de NexoTech" className="absolute -bottom-8 -right-5 hidden h-28 w-40 rounded-2xl border-4 border-[#0b0d14] object-cover shadow-xl sm:block" />
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0b1220]/70 px-6 py-14 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">Cómo pensamos</p>
            <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Claridad para avanzar.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <article className="nt-card p-6 md:col-span-2">
              <span className="mb-10 flex h-11 w-11 items-center justify-center rounded-xl bg-[#4ea1ff]/15 text-xl text-[#8ac7ff]">↗</span>
              <h3 className="text-xl font-semibold text-white">Soluciones digitales claras</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Diseñamos experiencias útiles, preparadas para que cada decisión tenga un siguiente paso.</p>
            </article>
            <article className="nt-card p-6">
              <span className="mb-10 flex h-11 w-11 items-center justify-center rounded-xl bg-[#54d7e8]/15 text-xl text-[#54d7e8]">✦</span>
              <h3 className="text-xl font-semibold text-white">Tecnología con propósito</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Curiosidad, cuidado por los detalles y trabajo en equipo.</p>
            </article>
            <article className="nt-card p-6">
              <span className="mb-10 flex h-11 w-11 items-center justify-center rounded-xl bg-[#9d8cff]/15 text-xl text-[#b9adff]">01</span>
              <h3 className="text-xl font-semibold text-white">Escuchar primero</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">Cada proyecto nace de entender el reto antes de construir.</p>
            </article>
            <article className="nt-card p-6 md:col-span-2">
              <span className="mb-10 flex h-11 w-11 items-center justify-center rounded-xl bg-[#4ea1ff]/15 text-xl text-[#8ac7ff]">◇</span>
              <h3 className="text-xl font-semibold text-white">Diseño que deja huella</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Unimos estrategia, diseño y desarrollo para convertir ideas complejas en experiencias que se entienden.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="proyectos" className="border-t border-white/10 bg-[#10131d] px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">Lo que nos mueve</p><h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Una mirada a nuestro universo</h2></div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">Personas, ideas y tecnología trabajando en la misma dirección.</p>
          </div>
          <Carousel />
        </div>
      </section>

      <section className="px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 overflow-hidden rounded-3xl border border-[#4ea1ff]/25 bg-gradient-to-br from-[#16345a] via-[#101d34] to-[#171531] p-8 sm:flex-row sm:items-center sm:p-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8ac7ff]">El siguiente paso</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-bold text-white sm:text-4xl">Tu idea merece una forma clara de empezar.</h2>
          </div>
          <a href="/contacto" className="shrink-0 rounded-xl border border-white/20 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.14]">Hablemos <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </main>
  );
}

export default Home;