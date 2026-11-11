/* View · QR code em SVG, gerado no browser (TrustVote.qr)
   Usado no recibo do voto: o QR abre a página pública de verificação com o código já preenchido.
   Implementação própria da norma QR (modo byte, correção de erros nível M, versões 1 a 10),
   seguindo o algoritmo de referência de Project Nayuki (licença MIT). Chega para endereços até ~210 caracteres. */
(function () {
  "use strict";

  const TV = (window.TrustVote = window.TrustVote || {});

  // Nível M: códigos de correção por bloco e número de blocos, por versão (índice 0 não é usado)
  const ECC_POR_BLOCO = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  const BLOCOS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  const bit = (x, i) => ((x >>> i) & 1) !== 0;

  // Módulos de dados disponíveis numa versão (tudo menos os padrões fixos)
  function modulosDados(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const n = Math.floor(ver / 7) + 2;
      r -= (25 * n - 10) * n - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  const bytesDados = (ver) => Math.floor(modulosDados(ver) / 8) - ECC_POR_BLOCO[ver] * BLOCOS[ver];

  // ===== Reed-Solomon em GF(256) =====
  function mul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function divisor(grau) {
    const r = new Array(grau).fill(0);
    r[grau - 1] = 1;
    let raiz = 1;
    for (let i = 0; i < grau; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = mul(r[j], raiz);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      raiz = mul(raiz, 0x02);
    }
    return r;
  }
  function resto(dados, div) {
    const r = div.map(() => 0);
    for (const b of dados) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => (r[i] ^= mul(c, f)));
    }
    return r;
  }

  // Divide os dados em blocos, junta a correção de erros e intercala tudo
  function comCorrecao(dados, ver) {
    const nBlocos = BLOCOS[ver];
    const eccLen = ECC_POR_BLOCO[ver];
    const total = Math.floor(modulosDados(ver) / 8);
    const curtos = nBlocos - (total % nBlocos);
    const curtoLen = Math.floor(total / nBlocos);
    const div = divisor(eccLen);
    const blocos = [];
    for (let i = 0, k = 0; i < nBlocos; i++) {
      const dat = dados.slice(k, k + curtoLen - eccLen + (i < curtos ? 0 : 1));
      k += dat.length;
      const ecc = resto(dat, div);
      if (i < curtos) dat.push(0);
      blocos.push(dat.concat(ecc));
    }
    const out = [];
    for (let i = 0; i < blocos[0].length; i++)
      blocos.forEach((b, j) => {
        if (i !== curtoLen - eccLen || j >= curtos) out.push(b[i]);
      });
    return out;
  }

  // ===== Matriz =====
  function gerar(texto) {
    const bytes = [...new TextEncoder().encode(texto)];
    let ver = 1;
    while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > bytesDados(ver) * 8) ver++;
    if (ver > 10) throw new Error("Texto demasiado longo para o QR code.");

    // Bits: modo byte (0100), comprimento, dados, terminador e enchimento
    const bits = [];
    const add = (val, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    add(4, 4);
    add(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => add(b, 8));
    const cap = bytesDados(ver) * 8;
    add(0, Math.min(4, cap - bits.length));
    add(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) add(p, 8);
    const dados = [];
    for (let i = 0; i < bits.length; i += 8) dados.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    const palavras = comCorrecao(dados, ver);

    const n = ver * 4 + 17;
    const m = Array.from({ length: n }, () => new Array(n).fill(false));
    const fixo = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (x, y, escuro) => {
      m[y][x] = escuro;
      fixo[y][x] = true;
    };

    // Padrões fixos: temporização, localizadores, alinhamento
    for (let i = 0; i < n; i++) {
      set(6, i, i % 2 === 0);
      set(i, 6, i % 2 === 0);
    }
    const localizador = (x, y) => {
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (x + dx >= 0 && x + dx < n && y + dy >= 0 && y + dy < n) set(x + dx, y + dy, d !== 2 && d !== 4);
        }
    };
    localizador(3, 3);
    localizador(n - 4, 3);
    localizador(3, n - 4);
    if (ver > 1) {
      const qtd = Math.floor(ver / 7) + 2;
      const passo = Math.ceil((ver * 4 + 4) / (qtd * 2 - 2)) * 2;
      const pos = [6];
      for (let p = n - 7; pos.length < qtd; p -= passo) pos.splice(1, 0, p);
      pos.forEach((a, i) =>
        pos.forEach((b, j) => {
          if ((i === 0 && j === 0) || (i === 0 && j === qtd - 1) || (i === qtd - 1 && j === 0)) return;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        })
      );
    }

    // Informação de formato (nível M = 0) e de versão (a partir da 7)
    const formato = (mascara) => {
      const d = mascara; // (nível M = 00) << 3 | máscara
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
      set(8, 7, bit(b, 6));
      set(8, 8, bit(b, 7));
      set(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(b, i));
      for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(b, i));
      set(8, n - 8, true);
    };
    formato(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const a = n - 11 + (i % 3);
        const c = Math.floor(i / 3);
        set(a, c, bit(b, i));
        set(c, a, bit(b, i));
      }
    }

    // Dados em ziguezague, de baixo para cima, duas colunas de cada vez
    let i = 0;
    for (let dir = n - 1; dir >= 1; dir -= 2) {
      if (dir === 6) dir = 5;
      for (let v = 0; v < n; v++)
        for (let j = 0; j < 2; j++) {
          const x = dir - j;
          const y = ((dir + 1) & 2) === 0 ? n - 1 - v : v;
          if (!fixo[y][x] && i < palavras.length * 8) {
            m[y][x] = bit(palavras[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
    }

    // Máscara: experimenta as 8 e fica com a de menor penalização
    const regras = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
      (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
      (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const aplicar = (k) => {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fixo[y][x] && regras[k](x, y)) m[y][x] = !m[y][x];
    };
    const penalizacao = () => {
      let p = 0;
      const linha = (get) => {
        for (let a = 0; a < n; a++) {
          let corrida = 1;
          for (let b = 1; b <= n; b++) {
            if (b < n && get(a, b) === get(a, b - 1)) corrida++;
            else {
              if (corrida >= 5) p += corrida - 2;
              corrida = 1;
            }
          }
        }
      };
      linha((a, b) => m[a][b]);
      linha((a, b) => m[b][a]);
      let escuros = 0;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          if (m[y][x]) escuros++;
          if (x < n - 1 && y < n - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
        }
      p += Math.floor(Math.abs(escuros * 20 - n * n * 10) / (n * n)) * 10;
      return p;
    };
    let melhor = 0;
    let menor = Infinity;
    for (let k = 0; k < 8; k++) {
      aplicar(k);
      formato(k);
      const p = penalizacao();
      if (p < menor) {
        menor = p;
        melhor = k;
      }
      aplicar(k); // desfaz (a máscara é um XOR)
    }
    aplicar(melhor);
    formato(melhor);
    return m;
  }

  // SVG com margem de 4 módulos; quadrados escuros num só <path>
  function svg(texto, rotulo = "QR code") {
    const m = gerar(texto);
    const n = m.length;
    let d = "";
    m.forEach((linha, y) => linha.forEach((escuro, x) => escuro && (d += `M${x + 4},${y + 4}h1v1h-1z`)));
    return `<svg class="qr-code" viewBox="0 0 ${n + 8} ${n + 8}" role="img" aria-label="${TV.format ? TV.format.escapeHtml(rotulo) : rotulo}" shape-rendering="crispEdges"><rect width="100%" height="100%" class="qr-code-bg"></rect><path d="${d}" class="qr-code-fg"></path></svg>`;
  }

  // Endereço da página pública de verificação para um código de recibo
  const verifyUrl = (codigo) => new URL(`verificar.html?codigo=${encodeURIComponent(codigo)}`, window.location.href).href;

  TV.qr = { gerar, svg, verifyUrl };
})();
