import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendario } from "@/components/Calendario";
import {
  CONFIG,
  alternarBloqueio as alternarBloqueioDB,
  atualizarReserva,
  datasIndisponiveis,
  escutarAtualizacoes,
  formatarData,
  lerBloqueios,
  lerReservas,
  type Reserva,
  type Status,
} from "@/lib/reservas";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Área do administrador — Recanto da Piscina" },
      { name: "description", content: "Painel privado para gerenciar reservas do Recanto da Piscina." },
      { property: "og:title", content: "Área do administrador — Recanto da Piscina" },
      { property: "og:description", content: "Painel privado de reservas." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const CORES: Record<Status, string> = {
  pendente: "bg-accent text-accent-foreground",
  aprovada: "bg-leaf/15 text-leaf",
  recusada: "bg-destructive/10 text-destructive",
};

function Admin() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Mantém o admin logado nesse aparelho/navegador entre visitas
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("recanto_admin_logado") === "true") {
      setLogado(true);
    }
  }, []);

  function sair() {
    localStorage.removeItem("recanto_admin_logado");
    setLogado(false);
  }

  async function carregar() {
    const [novasReservas, novosBloqueios] = await Promise.all([lerReservas(), lerBloqueios()]);
    setReservas(novasReservas);
    setBloqueios(novosBloqueios);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    const parar = escutarAtualizacoes(() => carregar());
    return parar;
  }, []);

  async function atualizar(id: string, mudanca: Partial<Reserva>) {
    setReservas((atual) => atual.map((r) => (r.id === id ? { ...r, ...mudanca } : r)));
    await atualizarReserva(id, mudanca);
  }

  async function alternarBloqueio(data: string) {
    const jaBloqueada = bloqueios.includes(data);
    setBloqueios((atual) =>
      jaBloqueada ? atual.filter((d) => d !== data) : [...atual, data],
    );
    await alternarBloqueioDB(data, jaBloqueada);
  }

  if (!logado) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (senha === CONFIG.senhaAdmin) {
              localStorage.setItem("recanto_admin_logado", "true");
              setLogado(true);
            } else setErro(true);
          }}
          className="shadow-soft w-full max-w-sm rounded-2xl border border-border bg-card p-6"
        >
          <h1 className="font-display text-2xl text-foreground">Área do administrador</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso restrito ao dono do espaço.</p>
          <input
            type="password"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(false);
            }}
            placeholder="Senha"
            className="mt-5 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
          />
          {erro && <p className="mt-2 text-sm text-destructive">Senha incorreta.</p>}
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Entrar
          </button>
          <Link to="/" className="mt-4 block text-center text-sm text-muted-foreground hover:underline">
            Voltar ao site
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl text-foreground">Painel de reservas</h1>
        <div className="flex gap-4 text-sm">
          <Link to="/" className="text-muted-foreground hover:underline">Ver site</Link>
          <button onClick={sair} className="text-muted-foreground hover:underline">
            Sair
          </button>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-2xl text-foreground">Solicitações</h2>
        <div className="mt-4 space-y-4">
          {carregando && <p className="text-sm text-muted-foreground">Carregando reservas...</p>}
          {!carregando && reservas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação recebida ainda.</p>
          )}
          {reservas.map((r) => (
            <div key={r.id} className="shadow-soft rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-foreground">{r.nome}</p>
                  <p className="text-sm text-muted-foreground">📞 {r.telefone}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs capitalize ${CORES[r.status]}`}>
                  {r.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <label className="text-xs text-muted-foreground">
                  Data ({formatarData(r.data)})
                  <input
                    type="date"
                    value={r.data}
                    onChange={(e) => atualizar(r.id, { data: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Valor (R$)
                  <input
                    type="number"
                    value={r.valor}
                    onChange={(e) => atualizar(r.id, { valor: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Horário
                  <input
                    value={r.horario}
                    onChange={(e) => atualizar(r.id, { horario: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => atualizar(r.id, { status: "aprovada" })}
                  className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground transition hover:opacity-90"
                >
                  Aprovar
                </button>
                <button
                  onClick={() => atualizar(r.id, { status: "recusada" })}
                  className="rounded-full border border-input px-5 py-2 text-sm text-foreground transition hover:bg-secondary"
                >
                  Recusar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl text-foreground">Disponibilidade</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique em uma data para bloquear ou liberar no calendário do site.
        </p>
        <div className="mt-4 max-w-md">
          <Calendario
            modoAdmin
            indisponiveis={datasIndisponiveis(reservas, bloqueios)}
            onSelecionar={alternarBloqueio}
          />
        </div>
      </section>
    </main>
  );
}
