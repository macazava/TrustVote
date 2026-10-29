/* Controller · comum a todas as páginas: texto maior e contraste, menu ativo, temas das secções, imprimir/partilhar e links da sessão */

// ===== Texto maior e contraste (guardados no navegador) =====
// Único sítio que trata estas preferências: as áreas do eleitor e da equipa usam TrustVote.prefs
(function () {
  const PREFS_KEY = "trustvote:preferencias";

  function readPrefs() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function applyPrefs(prefs = readPrefs()) {
    document.body.classList.toggle("large-text", !!prefs.largeText);
    document.body.classList.toggle("high-contrast", !!prefs.contrast);
    document.querySelectorAll("[data-font-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(!!prefs.largeText)));
    document.querySelectorAll("[data-contrast-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(!!prefs.contrast)));
    document.querySelectorAll("[data-pref]").forEach((b) => b.setAttribute("aria-pressed", String(!!prefs[b.dataset.pref])));
    const large = document.querySelector("#large-text");
    const contrast = document.querySelector("#contrast");
    if (large) large.checked = !!prefs.largeText;
    if (contrast) contrast.checked = !!prefs.contrast;
  }

  function savePrefs(change) {
    const prefs = { ...readPrefs(), ...change };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch { }
    applyPrefs(prefs);
  }

  window.TrustVote.prefs = { read: readPrefs, apply: applyPrefs, save: savePrefs };
})();

document.addEventListener("DOMContentLoaded", () => {
  const { session, prefs } = window.TrustVote;
  const readPrefs = prefs.read;
  const savePrefs = prefs.save;

  prefs.apply();

  document.querySelectorAll("[data-font-toggle]").forEach((button) =>
    button.addEventListener("click", () => savePrefs({ largeText: !readPrefs().largeText }))
  );
  document.querySelectorAll("[data-contrast-toggle]").forEach((button) =>
    button.addEventListener("click", () => savePrefs({ contrast: !readPrefs().contrast }))
  );
  document.querySelector("#large-text")?.addEventListener("change", (e) => savePrefs({ largeText: e.target.checked }));
  document.querySelector("#contrast")?.addEventListener("change", (e) => savePrefs({ contrast: e.target.checked }));

  // ===== Página atual no menu =====
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".main-nav a").forEach((link) => {
    if (link.getAttribute("href") === current) link.setAttribute("aria-current", "page");
  });

  // ===== Páginas das secções: um tema de cada vez =====
  const items = [...document.querySelectorAll(".section-item[data-item]")];
  if (items.length) {
    const menu = [...document.querySelectorAll(".side-menu a")];
    const crumb = document.querySelector("[data-crumb-current]");
    const visit = document.querySelector("[data-visit-also]");

    const show = (slug) => {
      const index = Math.max(0, items.findIndex((item) => item.id === slug));
      items.forEach((item, i) => (item.hidden = i !== index));
      menu.forEach((link, i) => (i === index ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current")));
      if (crumb) crumb.textContent = items[index].querySelector("h1").textContent;
      if (visit) {
        const others = [...new Set([items[(index + 1) % items.length], items[(index + 2) % items.length]])].filter((x) => x !== items[index]);
        visit.hidden = !others.length;
        visit.innerHTML = `<h2>Visite também</h2><ul>${others
          .map((x) => `<li><a href="#${x.id}">${x.querySelector("h1").textContent}</a></li>`)
          .join("")}</ul>`;
      }
    };

    show(window.location.hash.slice(1));
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      const slug = link && link.getAttribute("href").slice(1);
      if (!slug || !items.some((item) => item.id === slug)) return;
      event.preventDefault();
      history.replaceState(null, "", `#${slug}`);
      show(slug);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("hashchange", () => {
      show(window.location.hash.slice(1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  document.querySelectorAll("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));
  document.querySelectorAll("[data-share]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        if (navigator.share) await navigator.share({ title: document.title, url: window.location.href });
        else {
          await navigator.clipboard.writeText(window.location.href);
          window.TrustVote.ui.toast("Ligação copiada.");
        }
      } catch {}
    })
  );

  // ===== Com sessão iniciada, os links levam direto ao painel =====
  const claims = session.claims();
  if (claims) {
    const panel = claims.perfil === "administrador" ? "equipa.html" : "eleitor.html";
    document.querySelectorAll("[data-voter-link]").forEach((link) => {
      link.href = window.TrustVote.pageUrl(panel);
    });
    // Mostra que a sessão já está iniciada (ex.: "Entrar para votar" passa a "Continuar na minha área")
    document.querySelectorAll("[data-voter-label]").forEach((link) => {
      link.innerHTML = `${window.TrustVote.format.escapeHtml(link.dataset.voterLabel)} <span>→</span>`;
    });
  }
});
