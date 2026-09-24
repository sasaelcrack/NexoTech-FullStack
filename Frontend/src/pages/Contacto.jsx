import { IconMail, IconMapPin, IconPhone } from "../components/icons";

function Contacto() {
  return (
    <main className="min-h-[calc(100vh-80px)] overflow-hidden bg-[#0b0d14] px-6 py-14 text-white sm:px-10 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <section className="grid gap-10 border-b border-white/10 pb-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.28em] text-[#62b0ff]">NexoTech / Contacto</p>
            <h1 className="font-display text-5xl font-bold leading-none tracking-tight sm:text-7xl">Hagamos que algo <span className="text-[#4ea1ff]">pase.</span></h1>
          </div>
          <p className="max-w-xl text-lg leading-relaxed text-slate-300">Cuéntanos qué tienes en mente. Estamos listos para escuchar el reto, ordenar las ideas y encontrar el siguiente paso.</p>
        </section>

        <section className="grid gap-8 py-14 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="flex flex-col justify-between rounded-[1.75rem] border border-white/10 bg-[#151925] p-7 sm:p-9">
            <div>
              <p className="text-sm font-semibold text-[#62b0ff]">Estamos aquí para ayudarte</p>
              <h2 className="mt-3 text-3xl font-bold">Conversemos sin complicaciones.</h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">Elige el canal que te resulte más cómodo y te responderemos con la atención que tu proyecto merece.</p>
            </div>
            <div className="mt-10 space-y-3">
              <a href="mailto:contacto@nexotech.com" className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-1 hover:border-[#4ea1ff]/60">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4ea1ff]/15 text-[#62b0ff]"><span className="h-5 w-5">{IconMail}</span></span>
                <span><small className="block text-xs text-slate-500">Correo electrónico</small><strong className="text-sm text-slate-200">contacto@nexotech.com</strong></span>
              </a>
              <a href="tel:+575684584215" className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-1 hover:border-[#4ea1ff]/60">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4ea1ff]/15 text-[#62b0ff]"><span className="h-5 w-5">{IconPhone}</span></span>
                <span><small className="block text-xs text-slate-500">Línea directa</small><strong className="text-sm text-slate-200">+57 568 458 4215</strong></span>
              </a>
              <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4ea1ff]/15 text-[#62b0ff]"><span className="h-5 w-5">{IconMapPin}</span></span>
                <span><small className="block text-xs text-slate-500">Estamos en</small><strong className="text-sm text-slate-200">Medellín, Colombia</strong></span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.75rem] border border-[#4ea1ff]/20 bg-[#101827] p-7 sm:p-10">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#2387ff]/15 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#62b0ff]">Primer paso</p>
              <h2 className="mt-3 text-3xl font-bold">¿Tienes un proyecto en mente?</h2>
              <p className="mt-4 max-w-lg text-slate-300">Escríbenos directamente y cuéntanos qué necesitas. Podemos hablar de desarrollo, diseño, automatización o una idea que apenas está comenzando.</p>
              <a href="mailto:contacto@nexotech.com?subject=Quiero%20hablar%20con%20NexoTech" className="mt-8 inline-flex rounded-full bg-[#4ea1ff] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#4ea1ff]/20 transition hover:-translate-y-1 hover:bg-[#6ab8ff]">Enviar un correo <span className="ml-3">↗</span></a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default Contacto;