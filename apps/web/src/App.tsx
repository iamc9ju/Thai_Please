import { th } from './i18n/th';

const roleCards = [
  th.roles.consumer,
  th.roles.merchant,
  th.roles.administrator,
];

function App() {
  return (
    <main className="min-h-screen bg-surface text-ink">
      <section className="relative isolate overflow-hidden px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(circle_at_top_left,var(--color-brand-soft),transparent_60%)]"
        />

        <div className="mx-auto max-w-6xl">
          <header className="flex items-center justify-between gap-6">
            <a
              className="text-lg font-bold tracking-tight text-brand"
              href="#top"
            >
              {th.brand}
            </a>
            <span className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold text-muted">
              {th.prototypeLabel}
            </span>
          </header>

          <div className="grid gap-12 pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div id="top">
              <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-brand">
                {th.eyebrow}
              </p>
              <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                {th.heroTitle}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
                {th.heroDescription}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  className="rounded-xl bg-brand px-5 py-3 font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-strong focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                  href="#capabilities"
                >
                  {th.primaryAction}
                </a>
                <a
                  className="rounded-xl border border-line bg-panel px-5 py-3 font-bold text-ink transition hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                  href="#flow"
                >
                  {th.secondaryAction}
                </a>
              </div>
            </div>

            <aside
              aria-label={th.flow.ariaLabel}
              className="rounded-3xl border border-line bg-panel p-6 shadow-xl shadow-ink/5"
              id="flow"
            >
              <p className="text-sm font-bold text-brand">{th.flow.title}</p>
              <ol className="mt-5 grid gap-3">
                {th.flow.steps.map((step, index) => (
                  <li className="flex items-center gap-4" key={step}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft font-black text-brand">
                      {index + 1}
                    </span>
                    <span className="font-semibold">{step}</span>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </div>
      </section>

      <section
        className="border-y border-line bg-panel px-6 py-16 sm:px-10 lg:px-16"
        id="capabilities"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
              {th.capabilities.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight">
              {th.capabilities.title}
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {roleCards.map((role) => (
              <article
                className="rounded-2xl border border-line bg-surface p-6"
                key={role.title}
              >
                <h3 className="text-xl font-black">{role.title}</h3>
                <p className="mt-3 leading-7 text-muted">{role.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-6 py-8 text-center text-sm text-muted">
        {th.footer}
      </footer>
    </main>
  );
}

export default App;
