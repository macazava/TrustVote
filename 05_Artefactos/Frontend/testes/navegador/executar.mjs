// Testes do site num Chrome real (computador, tablet e telemóvel), com a stack a correr:
//   cd Frontend; npm run test:navegador          (ou: SITE=http://127.0.0.1:8081 npm run test:navegador)
// Usa as contas de demonstração (Infraestrutura\stack.cmd up) e não altera dados:
// o boletim é preenchido até ao passo de confirmação, sem depositar o voto.
import { abrirChrome, espera } from "./chrome.mjs";

const SITE = (process.env.SITE || "http://127.0.0.1:8080").replace(/\/$/, "");
const PASSWORD = process.env.DEMO_PASSWORD || "Demonstracao2026";
const ECRAS = {
  computador: { largura: 1366, altura: 900, telemovel: false },
  tablet: { largura: 820, altura: 1180, telemovel: true },
  telemovel: { largura: 390, altura: 844, telemovel: true },
};

// Página → elemento que tem de ficar com dados vindos da API (e o texto esperado)
const PUBLICAS = {
  inicio: [".metrics", /\d+\s*ESTUDANTES ELEGÍVEIS/i],
  calendario: ["[data-calendar-live]", /\S/],
  listas: ["[data-candidates], .section-content", /Lista|candidaturas/i],
  comunicacao: ["[data-news]", /\S/],
  historico: ["[data-history]", /\S/],
  resultados: ["[data-results]", /\S/],
  ajuda: ["main", /Perguntas frequentes/],
  "como-funciona": ["main", /COMO FUNCIONA/i],
  acessibilidade: ["main", /Acessibilidade/],
  privacidade: ["main", /dura \d+ minutos/],
  login: ["[data-server-status]", /Servidor disponível/],
};
const AREAS = {
  eleitor: { email: "eleitor01@trustvote.pt", vistas: ["overview", "elections", "poll", "receipts", "results", "help", "profile"] },
  equipa: { email: "equipa@trustvote.pt", vistas: ["overview", "elections", "candidates", "voters", "results", "audit", "settings"] },
};

let falhas = 0;
const ok = (nome, passou, detalhe = "") => {
  console.log(`${passou ? "OK   " : "FALHA"} ${nome}${passou || !detalhe ? "" : `  →  ${detalhe}`}`);
  if (!passou) falhas++;
};

// Verificações comuns a qualquer ecrã: largura, imagens e rótulos
const VERIFICAR_ECRA = `(() => {
  const larguraExtra = document.documentElement.scrollWidth - window.innerWidth;
  const semAlt = [...document.images].filter((i) => !i.hasAttribute("alt")).map((i) => i.src.split("/").pop());
  const semRotulo = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")]
    .filter((c) => c.offsetParent !== null)
    .filter((c) => !c.closest("label") && !c.getAttribute("aria-label") && !(c.id && document.querySelector('label[for="' + c.id + '"]')))
    .map((c) => c.name || c.type);
  return { larguraExtra, semAlt, semRotulo };
})()`;

async function verificarEcra(chrome, nome) {
  const r = await chrome.avaliar(VERIFICAR_ECRA);
  ok(`${nome}: cabe no ecrã (sem deslocar para o lado)`, r.larguraExtra <= 1, `${r.larguraExtra}px a mais`);
  ok(`${nome}: imagens com texto alternativo`, !r.semAlt.length, r.semAlt.join(", "));
  ok(`${nome}: campos com rótulo`, !r.semRotulo.length, r.semRotulo.join(", "));
  const problemas = chrome.problemas();
  ok(`${nome}: sem pedidos falhados nem erros de JavaScript`, !problemas.length, problemas.join(" | "));
}

const texto = (chrome, seletor) =>
  chrome.avaliar(`[...document.querySelectorAll(${JSON.stringify(seletor)})].map((e) => e.innerText).join(" ")`);

async function entrar(chrome, area, email) {
  await chrome.cdp("Storage.clearDataForOrigin", { origin: SITE, storageTypes: "all" });
  await chrome.abrir(`${SITE}/pages/login.html?area=${area}`, 1500);
  await chrome.avaliar(`(() => { const f = document.querySelector("#auth-form");
    f.email.value = ${JSON.stringify(email)}; f.password.value = ${JSON.stringify(PASSWORD)};
    f.requestSubmit(); return true; })()`);
  await espera(4000);
  return chrome.avaliar("location.pathname");
}

const chrome = await abrirChrome();
try {
  const saude = await fetch(`${SITE}/api/health`).then((r) => r.ok, () => false);
  if (!saude) throw new Error(`O site não responde em ${SITE}. Arranque a stack: Infraestrutura\\stack.cmd up`);

  for (const [ecra, { largura, altura, telemovel }] of Object.entries(ECRAS)) {
    console.log(`\n===== ${ecra} (${largura}×${altura}) =====`);
    await chrome.ecra(largura, altura, telemovel);

    for (const [pagina, [seletor, esperado]] of Object.entries(PUBLICAS)) {
      await chrome.abrir(`${SITE}/pages/${pagina}.html`, 2500);
      const t = await texto(chrome, seletor);
      ok(`${ecra} · ${pagina}: dados da plataforma`, esperado.test(t), t.replace(/\s+/g, " ").slice(0, 80));
      await verificarEcra(chrome, `${ecra} · ${pagina}`);
    }

    if (telemovel) {
      await chrome.abrir(`${SITE}/pages/inicio.html`, 1500);
      const menu = await chrome.avaliar(`(() => { const b = document.querySelector(".menu-toggle"), n = document.querySelector(".main-nav");
        if (!b || getComputedStyle(b).display === "none") return "sem botão";
        b.click(); const aberto = n.classList.contains("open") && b.getAttribute("aria-expanded") === "true";
        b.click(); const fechado = !n.classList.contains("open"); return aberto && fechado ? "ok" : "não abre/fecha"; })()`);
      ok(`${ecra} · menu ☰ abre e fecha`, menu === "ok", menu);
    }

    for (const [area, { email, vistas }] of Object.entries(AREAS)) {
      const destino = await entrar(chrome, area, email);
      ok(`${ecra} · login ${area}`, destino.endsWith(`${area}.html`), destino);
      for (const vista of vistas) {
        await chrome.avaliar(`document.querySelector('.panel-nav [data-view="${vista}"]').click(); true`);
        await espera(1200);
        const conteudo = await chrome.avaliar(`(() => { const p = document.querySelector('[data-panel="${vista}"]');
          return p.innerText + " " + [...p.querySelectorAll("input")].map((i) => i.value).join(" "); })()`);
        const aCarregar = /A carregar|Não foi possível carregar/.test(conteudo);
        ok(`${ecra} · ${area} · ${vista}: separador com conteúdo`, conteudo.trim().length > 20 && !aCarregar, conteudo.slice(0, 80));
      }
      await verificarEcra(chrome, `${ecra} · ${area}`);
    }

    // Boletim até à confirmação (sem depositar), com um eleitor que ainda não votou
    let boletim = "nenhum eleitor de demonstração tem votação aberta por votar";
    for (let n = 2; n <= 20 && boletim.startsWith("nenhum"); n++) {
      await entrar(chrome, "eleitor", `eleitor${String(n).padStart(2, "0")}@trustvote.pt`);
      const temVoto = await chrome.avaliar(`!!document.querySelector('[data-panel="overview"] [data-vote]')`);
      if (!temVoto) continue;
      await chrome.avaliar(`document.querySelector('[data-panel="overview"] [data-vote]').click(); true`);
      await espera(1500);
      boletim = await chrome.avaliar(`(() => { const f = document.querySelector("[data-ballot]"); if (!f) return "boletim não abriu";
        const opcao = f.querySelector('input[name="candidate"]:not([value="branco"])'); if (!opcao) return "sem candidatos";
        opcao.click(); f.requestSubmit(); return "ok"; })()`);
      await espera(800);
      if (boletim === "ok") {
        const revisao = await chrome.avaliar(`!!document.querySelector("[data-deposit]") && /Confirma a tua escolha/.test(document.body.innerText)`);
        boletim = revisao ? "ok" : "não chegou ao passo de confirmação";
      }
    }
    ok(`${ecra} · boletim: escolher e rever (sem depositar)`, boletim === "ok", boletim);
  }
} catch (erro) {
  ok("execução dos testes", false, erro.message);
} finally {
  await chrome.fechar();
}
console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os testes no navegador passaram.");
process.exit(falhas ? 1 : 0);
