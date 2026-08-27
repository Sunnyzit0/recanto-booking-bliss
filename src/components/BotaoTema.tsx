import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-secondary/60 text-foreground transition hover:bg-secondary"
    >
      {escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
