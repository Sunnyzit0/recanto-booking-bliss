import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { executarConfirmacaoPorToken, lerConfirmacaoPorToken } from "@/lib/email-actions";
import { CONFIG, formatarData } from "@/lib/reservas";

export const Route = createFileRoute("/confirmar")({
  head: () => ({
    meta: [{ title: "Confirmar reserva — Recanto da Piscina" }, { name: "robots", content: "noindex" }],
  }),
  component: Confirmar,
});

type Reserva = {
  id: string;
  nome: string;
  telefone: string;
  data: string;
  valor: number;
  horario: string;
  status: string;
};

function Confirmar() {
  const [carregando, setCarregando] = useState(true);
  const [valido, setValido] = useState(false);
  const [acao, setAcao] = useState<"aprovada" | "recusada" | null>(null);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [concluido, setConcluido] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) {
      setCarregando(false);
      return;
    }
    lerConfirmacaoPorToken({ data: { token } })
      .then((r) => {
        if (r.valido) {
          setValido(true);
          setAcao(r.acao);
          setReservas(r.reservas as Reserva[]);
        }
      })
      .finally(() => setCarregando(false));
  }, [token]);

  async function confirmar() {
    if (!token) return;
    setProcessando(true);
    setErro(null);
    try {
      await executarConfirmacaoPorToken({ data: { token } });
      setConcluido(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente pelo painel do site.");
    } finally {
      setProcessando(false);
    }
  }

  const valorTotal = reservas.reduce((soma, r) => soma + r.valor, 0);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="shadow-soft w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-2xl text-foreground">{CONFIG.nome}</h1>

        {carregando && <p className="mt-6 text-sm text-muted-foreground">Carregando...</p>}

        {!carregando && (!token || !valido) && (
          <p className="mt-6 text-sm text-muted-foreground">
            Este link é inválido ou já expirou. Acesse o painel do site em{" "}
            <a href="/admin" className="underline">
              {CONFIG.urlBase}/admin
            </a>{" "}
            pra gerenciar as reservas.
          </p>
        )}

        {!carregando && valido && !concluido && (
          <>
            <div className="mt-4 flex justify-center">
              {acao === "aprovada" ? (
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              ) : (
                <XCircle className="h-10 w-10 text-red-600" />
              )}
            </div>
            <p className="mt-3 text-foreground">
              Confirmar <strong>{acao === "aprovada" ? "aprovação" : "recusa"}</strong> desta reserva?
            </p>

            <div className="mt-4 space-y-2 rounded-xl bg-secondary/50 p-4 text-left text-sm">
              <p><strong>{reservas[0]?.nome}</strong> — {reservas[0]?.telefone}</p>
              {reservas.map((r) => (
                <p key={r.id} className="text-muted-foreground">
                  {formatarData(r.data)} · {r.horario} · R$ {r.valor}
                </p>
              ))}
              {reservas.length > 1 && <p className="font-medium text-foreground">Total: R$ {valorTotal}</p>}
            </div>

            {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

            <button
              onClick={confirmar}
              disabled={processando}
              className={`mt-5 w-full rounded-full px-6 py-3 text-sm font-medium transition disabled:opacity-60 ${
                acao === "aprovada"
                  ? "bg-primary text-primary-foreground hover:opacity-90"
                  : "border border-input text-foreground hover:bg-secondary"
              }`}
            >
              {processando ? "Confirmando..." : acao === "aprovada" ? "Confirmar aprovação" : "Confirmar recusa"}
            </button>
          </>
        )}

        {concluido && (
          <p className="mt-6 text-foreground">
            Pronto! A reserva foi <strong>{acao === "aprovada" ? "aprovada" : "recusada"}</strong>. O site já está
            atualizado.
          </p>
        )}
      </div>
    </main>
  );
}
