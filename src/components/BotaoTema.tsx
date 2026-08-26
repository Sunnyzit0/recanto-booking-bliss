import { useEffect, useState } from "react";

const CHAVE_ARMAZENAMENTO = "recanto-tema";

function aplicarTema(escuro: boolean) {
  document.documentElement.classList.toggle("dark", escuro);
}

export function BotaoTema() {
  // Sempre começa no tema claro (padrão), independente da preferência
  // do sistema — só muda se a pessoa já tiver escolhido escuro antes
  // nesse navegador.
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (salvo === "escuro") {
      setEscuro(true);
      aplicarTema(true);
    }
  }, []);

  function alternar() {
    const novoValor = !escuro;
    setEscuro(novoValor);
    aplicarTema(novoValor);
    localStorage.setItem(CHAVE_ARMAZENAMENTO, novoValor ? "escuro" : "claro");
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
    >
      {escuro ? "☀️" : "🌙"}
    </button>
  );
}
