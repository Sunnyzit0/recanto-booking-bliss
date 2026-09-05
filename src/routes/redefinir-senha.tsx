import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { redefinirSenhaComToken } from "@/lib/admin-actions";
import { CONFIG } from "@/lib/reservas";

export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({
    meta: [{ title: "Redefinir senha — Recanto da Piscina" }, { name: "robots", content: "noindex" }],
  }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!token) {
      setErro("Link inválido.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não são iguais.");
      return;
    }
    setEnviando(true);
    try {
      const resultado = await redefinirSenhaComToken({ data: { token, novaSenha } });
      if (resultado.ok) {
        setConcluido(true);
      } else {
        setErro(resultado.erro ?? "Não foi possível redefinir a senha.");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="shadow-soft w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <div className="flex justify-center">
          <KeyRound className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mt-3 text-center font-display text-2xl text-foreground">{CONFIG.nome}</h1>

        {!token && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Link inválido. Peça um novo link em "Esqueci minha senha" na tela de login do admin.
          </p>
        )}

        {token && concluido && (
          <p className="mt-4 text-center text-sm text-foreground">
            Senha redefinida com sucesso! Já pode voltar pro{" "}
            <a href="/admin" className="underline">
              painel
            </a>{" "}
            e entrar com a nova senha.
          </p>
        )}

        {token && !concluido && (
          <form onSubmit={enviar} className="mt-4 space-y-3">
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Nova senha"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="Confirmar nova senha"
              autoComplete="new-password"
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
            />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {enviando ? "Salvando..." : "Definir nova senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
