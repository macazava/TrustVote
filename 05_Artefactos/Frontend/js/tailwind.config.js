/* Configuração do Tailwind: cores e letra do TrustVote
   Depois de mudar classes Tailwind no HTML ou no JS, correr "npm run css" na pasta .vscode para gerar css/tailwind.css */
module.exports = {
  // Ficheiros onde o Tailwind procura as classes usadas
  content: ["./index.html", "./pages/**/*.html", "./js/**/*.js"],
  // Sem o reset nem o .container do Tailwind, para não alterar os estilos que já existem
  corePlugins: { preflight: false, container: false },
  theme: {
    extend: {
      colors: {
        tv: {
          accent: "#1F5A45",
          strong: "#2d6a4f",
          dark: "#173f32",
          title: "#1b4332",
          ivory: "#f4f0e4",
          paper: "#fffdf6",
          sand: "#ebe7dd",
          beige: "#e8e5d7",
          mint: "#e7f1ec",
          line: "#d8d1c2",
          ink: "#252824",
          muted: "#505650",
        },
      },
      fontFamily: {
        sans: ["Poppins", "Arial", "sans-serif"],
      },
      screens: {
        xs: "420px",
        "3xl": "1800px",
      },
      boxShadow: {
        soft: "0 10px 30px -12px rgba(23, 63, 50, 0.18)",
        lift: "0 22px 45px -18px rgba(23, 63, 50, 0.28)",
      },
    },
  },
};
