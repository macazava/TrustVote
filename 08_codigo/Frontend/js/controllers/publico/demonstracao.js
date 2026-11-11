/* Controller · boletim de demonstração ("Como funciona" → Experimente o boletim)
   Passa pelos três passos do voto sem contactar o servidor. */
document.addEventListener("DOMContentLoaded", () => {
  const TV = window.TrustVote;
  const box = document.querySelector("[data-demo]");
  if (!box) return;
  const view = TV.demoView;

  // Mostra um passo; o foco vai para o título (exceto ao abrir a página)
  const mostrar = (html, focar = true) => {
    box.innerHTML = html;
    if (focar) box.querySelector("h3").focus({ preventScroll: true });
    if (focar) box.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function escolher(escolhido = null, focar = true) {
    mostrar(view.escolher(escolhido), focar);
    box.querySelector("[data-demo-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      const id = event.currentTarget.elements["demo-escolha"].value;
      if (!id) return TV.ui.message(box.querySelector(".form-message"), "Selecione uma candidatura ou o voto em branco.");
      rever(id);
    });
  }

  function rever(id) {
    mostrar(view.rever(id));
    const depositar = box.querySelector("[data-demo-deposit]");
    box.querySelector("[data-demo-confirm]").addEventListener("change", (event) => (depositar.disabled = !event.target.checked));
    box.querySelector("[data-demo-change]").addEventListener("click", () => escolher(id));
    depositar.addEventListener("click", () =>
      // Pequena pausa, como se o voto fosse enviado e selado
      TV.ui.busy(depositar, "A selar o boletim…", () => new Promise((ok) => setTimeout(ok, 900))).then(selado)
    );
  }

  function selado() {
    const hex = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    mostrar(view.selado(`DEMO-${hex}`));
    box.querySelector("[data-demo-restart]").addEventListener("click", () => escolher());
  }

  escolher(null, false);
});
