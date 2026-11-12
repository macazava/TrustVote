/* View · animações: só as que ajudam a ler os dados. As barras de participação e de resultados crescem
   até ao valor real quando aparecem. Nada de entradas ao fazer scroll, inclinações ou parallax. */
document.addEventListener("DOMContentLoaded", () => {
  if (!("animate" in Element.prototype) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const ease = "cubic-bezier(.2, .8, .2, 1)";
  document.documentElement.classList.add("tv-anim");

  // ===== Barras de participação e resultados: crescem até ao valor real =====
  function growBars(root) {
    root.querySelectorAll(".bar > i").forEach((bar) => {
      const width = bar.style.width || getComputedStyle(bar).width;
      bar.animate([{ width: "0%" }, { width }], { duration: 900, easing: ease });
    });
  }

  // Conteúdo que chega depois da API (resultados, listas, calendário)
  document.querySelectorAll("[data-results], [data-candidates], [data-calendar-live]").forEach((box) =>
    new MutationObserver((mutations) =>
      mutations.forEach((m) => m.addedNodes.forEach((node) => node.nodeType === 1 && growBars(node)))
    ).observe(box.parentElement || box, { childList: true, subtree: true })
  );
});
