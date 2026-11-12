/* Controller · Ajuda → Perguntas frequentes: pesquisa que filtra as perguntas enquanto se escreve */
document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("[data-faq-search]");
  if (!input) return;

  const items = [...document.querySelectorAll("#perguntas-frequentes .faq-list details")];
  const empty = document.querySelector("[data-faq-empty]");
  // Compara sem acentos nem maiúsculas ("eleicao" encontra "eleição")
  const normalizar = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const textos = items.map((item) => normalizar(item.textContent));

  input.addEventListener("input", () => {
    const termos = normalizar(input.value).split(/\s+/).filter(Boolean);
    let visiveis = 0;
    items.forEach((item, i) => {
      const mostra = termos.every((t) => textos[i].includes(t));
      item.hidden = !mostra;
      if (mostra) visiveis += 1;
    });
    if (empty) empty.hidden = visiveis > 0;
  });
});
