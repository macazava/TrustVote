/* Controller · documentos legais (termos.html e privacidade.html):
   realça no índice a secção que está a ser lida, mostra o progresso de leitura e trata do botão "Imprimir". */
(function () {
  "use strict";

  const doc = document.querySelector("[data-legal-doc]");
  if (!doc) return;

  const links = [...document.querySelectorAll("[data-legal-toc] a[href^='#']")];
  const seccoes = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  const barra = document.querySelector("[data-legal-progress]");

  // Secção atual: a última cujo topo já passou a linha de leitura (um terço do ecrã)
  function atualizar() {
    const linha = window.innerHeight / 3;
    let atual = seccoes[0];
    seccoes.forEach((s) => {
      if (s.getBoundingClientRect().top <= linha) atual = s;
    });
    // No fim da página, a última secção fica ativa mesmo que seja curta
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      atual = seccoes[seccoes.length - 1];
    }
    links.forEach((a) => {
      if (a.hash === `#${atual?.id}`) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });

    if (barra) {
      const caixa = doc.getBoundingClientRect();
      const total = caixa.height - window.innerHeight;
      const lido = total > 0 ? Math.min(1, Math.max(0, -caixa.top / total)) : 1;
      barra.style.width = `${Math.round(lido * 100)}%`;
    }
  }

  let pedido = 0;
  const agendar = () => {
    if (!pedido) pedido = requestAnimationFrame(() => ((pedido = 0), atualizar()));
  };
  window.addEventListener("scroll", agendar, { passive: true });
  window.addEventListener("resize", agendar);
  atualizar();

  document.querySelectorAll("[data-legal-print]").forEach((b) => b.addEventListener("click", () => window.print()));
})();
