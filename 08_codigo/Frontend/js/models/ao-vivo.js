/* Model · dados ao vivo (TrustVote.live): participação da eleição em destaque por Server-Sent Events
   Uma só ligação por página a /api/publico/eventos. O servidor envia uma mensagem sempre que a
   participação muda (e um "ping" a cada 2 s). Se a ligação cair, o browser volta a ligar sozinho;
   se não houver suporte ou o servidor não responder, quem usa este model mantém a atualização periódica.

   TrustVote.live.subscribe((dados) => …)  dados = { eleicao_id, estado, eleitores, votos, participacao } ou null
   TrustVote.live.ligado()                 true enquanto a ligação está aberta */
(function () {
  "use strict";

  const TV = window.TrustVote;
  const ouvintes = new Set();
  let fonte = null;
  let ultimo;
  let aberto = false;

  function ligar() {
    if (fonte || !("EventSource" in window)) return;
    fonte = new EventSource(`${TV.base}/publico/eventos`);
    const avisar = (estado) => document.dispatchEvent(new CustomEvent("trustvote:ao-vivo", { detail: { estado } }));
    fonte.addEventListener("open", () => {
      aberto = true;
      avisar("ok");
      document.documentElement.classList.add("tv-live");
    });
    fonte.addEventListener("error", () => {
      if (aberto) avisar("em-pausa"); // só depois de ter estado ligado: o browser já está a religar
      aberto = false;
      document.documentElement.classList.remove("tv-live");
    });
    fonte.addEventListener("resumo", (event) => {
      try {
        ultimo = JSON.parse(event.data);
      } catch {
        return;
      }
      ouvintes.forEach((fn) => fn(ultimo));
    });
  }

  // Fecha ao sair da página (o browser fecharia na mesma, mas assim liberta logo o servidor)
  window.addEventListener("pagehide", () => {
    if (fonte) fonte.close();
    fonte = null;
  });

  TV.live = {
    subscribe(fn) {
      ouvintes.add(fn);
      if (ultimo !== undefined) fn(ultimo);
      ligar();
      return () => ouvintes.delete(fn);
    },
    ligado: () => aberto,
  };
})();
