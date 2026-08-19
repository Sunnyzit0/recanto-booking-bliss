// ---------------------------------------------------------------------------
// CONFIGURAÇÕES DO ESPAÇO — edite aqui livremente
// ---------------------------------------------------------------------------
export const CONFIG = {
  nome: "Recanto da Piscina",
  subtitulo: "Espaço de Eventos",
  telefone: "(61) 99883-4734",
  whatsapp: "5561998834734",
  cidade: "Padre Bernardo - GO, Setor Leste",
  capacidade: "cerca de 15 pessoas",
  valorDiaria: 200, // R$ por diária — altere aqui
  horario: "das 8h às 22h",
  pagamento: "Pix ou dinheiro",
  cancelamento: "Cancelamento gratuito até 24h antes da data reservada.",
  // Senha da área do administrador — troque por uma senha sua
  senhaAdmin: "recanto2026",
};

export type Status = "pendente" | "aprovada" | "recusada";

export type Reserva = {
  id: string;
  nome: string;
  telefone: string;
  data: string; // AAAA-MM-DD
  valor: number;
  horario: string;
  status: Status;
};

// Dados de exemplo (mock). Substitua por um banco de dados quando quiser.
const RESERVAS_INICIAIS: Reserva[] = [
  {
    id: "1",
    nome: "Marina Alves",
    telefone: "(61) 99123-4567",
    data: proximaData(6),
    valor: CONFIG.valorDiaria,
    horario: CONFIG.horario,
    status: "aprovada",
  },
  {
    id: "2",
    nome: "Carlos Ribeiro",
    telefone: "(61) 98877-1122",
    data: proximaData(12),
    valor: CONFIG.valorDiaria,
    horario: CONFIG.horario,
    status: "pendente",
  },
];

const DATAS_BLOQUEADAS_INICIAIS: string[] = [proximaData(9)];

function proximaData(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// --- Armazenamento simples no navegador (troque por banco de dados depois) ---
const KEY_RESERVAS = "recanto:reservas";
const KEY_BLOQUEIOS = "recanto:bloqueios";

function ler<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const bruto = window.localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function salvar(chave: string, valor: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chave, JSON.stringify(valor));
  window.dispatchEvent(new Event("recanto:atualizado"));
}

export function lerReservas() {
  return ler<Reserva[]>(KEY_RESERVAS, RESERVAS_INICIAIS);
}

export function salvarReservas(reservas: Reserva[]) {
  salvar(KEY_RESERVAS, reservas);
}

export function lerBloqueios() {
  return ler<string[]>(KEY_BLOQUEIOS, DATAS_BLOQUEADAS_INICIAIS);
}

export function salvarBloqueios(datas: string[]) {
  salvar(KEY_BLOQUEIOS, datas);
}

/** Datas indisponíveis = bloqueadas pelo dono + reservas aprovadas */
export function datasIndisponiveis(reservas: Reserva[], bloqueios: string[]) {
  return new Set([
    ...bloqueios,
    ...reservas.filter((r) => r.status === "aprovada").map((r) => r.data),
  ]);
}
