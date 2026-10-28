/* View · partes comuns das páginas públicas: topo, caminho da página e rodapé.
   Cada página só tem os marcadores <div data-layout="..."></div> e esta função preenche-os.
   Corre antes dos outros scripts (scripts "defer" correm pela ordem em que aparecem). */
(function montarLayout() {
  // ===== Topo: atalhos, marca, menu principal e botão de votar =====
  const cabecalho = `
  <div class="topbar">
    <div class="topbar-inner">
      <a href="login.html?area=eleitor" data-voter-link>Área do eleitor</a>
      <a href="login.html?area=equipa">Área da equipa</a>
    </div>
  </div>

  <header class="site-header sticky top-0 z-40 bg-tv-paper/90 backdrop-blur-md">
    <div class="site-header-inner">
      <a class="brand" href="inicio.html">
        <span class="brand-mark">✓</span>
        <span><b>TRUSTVOTE</b><small>ELEIÇÕES ACADÉMICAS</small></span>
      </a>
      <button class="menu-toggle" type="button" aria-label="Abrir menu" aria-expanded="false">☰</button>
      <nav class="main-nav" aria-label="Navegação principal">
        <a href="calendario.html">Eleições</a>
        <a href="calendario.html#calendario-eleitoral">Calendário</a>
        <a href="listas.html">Listas académicas</a>
        <a href="comunicacao.html">Comunicação</a>
        <a href="historico.html">Histórico eleitoral</a>
        <a href="ajuda.html">Ajuda</a>
      </nav>
      <div class="header-actions">
        <a class="button rounded-xl button-primary shadow-sm hover:shadow-lift" href="login.html?area=eleitor"
          data-voter-link>Votar <span>→</span></a>
      </div>
    </div>
  </header>`;

  // ===== Caminho da página: lido dos atributos do marcador =====
  // data-seccao + data-seccao-link → passo intermédio (opcional)
  // data-atual → nome da página; data-atual-muda → site.js troca-o ao mudar de tema
  function caminho(marcador) {
    const { seccao, seccaoLink, atual } = marcador.dataset;
    const muda = marcador.hasAttribute("data-atual-muda") ? " data-crumb-current" : "";
    return `
  <div class="breadcrumb-bar">
    <div class="container">
      <ol class="breadcrumb">
        <li><a href="inicio.html" aria-label="Início">⌂</a></li>
        ${seccao ? `<li><a href="${seccaoLink}">${seccao}</a></li>` : ""}
        <li${muda}>${atual}</li>
      </ol>
      <div class="breadcrumb-tools">
        <button type="button" data-share aria-label="Partilhar">↗</button>
        <button type="button" data-print aria-label="Imprimir">▣</button>
      </div>
    </div>
  </div>`;
  }

  // ===== Rodapé =====
  const rodape = `
  <footer class="site-footer">
    <div class="footer-main grid-cols-2 md:grid-cols-4 lg:grid-cols-[1.5fr_repeat(3,1fr)] container">
      <div class="footer-about col-span-2 md:col-span-4 lg:col-span-1">
        <a class="brand" href="inicio.html">
          <span class="brand-mark">✓</span>
          <span><b>TRUSTVOTE</b><small>ELEIÇÕES ACADÉMICAS</small></span>
        </a>
        <p>Votação online para as eleições académicas da Universidade Exemplo.</p>
      </div>
      <div>
        <b>ELEIÇÕES</b>
        <a href="calendario.html">Calendário eleitoral</a>
        <a href="calendario.html#como-votar">Como votar</a>
        <a href="como-funciona.html">Como funciona</a>
        <a href="resultados.html">Resultados</a>
      </div>
      <div>
        <b>ELEITOR</b>
        <a href="login.html?area=eleitor" data-voter-link>Área do eleitor</a>
        <a href="listas.html">Listas académicas</a>
        <a href="comunicacao.html">Comunicação</a>
        <a href="historico.html">Histórico eleitoral</a>
      </div>
      <div>
        <b>AJUDA</b>
        <a href="ajuda.html#quem-somos">Quem somos</a>
        <a href="ajuda.html#contactos">Contactos</a>
        <a href="ajuda.html#perguntas-frequentes">Perguntas frequentes</a>
        <a href="login.html?area=equipa">Área da equipa</a>
      </div>
    </div>
    <div class="footer-bottom container">
      <span>Projeto académico demonstrativo · 2026</span>
      <span><a href="privacidade.html">Privacidade</a> · <a href="acessibilidade.html">Acessibilidade</a></span>
    </div>
  </footer>`;

  const partes = {
    cabecalho: () => cabecalho,
    caminho,
    rodape: () => rodape,
  };

  document.querySelectorAll("[data-layout]").forEach((marcador) => {
    const parte = partes[marcador.dataset.layout];
    if (parte) marcador.outerHTML = parte(marcador);
  });
})();
