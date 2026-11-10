/* Configuração do Tailwind: só grelha, espaçamento entre colunas e breakpoints.
   Cores, letra, cantos e sombras NÃO vivem aqui: estão em css/base/variaveis.css (design tokens)
   e são aplicados pelos componentes em css/componentes/. Assim há uma única fonte de verdade.

   O CSS final (css/site.css) é gerado a partir de css/tailwind/entrada.css; o comando está nesse ficheiro. */
module.exports = {
  // Ficheiros onde o Tailwind procura as classes usadas
  content: ["./pages/**/*.html", "./js/**/*.js"],
  // Sem o reset nem o .container do Tailwind, para não alterar os estilos que já existem
  corePlugins: { preflight: false, container: false },
  theme: {
    extend: {
      screens: {
        xs: "420px",
        "3xl": "1800px",
      },
    },
  },
};
