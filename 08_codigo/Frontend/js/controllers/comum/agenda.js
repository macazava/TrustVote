/* Controller · "Adicionar ao calendário": gera um ficheiro .ics (iCalendar, RFC 5545) com o período de votação.
   Abre no Google Calendar, no Outlook e no Calendário da Apple. Tem dois lembretes:
   1 hora antes de a votação abrir e 1 dia antes de fechar.
   Os botões vêm de TrustVote.blocks.calendarButton (views/componentes.js). */
(function () {
  "use strict";

  // Data em UTC no formato do iCalendar: 20261110T090000Z
  const utc = (valor) => new Date(valor).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  // Texto: escapar \ ; , e mudanças de linha
  const texto = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

  // Linhas com mais de 75 bytes continuam na seguinte, começada por um espaço
  // (conta bytes UTF-8, não caracteres: "ç" ou "ã" ocupam 2)
  const bytes = (c) => new TextEncoder().encode(c).length;
  const dobrar = (linha) => {
    const partes = [""];
    let usados = 0;
    for (const c of linha) {
      if (usados + bytes(c) > 74) {
        partes.push(" ");
        usados = 1;
      }
      partes[partes.length - 1] += c;
      usados += bytes(c);
    }
    return partes.join("\r\n");
  };

  function ics(ev) {
    const votar = new URL("login.html?area=eleitor", window.location.href).href;
    const descricao = [ev.descricao, "Vote online na Área do Eleitor do TrustVote.", votar].filter(Boolean).join("\n\n");
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TrustVote//Eleicoes academicas//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:eleicao-${ev.id || "x"}-${utc(ev.inicio)}@trustvote`,
      `DTSTAMP:${utc(Date.now())}`,
      `DTSTART:${utc(ev.inicio)}`,
      `DTEND:${utc(ev.fim)}`,
      `SUMMARY:${texto(`Votação: ${ev.titulo}`)}`,
      `DESCRIPTION:${texto(descricao)}`,
      `URL:${votar}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER:-PT1H",
      `DESCRIPTION:${texto(`A votação "${ev.titulo}" abre daqui a 1 hora.`)}`,
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      "TRIGGER;RELATED=END:-P1D",
      `DESCRIPTION:${texto(`A votação "${ev.titulo}" fecha amanhã. Ainda não votou?`)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(dobrar)
      .join("\r\n");
  }

  // Um só ouvinte para todos os botões, também os que chegam depois com os dados da API
  document.addEventListener("click", (event) => {
    const botao = event.target.closest?.("[data-ics]");
    if (!botao) return;
    const ev = JSON.parse(botao.dataset.ics);
    const nome = `${window.TrustVote.format.slug(ev.titulo) || "eleicao"}.ics`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([ics(ev) + "\r\n"], { type: "text/calendar;charset=utf-8" }));
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    window.TrustVote.ui.toast("Evento descarregado. Abra o ficheiro para o juntar ao seu calendário.");
  });

  window.TrustVote.agenda = { ics };
})();
