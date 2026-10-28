/* Animações: revelação ao fazer scroll, profundidade 3D e transições nos painéis (sem alterar o design) */
document.addEventListener("DOMContentLoaded", () => {
  if (!("animate" in Element.prototype) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const desktop = () => matchMedia("(min-width: 768px)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const ease = "cubic-bezier(.2, .8, .2, 1)";
  document.documentElement.classList.add("tv-anim");

  // ===== Tipos de entrada (só transform e opacity) =====
  const variants = {
    rise: [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }],
    left: [{ opacity: 0, transform: "translateX(-24px)" }, { opacity: 1, transform: "none" }],
    zoom: [{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }],
    depth: [{ opacity: 0, transform: "perspective(1000px) translate3d(0, 32px, -90px) rotateX(9deg)" }, { opacity: 1, transform: "perspective(1000px)" }],
    turn: [{ opacity: 0, transform: "perspective(1200px) translateZ(-70px) rotateY(-14deg)" }, { opacity: 1, transform: "perspective(1200px)" }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
  };

  // Elementos de cada página e a forma como entram (a ordem dentro do grupo dá o efeito em camadas)
  const reveals = [
    [".hero-copy > *", "rise", ".hero-copy"],
    [".steps-card", "turn"],
    [".section-heading > div > *, .section-heading > p", "rise", ".section-heading"],
    [".service-grid > a", "rise", ".service-grid"],
    [".metrics > div", "rise", ".metrics"],
    [".photo-panel", "zoom"],
    [".election-copy > *", "rise", ".election-copy"],
    [".hub-card", "depth"],
    [".hub-links > a", "rise", ".hub-links"],
    [".security-card", "fade", ".security-grid"],
    [".platform-grid > article", "depth", ".platform-grid"],
    [".news-grid > article", "depth", ".news-grid"],
    [".news-list > a", "left", ".news-list"],
    [".side-menu, .manager-card", "left", ".section-aside"],
    [".section-content", "rise"],
    [".timeline > article, .candidate-grid > article, .info-list > article", "depth", ".timeline, .candidate-grid, .info-list"],
    [".content-page > *", "rise", ".content-page"],
    [".press-bar, .press-featured > *", "rise", ".press-page"],
    [".press-news > article", "depth", ".press-news"],
    [".history-hero h1", "rise"],
    [".history-period", "depth"],
    [".auth-intro > *", "rise", ".auth-intro"],
    [".auth-card", "turn"],
  ];

  const pending = new WeakMap();
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        play(entry.target, pending.get(entry.target));
      }),
    { rootMargin: "0px 0px -8% 0px" }
  );

  function play(el, { variant, delay }) {
    const animation = el.animate(variants[variant], { duration: variant === "fade" ? 600 : 800, delay, easing: ease, fill: "backwards" });
    el.classList.remove("tv-hidden");
    return animation;
  }

  function register(root = document) {
    reveals.forEach(([selector, variant, group]) => {
      const found = [...root.querySelectorAll(selector)];
      if (root !== document && root.matches(selector)) found.unshift(root);
      found.forEach((el) => {
        if (pending.has(el) || el.closest(".view-panel")) return;
        const parent = group ? el.closest(group) : null;
        const siblings = parent ? [...parent.querySelectorAll(selector)] : [el];
        const delay = Math.min(siblings.indexOf(el), 6) * 90;
        pending.set(el, { variant, delay });
        el.classList.add("tv-hidden");
        observer.observe(el);
      });
    });
  }
  register();

  // Conteúdo que chega depois da API (resultados, listas, calendário)
  document.querySelectorAll("[data-results], [data-candidates], [data-calendar-live], [data-transparency]").forEach((box) =>
    new MutationObserver((mutations) =>
      mutations.forEach((m) =>
        m.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          register(node);
          node.querySelectorAll(".dash-card").forEach((card, i) => card.animate(variants.depth, { duration: 700, delay: i * 120, easing: ease, fill: "backwards" }));
          growBars(node);
        })
      )
    ).observe(box.parentElement || box, { childList: true, subtree: true })
  );

  // ===== Mudança de tema nas páginas das secções =====
  document.querySelectorAll(".section-item[data-item]").forEach((item) =>
    new MutationObserver(() => {
      if (item.hidden) return;
      [...item.children].forEach((child, i) =>
        child.animate(variants.rise, { duration: 600, delay: Math.min(i, 5) * 70, easing: ease, fill: "backwards" })
      );
    }).observe(item, { attributes: true, attributeFilter: ["hidden"] })
  );

  // ===== Barras de participação e resultados: crescem até ao valor real =====
  function growBars(root) {
    root.querySelectorAll(".bar > i").forEach((bar) => {
      const width = bar.style.width || getComputedStyle(bar).width;
      bar.animate([{ width: "0%" }, { width }], { duration: 1100, easing: ease });
    });
  }

  // ===== Inclinação 3D ao passar o cursor =====
  const tiltSelector = ".steps-card, .hub-card, .platform-grid > article, .candidate-grid > article, .press-news > article, .election-card, .metric-card, .receipt-card";
  if (finePointer) {
    document.addEventListener("pointermove", (event) => {
      const card = event.target.closest?.(tiltSelector);
      if (!card || !desktop()) return;
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - 0.5;
      const y = (event.clientY - box.top) / box.height - 0.5;
      // Cartões grandes inclinam menos
      const max = box.width > 520 ? 2.5 : 5;
      // Mantém a subida que alguns cartões já têm ao passar o cursor
      const lift = card.classList.contains("hover:-translate-y-0.5") ? " translateY(-2px)" : "";
      card.style.transition = "transform .2s ease-out, box-shadow .3s";
      card.style.transform = `perspective(900px)${lift} rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
      card.dataset.tilt = "";
    });
    document.addEventListener("pointerout", (event) => {
      const card = event.target.closest?.(tiltSelector);
      if (!card || card.contains(event.relatedTarget) || !("tilt" in card.dataset)) return;
      card.style.transition = `transform .7s ${ease}, box-shadow .3s`;
      card.style.transform = "";
      delete card.dataset.tilt;
    });
  }

  // ===== Parallax e rotação 3D ligados ao scroll =====
  const parallax = [
    ...[...document.querySelectorAll(".photo-panel")].map((el) => ({ el, kind: "move", amount: 18 })),
    ...[...document.querySelectorAll(".news-photo img, .press-hero img")].map((el) => ({ el, kind: "inner", amount: 14 })),
    ...[...document.querySelectorAll(".history-hero")].map((el) => ({ el, kind: "background", amount: 40 })),
    ...[...document.querySelectorAll(".security-card")].map((el) => ({ el, kind: "tilt3d" })),
  ];
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const vh = innerHeight;
      const on = desktop();
      parallax.forEach(({ el, kind, amount }) => {
        // No telemóvel fica só a revelação simples
        if (!on) {
          el.style.transform = "";
          el.style.backgroundPositionY = "";
          return;
        }
        const box = el.getBoundingClientRect();
        if (box.bottom < -100 || box.top > vh + 100) return;
        // -1 quando entra por baixo, 0 no centro do ecrã, 1 quando sai por cima
        const p = Math.max(-1, Math.min(1, (vh / 2 - (box.top + box.height / 2)) / (vh / 2 + box.height / 2)));
        if (kind === "move") el.style.transform = `translate3d(0, ${(p * amount).toFixed(1)}px, 0)`;
        if (kind === "inner") el.style.transform = `scale(1.08) translate3d(0, ${(p * amount).toFixed(1)}px, 0)`;
        if (kind === "background") el.style.backgroundPositionY = `calc(50% + ${(p * amount).toFixed(1)}px)`;
        if (kind === "tilt3d") {
          // Ganha profundidade enquanto sobe até ao centro e fica plano a partir daí
          const rest = Math.max(0, -p);
          el.style.transform = rest ? `perspective(1100px) translate3d(0, ${(rest * 40).toFixed(1)}px, ${(-rest * 80).toFixed(1)}px) rotateX(${(rest * 12).toFixed(2)}deg)` : "";
        }
      });
    });
  }
  if (parallax.length) {
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  }

  // ===== Painéis do eleitor e da equipa =====
  const panels = [...document.querySelectorAll(".view-panel")];
  if (!panels.length) return;

  const panelTargets = ".dash-card, .election-card, .metric-card, .badge-card, .receipt-card, .candidate-list > label, .result-row, .service-item, tbody tr";
  // Só anima o que muda por ação do utilizador; as atualizações automáticas (ex.: a cada 20 s) ficam paradas
  let lastAction = Date.now();
  ["pointerdown", "keydown", "submit"].forEach((type) => document.addEventListener(type, () => (lastAction = Date.now()), true));

  function animatePanel(roots) {
    const seen = new Set();
    roots.forEach((root) => {
      if (root.matches(panelTargets)) seen.add(root);
      root.querySelectorAll(panelTargets).forEach((el) => seen.add(el));
    });
    [...seen].slice(0, 30).forEach((el, i) => {
      const inTable = el.tagName === "TR";
      el.animate(inTable ? variants.fade : [{ opacity: 0, transform: "perspective(1000px) translate3d(0, 16px, -40px)" }, { opacity: 1, transform: "perspective(1000px)" }], {
        duration: inTable ? 400 : 550,
        delay: Math.min(i, 10) * (inTable ? 30 : 60),
        easing: ease,
        fill: "backwards",
      });
    });
    roots.forEach(growBars);
  }

  panels.forEach((panel) => {
    let queue = [];
    new MutationObserver((mutations) => {
      if (Date.now() - lastAction > 4000 || !panel.classList.contains("active")) return;
      mutations.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && queue.push(n)));
      if (queue.length === 0) return;
      requestAnimationFrame(() => {
        const roots = queue.filter((n) => n.isConnected);
        queue = [];
        if (roots.length) animatePanel(roots);
      });
    }).observe(panel, { childList: true, subtree: true });

    // Ao abrir um separador, o conteúdo entra em camadas
    new MutationObserver(() => {
      if (panel.classList.contains("active") && Date.now() - lastAction < 1000) animatePanel([...panel.children]);
    }).observe(panel, { attributes: true, attributeFilter: ["class"] });
  });

  // Boletim: resposta imediata à opção escolhida (as cores ficam as do tema)
  document.addEventListener("change", (event) => {
    const label = event.target.matches?.('input[name="candidate"]') && event.target.closest("label");
    if (label) label.animate([{ transform: "scale(1)" }, { transform: "scale(1.015)" }, { transform: "scale(1)" }], { duration: 260, easing: ease });
  });
});
