# TrustVote — Frontend

Site do TrustVote em HTML, CSS e JavaScript simples (sem framework), servido pelos nginx do
Docker. Para o pôr a correr basta a stack (`Infraestrutura\stack.cmd up`) e abrir
<http://127.0.0.1:8080>. O Node só é preciso para recompilar o Tailwind.

## Estrutura

```
Frontend/
├── pages/          # 13 páginas (públicas, login, área do eleitor e área da equipa)
├── js/
│   ├── models/     # dados: ligação à API (servidor.js, api.js), sessão, eleições, resultados
│   ├── views/      # HTML gerado a partir dos dados (uma pasta por área)
│   └── controllers/# o que acontece em cada página (uma pasta por área)
├── css/
│   ├── style.css   # índice: importa os outros pela ordem certa
│   ├── base/ componentes/ paginas/
│   └── tailwind.css  # gerado por "npm run css" (não editar à mão)
├── assets/         # imagens
└── package.json    # comando: npm run css (recompila o Tailwind)
```

Cada página carrega os scripts por esta ordem: models → views → controllers. Todos se
registam em `window.TrustVote`. O site fala com a API do nginx onde foi aberto e, se ele não
responder, tenta os outros (`js/models/servidor.js`).


## CSS

- O nosso CSS está em `css/` e é organizado por função (base, componentes, páginas).
- O Tailwind só traz classes de layout usadas no HTML (`grid-cols-…`, `rounded-…`). Depois de
  mudar classes do Tailwind no HTML ou no JS: `npm install` (uma vez) e `npm run css`.
- Depois de mudar CSS ou JS, aumentar o `?v=` nas páginas, para o browser não usar a versão
  antiga.

## Abrir num telemóvel

1. Telemóvel e PC na **mesma rede Wi-Fi**.
2. Arrancar a stack aberta à rede: `Infraestrutura\stack.cmd up -Rede`. No fim mostra o
   endereço para o telemóvel, por exemplo `http://192.168.1.20:8080`.
3. Abrir esse endereço no telemóvel. Se não abrir, permitir o Docker na firewall do Windows.
4. No fim, voltar ao normal (só este PC): `Infraestrutura\stack.cmd up`.
