import { useState } from "react";
import { toISO } from "@/lib/reservas";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

type Props = {
  /** Datas com reserva já APROVADA (confirmada por um cliente) */
  reservadas: Set<string>;
  /** Datas com solicitação aguardando aprovação (ainda não confirmadas) */
  pendentes?: Set<string>;
  /** Datas bloqueadas manualmente pelo admin (sem reserva de cliente) */
  indisponivelAdmin?: Set<string>;
  selecionadas?: Set<string>;
  onSelecionar?: (data: string) => void;
  /** No modo admin é possível clicar em qualquer data, inclusive as ocupadas */
  modoAdmin?: boolean;
  /** Fora desse período (formato AAAA-MM-DD) a data fica bloqueada pro cliente */
  dataMinima?: string;
  dataMaxima?: string;
};

type Estado = "disponivel" | "pendente" | "reservada" | "indisponivel";

export function Calendario({
  reservadas,
  pendentes,
  indisponivelAdmin,
  selecionadas,
  onSelecionar,
  modoAdmin,
  dataMinima,
  dataMaxima,
}: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeISO = toISO(hoje);

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setMes(d.getMonth());
    setAno(d.getFullYear());
  }

  const primeiroDiaProximoMes = toISO(new Date(ano, mes + 1, 1));
  const naoPodeAvancar = !modoAdmin && !!dataMaxima && primeiroDiaProximoMes > dataMaxima;

  function estadoDoDia(iso: string): Estado {
    if (reservadas.has(iso)) return "reservada";
    if (indisponivelAdmin?.has(iso)) return "indisponivel";
    if (pendentes?.has(iso)) return "pendente";
    return "disponivel";
  }

  const ESTILOS: Record<Estado, string> = {
    disponivel: "bg-secondary text-secondary-foreground hover:bg-accent",
    pendente: "bg-accent/60 text-accent-foreground",
    reservada: "bg-destructive/10 text-destructive line-through",
    indisponivel: "bg-muted text-muted-foreground/60 line-through",
  };

  const TITULOS: Record<Estado, string | undefined> = {
    disponivel: undefined,
    pendente: "Reserva em análise",
    reservada: "Já reservada",
    indisponivel: "Indisponível",
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          className="rounded-full px-3 py-1 text-lg text-muted-foreground transition hover:bg-secondary"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="font-display text-lg text-foreground">
          {MESES[mes]} {ano}
        </span>
        <button
          type="button"
          onClick={() => mudarMes(1)}
          disabled={naoPodeAvancar}
          className="rounded-full px-3 py-1 text-lg text-muted-foreground transition hover:bg-secondary disabled:opacity-30"
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {DIAS.map((d, i) => (
          <span key={i} className="py-1">{d}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: primeiroDia }).map((_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: totalDias }).map((_, i) => {
          const dia = i + 1;
          const iso = toISO(new Date(ano, mes, dia));
          const passado = iso < hojeISO;
          const estado = estadoDoDia(iso);
          const foraDaJanela =
            !modoAdmin &&
            ((dataMinima && iso < dataMinima) || (dataMaxima && iso > dataMaxima));
          const desabilitada = modoAdmin
            ? passado
            : passado || estado !== "disponivel" || foraDaJanela;
          const ativa = selecionadas?.has(iso) ?? false;

          return (
            <button
              key={iso}
              type="button"
              disabled={desabilitada || !onSelecionar}
              onClick={() => onSelecionar?.(iso)}
              title={TITULOS[estado]}
              className={[
                "aspect-square rounded-lg text-sm transition",
                ativa
                  ? "bg-primary text-primary-foreground"
                  : estado !== "disponivel"
                    ? ESTILOS[estado]
                    : desabilitada
                      ? "text-muted-foreground/40"
                      : ESTILOS.disponivel,
              ].join(" ")}
            >
              {dia}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-secondary" /> Disponível
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-accent/60" /> Em análise
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-destructive/20" /> Reservada
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-muted" /> Indisponível
        </span>
      </div>
    </div>
  );
}
