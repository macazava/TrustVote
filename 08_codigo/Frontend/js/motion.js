/* TrustVote · movimento partilhado por todas as páginas (sem bibliotecas). Só apresentação.
   O CSS está em css/componentes/animacoes.css (secção "Motion"); os tokens em base/variaveis.css.

   - cabeçalho com borda/sombra subtil depois de algum scroll
   - entrada do conteúdo principal (fade + 12px, 400 ms, 60 ms entre elementos); cabeçalho e menu lateral não animam
   - revelação ao scroll com IntersectionObserver (uma vez, threshold 0.15): cartões, linhas de tabela,
     linha do tempo, secções; nas listas 60 ms entre itens e no máximo 8 animados
   - barras de progresso e de resultados que crescem de 0 (scaleX) quando entram no ecrã
   - percentagens e totais que contam até ao valor (~900 ms)
   - contadores "Termina em" com um crossfade curto quando o valor muda
   - indicador do menu lateral que desliza até ao item ativo
   - separadores das áreas reservadas com entrada suave
   Com prefers-reduced-motion nada disto corre (o CSS também desliga as transições). */
(function () {
  "use strict";

  const raiz = document.documentElement;
  raiz.classList.add("js");
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = "cubic-bezier(0.2, 0.7, 0.2, 1)";

  document.addEventListener("DOMContentLoaded", () => {
    // ===== Cabeçalho: borda e sombra subtis depois de algum scroll =====
    const cabecalhos = document.querySelectorAll(".site-header, .dashboard-header");
    const marcarScroll = () => cabecalhos.forEach((h) => h.classList.toggle("is-scrolled", window.scrollY > 4));
    addEventListener("scroll", marcarScroll, { passive: true });
    marcarScroll();

    // ===== Indicador do menu lateral =====
    // Funciona também sem movimento (só a transição é que fica desligada)
    document.querySelectorAll(".side-menu nav").forEach((nav) => {
      const posicionar = () => {
        const atual = nav.querySelector('a[aria-current="page"]');
        if (!atual) return nav.classList.remove("has-indicator");
        nav.style.setProperty("--tv-ind-y", `${atual.offsetTop}px`);
        nav.style.setProperty("--tv-ind-h", `${atual.offsetHeight}px`);
        nav.classList.add("has-indicator");
      };
      new MutationObserver(posicionar).observe(nav, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
      addEventListener("resize", posicionar);
      posicionar();
    });

    if (reduzido || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;

    const inicio = Date.now();
    let ultimaAcao = 0;
    let aEscrever = false;
    ["pointerdown", "keydown"].forEach((t) =>
      document.addEventListener(
        t,
        (event) => {
          ultimaAcao = Date.now();
          // Escrever numa pesquisa ou num formulário redesenha listas a cada tecla: aí nada anima
          aEscrever = t === "keydown" && !!event.target.closest?.("input, textarea, select");
        },
        true
      )
    );
    // Nas áreas reservadas o conteúdo atualiza-se sozinho (ex.: a cada 20 s): só se anima o que aparece
    // por ação do utilizador ou no arranque, para nada "piscar" a cada atualização
    const podeAnimar = (el) =>
      !el.closest(".view-panel") || (!aEscrever && Date.now() - ultimaAcao < 1500) || Date.now() - inicio < 4000;

    // ===== Entrada do conteúdo principal =====
    const entrada = [
      ".hero-copy > *",
      ".section-item:not([hidden]) > *",
      ".content-page > *",
      ".press-bar > *",
      ".legal-hero .container > *",
      ".auth-intro > *",
      ".auth-card",
      ".view-panel.active > *",
    ];
    const paraEntrar = [];
    entrada.forEach((sel) => document.querySelectorAll(sel).forEach((el) => paraEntrar.length < 40 && !paraEntrar.includes(el) && paraEntrar.push(el)));
    // Só os primeiros elementos de cada bloco (título, introdução, primeiro bloco)
    const porBloco = new Map();
    paraEntrar.forEach((el) => {
      const bloco = el.parentElement;
      const n = porBloco.get(bloco) || 0;
      porBloco.set(bloco, n + 1);
      if (n >= 3) return;
      el.classList.add("tv-enter");
      el.style.setProperty("--tv-delay", `${n * 60}ms`);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll(".tv-enter").forEach((el) => el.classList.add("is-in"))));

    // ===== Revelação ao scroll =====
    // [seletor, grupo]: dentro do mesmo grupo, 60 ms entre itens e no máximo 8 animados
    const revelar = [
      [".section-heading", null],
      [".steps-list > li", ".steps-list"],
      [".faq-list > details", ".faq-list"],
      [".hero-trust > li", ".hero-trust"],
      [".admin-metrics > *", ".admin-metrics"],
      [".election-rows > *", ".election-rows"],
      [".candidate-grid > *", ".candidate-grid"],
      [".timeline > article", ".timeline"],
      [".info-list > article", ".info-list"],
      [".news-list > a", ".news-list"],
      [".press-featured > article", ".press-featured"],
      [".press-news > article", ".press-news"],
      [".history-period", ".history-list"],
      [".team-grid > li", ".team-grid"],
      [".about-values > li", ".about-values"],
      [".election-info > *", ".election-info"],
      [".hub-card", null],
      [".security-grid > *", ".security-grid"],
      [".platform-grid > *", ".platform-grid"],
      [".legal-doc > section", null],
      [".verify-layout > *", ".verify-layout"],
      [".results-board, .results-pending", null],
      // Área da equipa: indicadores, cartões, listas e cronologia
      [".voter-stats > *", ".voter-stats"],
      [".cand-grid > *", ".cand-grid"],
      [".people-list > *", ".people-list"],
      [".enroll-grid > *", ".enroll-grid"],
      [".rank-list > li", ".rank-list"],
      [".inbox-items > *", ".inbox-items"],
      [".audit-entry", ".audit-timeline"],
      [".builder-step", ".builder-main"],
      [".result-outcome, .donut", null],
      ["tbody > tr", "tbody"],
    ];

    const observador = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          observador.unobserve(e.target);
        }),
      { threshold: 0.15 }
    );

    function registarReveal(contexto = document) {
      revelar.forEach(([sel, grupo]) => {
        const lista = [...contexto.querySelectorAll(sel)];
        if (contexto !== document && contexto.matches && contexto.matches(sel)) lista.unshift(contexto);
        lista.forEach((el) => {
          if (el.classList.contains("tv-reveal") || el.classList.contains("tv-enter") || !podeAnimar(el)) return;
          if (el.closest(".view-panel") && Date.now() - inicio >= 4000 && (aEscrever || Date.now() - ultimaAcao >= 1500)) return;
          const pai = grupo ? el.closest(grupo) : null;
          const i = pai ? [...pai.querySelectorAll(sel)].indexOf(el) : 0;
          // A partir do 9.º item de uma lista, aparecem logo
          if (i >= 8) return;
          el.classList.add("tv-reveal");
          el.style.setProperty("--tv-delay", `${i * 60}ms`);
          observador.observe(el);
        });
      });
    }
    registarReveal();

    // ===== Barras: crescem de 0 até ao valor (scaleX) =====
    const seletorBarras = ".bar > i, .el-period-bar > i, .results-turnout-bar > i, .bar-chart-track > i, .poll-bar > i, .column-chart-track > i, .rank-track > i, .kpi-bar > i, .enroll-progress .preview-track > span";
    const barras = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          barras.unobserve(e.target);
          const vertical = !!e.target.closest(".column-chart-track");
          e.target.animate(
            [{ transform: vertical ? "scaleY(0)" : "scaleX(0)" }, { transform: "none" }],
            { duration: 900, easing: ease }
          );
        }),
      { threshold: 0.15 }
    );
    const registarBarras = (contexto = document) =>
      contexto.querySelectorAll(seletorBarras).forEach((b) => {
        if ("tvBar" in b.dataset || !podeAnimar(b)) return;
        b.dataset.tvBar = "";
        b.style.transformOrigin = b.closest(".column-chart-track") ? "bottom" : "left";
        barras.observe(b);
      });
    registarBarras();

    // ===== Números que contam até ao valor (~800 ms) =====
    const seletorNumeros =
      ".metric-card b, .turnout > b, .hub-progress b, .bar-chart-value > b, .column-chart-item > b, .profile-numbers b, .history-stats dd, .history-turnout b, .el-summary b, .facts b, .results-figures b, .results-value > b, .voter-stat > b, .rank-value > b, .donut-center b, .cand-count b, .enroll-progress-text b, [data-live]";
    const padrao = /^(\s*)(\d{1,3}(?:[\s  .]?\d{3})*(?:,\d+)?)(.*)$/s;
    function contar(el) {
      const texto = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
      const m = texto && texto.textContent.match(padrao);
      if (!m) return;
      const [, antes, bruto, depois] = m;
      const casas = (bruto.split(",")[1] || "").length;
      const alvo = parseFloat(bruto.replace(/[\s  .]/g, "").replace(",", "."));
      if (!isFinite(alvo) || alvo === 0) return;
      const fmt = new Intl.NumberFormat("pt-PT", { minimumFractionDigits: casas, maximumFractionDigits: casas });
      const t0 = performance.now();
      const passo = (agora) => {
        if (!texto.isConnected) return;
        const t = Math.min(1, (agora - t0) / 900);
        texto.textContent = `${antes}${fmt.format(alvo * (1 - Math.pow(1 - t, 3)))}${depois}`;
        if (t < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    }
    const numeros = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          numeros.unobserve(e.target);
          contar(e.target);
        }),
      { threshold: 0.15 }
    );
    const registarNumeros = (contexto = document) =>
      contexto.querySelectorAll(seletorNumeros).forEach((el) => {
        if ("tvCount" in el.dataset || !podeAnimar(el)) return;
        el.dataset.tvCount = "";
        numeros.observe(el);
      });
    registarNumeros();

    // ===== Conteúdo que chega depois da API =====
    let pendente = 0;
    let novos = [];
    new MutationObserver((mutacoes) => {
      mutacoes.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && novos.push(n)));
      if (!novos.length) return;
      clearTimeout(pendente);
      pendente = setTimeout(() => {
        const lote = novos.filter((n) => n.isConnected);
        novos = [];
        lote.forEach((n) => {
          registarReveal(n);
          registarBarras(n);
          registarNumeros(n);
        });
      }, 30);
    }).observe(document.querySelector("main") || document.body, { childList: true, subtree: true });

    // ===== Contadores "Termina em": crossfade curto quando o valor muda =====
    const valores = new WeakMap();
    new MutationObserver((mutacoes) => {
      mutacoes.forEach((m) => {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!el || !el.matches || !el.matches("[data-countdown]")) return;
        const texto = el.textContent;
        if (valores.has(el) && valores.get(el) !== texto) {
          el.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 240, easing: ease });
        }
        valores.set(el, texto);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true });

    // ===== Áreas reservadas: ao abrir um separador, o conteúdo entra em camadas =====
    document.querySelectorAll(".view-panel").forEach((painel) =>
      new MutationObserver(() => {
        if (!painel.classList.contains("active") || Date.now() - ultimaAcao > 1000) return;
        [...painel.children].slice(0, 6).forEach((filho, i) =>
          filho.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], {
            duration: 400,
            delay: i * 60,
            easing: ease,
            fill: "backwards",
          })
        );
      }).observe(painel, { attributes: true, attributeFilter: ["class"] })
    );
  });
})();
