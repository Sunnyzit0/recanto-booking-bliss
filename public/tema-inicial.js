// Aplica o tema escuro salvo (se houver) antes da primeira pintura da
// página — evita o "flash" de tema claro no instante entre o HTML
// chegar do servidor e o React hidratar e aplicar o tema salvo.
// Precisa ser um script síncrono carregado antes do CSS no <head>
// (veja src/routes/__root.tsx) pra funcionar; não faz sentido adiado.
(function () {
  try {
    if (localStorage.getItem("recanto-tema") === "escuro") {
      document.documentElement.classList.add("dark");
    }
  } catch (erro) {
    // localStorage pode falhar (modo privado restrito, etc.) — nesse caso
    // só mantém o tema claro padrão, sem quebrar o carregamento da página.
  }
})();
