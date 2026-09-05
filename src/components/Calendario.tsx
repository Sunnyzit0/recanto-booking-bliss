import { useState } from "react";
import { Lock } from "lucide-react";
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
  const primeiroDiaMesAtual = toISO(new Date(ano, mes, 1));
  const naoPodeVoltar = !modoAdmin && !!dataMinima && primeiroDiaMesAtual <= dataMinima;

  function estadoDoDia(iso: string): Estado {
    if (reservadas.has(iso)) return "reservada";
    if (indisponivelAdmin?.has(iso)) return "indisponivel";
    if (pendentes?.has(iso)) return "pendente";
    return "disponivel";
  }

  const ESTILOS: Record<Estado, string> = {
    disponivel:
      "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300 dark:hover:bg-green-900/70",
    pendente: "bg-orange-300 text-orange-950 dark:bg-orange-600/70 dark:text-orange-50",
    reservada: "bg-red-300 text-red-950 line-through dark:bg-red-700/70 dark:text-red-50",
    // Antes era amarelo, muito parecido com o laranja de "pendente" à
    // primeira vista — trocado por um cinza-azulado (bem mais distante
    // na roda de cores) e reforçado com o ícone de cadeado no dia.
    indisponivel: "bg-slate-400 text-slate-950 line-through dark:bg-slate-600 dark:text-slate-50",
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
          disabled={naoPodeVoltar}
          className="rounded-full px-3 py-1 text-lg text-muted-foreground transition hover:bg-secondary disabled:opacity-30"
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
              <span className="relative flex h-full w-full items-center justify-center">
                {dia}
                {estado === "indisponivel" && (
                  <Lock className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5" aria-hidden="true" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-green-200 dark:bg-green-800" /> Disponível
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-orange-300 dark:bg-orange-600" /> Em análise
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-red-300 dark:bg-red-700" /> Reservada
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-slate-400 dark:bg-slate-600" />
          <Lock className="h-3 w-3" aria-hidden="true" /> Indisponível
        </span>
      </div>
    </div>
  );
}
