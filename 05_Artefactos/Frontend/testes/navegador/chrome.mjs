// Controla um Chrome real (sem janela) pelo DevTools Protocol, sem instalar nada:
// usa o Chrome do PC e o WebSocket do Node (18+). Usado pelos testes no navegador.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CAMINHOS = [
  process.env.CHROME,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export async function abrirChrome() {
  const executavel = CAMINHOS.find((c) => existsSync(c));
  if (!executavel) throw new Error("Não encontrei o Chrome nem o Edge (ou defina a variável CHROME).");
  const perfil = mkdtempSync(join(tmpdir(), "trustvote-testes-"));
  const porta = 9300 + Math.floor(Math.random() * 500);
  const processo = spawn(executavel, ["--headless=new", "--disable-gpu", "--no-first-run",
    `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, "about:blank"], { stdio: "ignore" });

  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const alvos = await (await fetch(`http://127.0.0.1:${porta}/json`)).json();
      const pagina = alvos.find((a) => a.type === "page");
      if (pagina) ws = new WebSocket(pagina.webSocketDebuggerUrl);
    } catch { /* ainda a arrancar */ }
    if (!ws) await espera(250);
  }
  if (!ws) throw new Error("O Chrome não arrancou.");
  await new Promise((r) => ws.addEventListener("open", r));

  let id = 0;
  const pendentes = new Map();
  const eventos = [];
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pendentes.has(d.id)) {
      pendentes.get(d.id)(d.result ?? { erro: d.error });
      pendentes.delete(d.id);
    } else if (d.method === "Page.javascriptDialogOpening") {
      // Uma janela alert/confirm bloqueia a página até alguém responder: fecha-a logo
      eventos.push(d);
      ws.send(JSON.stringify({ id: ++id, method: "Page.handleJavaScriptDialog", params: { accept: false } }));
    } else if (d.method) eventos.push(d);
  });
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      const n = ++id;
      pendentes.set(n, r);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await cdp("Network.enable");
  await cdp("Runtime.enable");
  await cdp("Page.enable");

  const chrome = {
    cdp,
    eventos,
    // Corre uma expressão na página e devolve o valor
    async avaliar(expr) {
      const r = await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro na página");
      return r.result.value;
    },
    async abrir(url, ms = 3000) {
      eventos.length = 0;
      await cdp("Page.navigate", { url });
      await espera(ms);
    },
    // Tamanho do ecrã: telemóvel (com toque) ou computador
    async ecra(largura, altura, telemovel = false) {
      await cdp("Emulation.setDeviceMetricsOverride", { width: largura, height: altura, deviceScaleFactor: telemovel ? 3 : 1, mobile: telemovel });
      await cdp("Emulation.setTouchEmulationEnabled", { enabled: telemovel });
    },
    // Pedidos à API que falharam e erros de JavaScript desde a última navegação
    problemas() {
      const urls = new Map();
      for (const e of eventos) if (e.method === "Network.requestWillBeSent") urls.set(e.params.requestId, e.params.request.url);
      const rede = eventos
        .filter((e) => e.method === "Network.loadingFailed" && !e.params.canceled)
        .map((e) => `${urls.get(e.params.requestId)} → ${e.params.errorText}`);
      const js = eventos
        .filter((e) => e.method === "Runtime.exceptionThrown")
        .map((e) => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text);
      return [...rede, ...js];
    },
    async fechar() {
      ws.close();
      processo.kill();
      await espera(500);
      try { rmSync(perfil, { recursive: true, force: true }); } catch { /* o Chrome ainda a fechar */ }
    },
  };
  return chrome;
}
