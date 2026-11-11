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

  // ===== "Voltar" para a página de onde se veio (ex.: o formulário de registo) =====
  // Trocar entre Termos e Privacidade substitui a entrada do histórico, por isso um só "voltar" chega à origem.
  const LEGAIS = /(termos|privacidade)\.html$/;
  const CHAVE = "trustvote:legal-origem";
  const guardar = (v) => { try { v ? sessionStorage.setItem(CHAVE, v) : sessionStorage.removeItem(CHAVE); } catch (e) { } };
  const lerGuardada = () => { try { return sessionStorage.getItem(CHAVE); } catch (e) { return null; } };

  let origem = null;
  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (ref && ref.origin === window.location.origin) {
      if (!LEGAIS.test(ref.pathname)) origem = ref.href;
      else origem = lerGuardada(); // veio do outro documento legal: mantém a origem inicial
    }
  } catch (e) { }
  guardar(origem);

  const voltar = document.querySelector("[data-legal-back]");
  if (voltar && origem) {
    if (/login\.html/.test(origem)) voltar.querySelector("span").textContent = "Voltar ao registo";
    voltar.href = origem;
    voltar.hidden = false;
    voltar.addEventListener("click", (e) => {
      e.preventDefault();
      history.back();
    });
  }

  document.querySelectorAll(".legal-switch a:not([aria-current])").forEach((a) =>
    a.addEventListener("click", (e) => {
      if (!origem) return;
      e.preventDefault();
      window.location.replace(a.href);
    })
  );

  document.querySelectorAll("[data-legal-print]").forEach((b) => b.addEventListener("click", () => window.print()));
})();
