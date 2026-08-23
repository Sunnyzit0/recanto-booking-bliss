import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendario } from "@/components/Calendario";
import {
  alternarBloqueioAdmin,
  atualizarReservaAdmin,
  listarBloqueiosAdmin,
  listarReservasAdmin,
  loginAdmin,
  sairAdmin,
  verificarSessaoAdmin,
} from "@/lib/admin-actions";
import { formatarData, type Reserva, type Status } from "@/lib/reservas";

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

function datasIndisponiveisAdmin(reservas: Reserva[], bloqueios: string[]) {
  return new Set([
    ...bloqueios,
    ...reservas.filter((r) => r.status === "aprovada").map((r) => r.data),
  ]);
}

function Admin() {
  const [logado, setLogado] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const [entrando, setEntrando] = useState(false);

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Verifica se já existe uma sessão válida (cookie assinado no servidor)
  useEffect(() => {
    verificarSessaoAdmin().then(({ logado }) => {
      setLogado(logado);
      setVerificandoSessao(false);
    });
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(false);
    const resultado = await loginAdmin({ data: { senha } });
    if (resultado.ok) {
      setLogado(true);
    } else {
      setErro(true);
    }
    setEntrando(false);
  }

  async function sair() {
    await sairAdmin();
    setLogado(false);
  }

  async function carregar() {
    const [novasReservas, novosBloqueios] = await Promise.all([
      listarReservasAdmin(),
      listarBloqueiosAdmin(),
    ]);
    setReservas(novasReservas as Reserva[]);
    setBloqueios(novosBloqueios);
    setCarregando(false);
  }

  useEffect(() => {
    if (!logado) return;
    carregar();
    // Sem login "realtime" do banco aqui — atualiza a cada 20s, e também
    // logo depois de qualquer ação (aprovar, recusar, editar, bloquear).
    const intervalo = setInterval(carregar, 20_000);
    return () => clearInterval(intervalo);
  }, [logado]);

  async function atualizar(id: string, mudanca: Partial<Reserva>) {
    setReservas((atual) => atual.map((r) => (r.id === id ? { ...r, ...mudanca } : r)));
    await atualizarReservaAdmin({ data: { id, mudanca } });
  }

  async function alternarBloqueio(data: string) {
    const jaBloqueada = bloqueios.includes(data);
    setBloqueios((atual) => (jaBloqueada ? atual.filter((d) => d !== data) : [...atual, data]));
    await alternarBloqueioAdmin({ data: { data, jaBloqueada } });
  }

  if (verificandoSessao) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Verificando acesso...</p>
      </main>
    );
  }

  if (!logado) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <form
          onSubmit={entrar}
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
            autoComplete="current-password"
            className="mt-5 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
          />
          {erro && <p className="mt-2 text-sm text-destructive">Senha incorreta.</p>}
          <button
            type="submit"
            disabled={entrando}
            className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {entrando ? "Entrando..." : "Entrar"}
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
            indisponiveis={datasIndisponiveisAdmin(reservas, bloqueios)}
            onSelecionar={alternarBloqueio}
          />
        </div>
      </section>
    </main>
  );
}
