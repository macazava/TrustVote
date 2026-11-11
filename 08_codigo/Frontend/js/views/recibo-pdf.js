/* View · recibo do voto em PDF (TrustVote.reciboPdf), gerado no browser sem bibliotecas.
   O PDF tem a eleição, a volta, a data, o código do recibo e o QR da verificação pública.
   Nunca diz em quem se votou: o servidor também não sabe a que eleitor pertence cada recibo.
   Formato: PDF 1.4 de uma página A4, com as letras Helvetica que todos os leitores de PDF têm. */
(function () {
  "use strict";

  const TV = window.TrustVote;

  // Texto em WinAnsi (Latin-1 + alguns sinais), a codificação das letras-padrão do PDF
  const ESPECIAIS = { "—": 0x97, "–": 0x96, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "…": 0x85, "•": 0x95, "€": 0x80 };
  const winAnsi = (texto) =>
    [...String(texto)]
      .map((c) => {
        const n = ESPECIAIS[c] ?? c.charCodeAt(0);
        return n <= 0xff ? String.fromCharCode(n) : "?";
      })
      .join("");
  const textoPdf = (t) => `(${winAnsi(t).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;

  // Cores (0–1) das variáveis do site: verde da marca, texto e cinzentos
  const VERDE = "0.090 0.247 0.196";
  const VERDE_CLARO = "0.906 0.945 0.925";
  const TEXTO = "0.145 0.157 0.141";
  const CINZA = "0.314 0.337 0.314";

  const dataCompleta = (valor) =>
    valor
      ? new Date(valor).toLocaleString("pt-PT", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "—";

  // Uma página A4 (595 × 842 pontos); a origem é o canto inferior esquerdo.
  // Sem código (r.recibo vazio) é um comprovativo de participação: sem código nem QR.
  function conteudo(r) {
    const comRecibo = !!r.recibo;
    const linhas = [];
    const texto = (x, y, tamanho, t, negrito = false, cor = TEXTO) =>
      linhas.push(`BT ${cor} rg /${negrito ? "F2" : "F1"} ${tamanho} Tf ${x} ${y} Td ${textoPdf(t)} Tj ET`);
    const retangulo = (x, y, w, h, cor) => linhas.push(`${cor} rg ${x} ${y} ${w} ${h} re f`);
    const linha = (x1, y, x2) => linhas.push(`0.847 0.820 0.761 RG 1 w ${x1} ${y} m ${x2} ${y} l S`);

    // Faixa do topo com a marca
    retangulo(0, 762, 595, 80, VERDE);
    texto(56, 800, 22, "TRUSTVOTE", true, "1 1 1");
    texto(56, 782, 10, "ELEIÇÕES ACADÉMICAS", false, "0.796 0.847 0.816");
    texto(comRecibo ? 398 : 330, 792, 12, comRecibo ? "Recibo de voto" : "Comprovativo de participação", true, "1 1 1");

    texto(56, 712, 20, "O seu voto foi registado.", true, VERDE);
    texto(56, 692, 11, comRecibo ? "Guarde este recibo: é a única forma de confirmar que o seu voto foi contado." : "Este comprovativo confirma que votou nesta eleição.", false, CINZA);

    // Identificação do eleitor (a conta com sessão iniciada): nome, curso e número de estudante
    const eleitor = r.eleitor || (TV.session && TV.session.user) || null;
    let y = 648;
    if (eleitor) {
      linhas.push(`0.988 0.984 0.965 rg 0.847 0.820 0.761 RG 1 w 56 ${y - 52} 483 64 re B`);
      retangulo(56, y - 52, 4, 64, VERDE); // filete verde à esquerda, como nos avisos do site
      texto(76, y - 8, 9, "ELEITOR", true, CINZA);
      texto(76, y - 26, 14, eleitor.nome || "—", true, TEXTO);
      if (eleitor.curso) texto(76, y - 42, 10, eleitor.curso, false, CINZA);
      texto(380, y - 8, 9, "N.º DE ESTUDANTE", true, CINZA);
      texto(380, y - 26, 14, TV.format ? TV.format.voterNumber(eleitor) : eleitor.num_estudante || "—", true, TEXTO);
      y -= 92;
    }

    // Dados do voto (sem a escolha)
    const campo = (rotulo, valor) => {
      texto(56, y, 9, rotulo.toUpperCase(), true, CINZA);
      texto(56, y - 16, 12, valor, false, TEXTO);
      linha(56, y - 28, 539);
      y -= 48;
    };
    campo("Eleição", r.eleicao_titulo || `Eleição #${r.eleicao_id}`);
    campo("Volta", TV.format.volta(r.ronda));
    campo("Data e hora do voto", dataCompleta(r.data));

    if (!comRecibo) {
      texto(56, y - 8, 10, "Este comprovativo não indica em quem votou.", true, TEXTO);
      texto(56, y - 24, 10, "O servidor sabe que votou, mas não em quem: é isso que mantém o voto secreto.", false, CINZA);
      texto(56, 40, 8, `TrustVote · comprovativo gerado a ${dataCompleta(new Date())}`, false, CINZA);
      return linhas.join("\n");
    }

    // Código do recibo em destaque
    retangulo(56, y - 52, 483, 64, VERDE_CLARO);
    texto(72, y - 8, 9, "CÓDIGO DO RECIBO", true, CINZA);
    texto(72, y - 36, 18, r.recibo, true, VERDE);
    y -= 92;

    // QR code da verificação pública (quadrados pretos sobre branco, 3 pontos por módulo)
    const url = TV.qr.verifyUrl(r.recibo);
    const m = TV.qr.gerar(url);
    const lado = 3.2;
    const qrX = 56;
    const qrTopo = y;
    linhas.push("0 0 0 rg");
    m.forEach((fila, i) => fila.forEach((escuro, j) => escuro && linhas.push(`${(qrX + j * lado).toFixed(1)} ${(qrTopo - (i + 1) * lado).toFixed(1)} ${lado} ${lado} re`)));
    linhas.push("f");
    const tx = qrX + m.length * lado + 24;
    texto(tx, qrTopo - 14, 12, "Verificar o voto", true, VERDE);
    texto(tx, qrTopo - 32, 10, "Leia o código com uma câmara ou abra o endereço:", false, CINZA);
    texto(tx, qrTopo - 48, 9, url.length > 64 ? url.slice(0, 64) : url, false, TEXTO);
    if (url.length > 64) texto(tx, qrTopo - 60, 9, url.slice(64), false, TEXTO);
    y = qrTopo - m.length * lado - 36;

    // Nota sobre o segredo do voto
    linha(56, y, 539);
    texto(56, y - 20, 10, "Este recibo não indica em quem votou.", true, TEXTO);
    texto(56, y - 36, 10, "O servidor não sabe a que eleitor pertence cada recibo: é isso que mantém o voto secreto.", false, CINZA);
    if (r.hash) texto(56, y - 56, 7, `Hash: ${r.hash}`, false, CINZA);

    texto(56, 40, 8, `TrustVote · recibo gerado a ${dataCompleta(new Date())}`, false, CINZA);
    return linhas.join("\n");
  }

  // Monta o ficheiro PDF: objetos, tabela de posições (xref) e fim
  function reciboPdf(r) {
    const stream = conteudo(r);
    const objetos = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      `<< /Title ${textoPdf(r.recibo ? `Recibo de voto ${r.recibo}` : `Comprovativo de participação · ${r.eleicao_titulo || ""}`)} /Producer (TrustVote) >>`,
    ];
    let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
    const posicoes = [];
    objetos.forEach((o, i) => {
      posicoes.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    pdf += posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
    pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    // Cada carácter do texto acima ocupa exatamente 1 byte (Latin-1)
    return Uint8Array.from(pdf, (c) => c.charCodeAt(0));
  }

  TV.reciboPdf = reciboPdf;
})();
