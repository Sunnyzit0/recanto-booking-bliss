import { useState } from "react";
import { toISO } from "@/lib/reservas";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

type Props = {
  /** Datas ocupadas de verdade (aprovadas ou bloqueadas pelo admin) */
  indisponiveis: Set<string>;
  /** Datas com solicitação aguardando aprovação (ainda não confirmadas) */
  pendentes?: Set<string>;
  selecionada?: string;
  onSelecionar?: (data: string) => void;
  /** No modo admin é possível clicar em qualquer data, inclusive as ocupadas */
  modoAdmin?: boolean;
  /** Fora desse período (formato AAAA-MM-DD) a data fica bloqueada pro cliente */
  dataMinima?: string;
  dataMaxima?: string;
};

export function Calendario({
  indisponiveis,
  pendentes,
  selecionada,
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
          const ocupada = indisponiveis.has(iso);
          const pendente = !ocupada && !!pendentes?.has(iso);
          const foraDaJanela =
            !modoAdmin &&
            ((dataMinima && iso < dataMinima) || (dataMaxima && iso > dataMaxima));
          const desabilitada = modoAdmin
            ? passado
            : passado || ocupada || pendente || foraDaJanela;
          const ativa = selecionada === iso;

          return (
            <button
              key={iso}
              type="button"
              disabled={desabilitada || !onSelecionar}
              onClick={() => onSelecionar?.(iso)}
              title={pendente ? "Reserva em análise" : ocupada ? "Ocupada" : undefined}
              className={[
                "aspect-square rounded-lg text-sm transition",
                ativa
                  ? "bg-primary text-primary-foreground"
                  : ocupada
                    ? "bg-destructive/10 text-destructive line-through"
                    : pendente
                      ? "bg-accent/60 text-accent-foreground"
                      : desabilitada
                        ? "text-muted-foreground/40"
                        : "bg-secondary text-secondary-foreground hover:bg-accent",
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
          <span className="h-3 w-3 rounded bg-destructive/20" /> Ocupada
        </span>
      </div>
    </div>
  );
}
