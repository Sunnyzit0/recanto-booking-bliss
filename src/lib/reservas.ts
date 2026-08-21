import { supabase } from "@/lib/supabase";

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

export function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function formatarData(iso: string) {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// --- Reservas (tabela "reservas" no Supabase) ---

export async function lerReservas(): Promise<Reserva[]> {
  const { data, error } = await supabase
    .from("reservas")
    .select("*")
    .order("data", { ascending: true });

  if (error) {
    console.error("Erro ao ler reservas:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone,
    data: r.data,
    valor: Number(r.valor),
    horario: r.horario,
    status: r.status,
  }));
}

/** Cria uma nova solicitação de reserva (usado pelo formulário do cliente) */
export async function criarReserva(reserva: Omit<Reserva, "id" | "status">) {
  const { error } = await supabase.from("reservas").insert({
    nome: reserva.nome,
    telefone: reserva.telefone,
    data: reserva.data,
    valor: reserva.valor,
    horario: reserva.horario,
    status: "pendente",
  });

  if (error) throw new Error(error.message);
}

/** Atualiza uma reserva existente (usado pelo painel admin: aprovar/recusar/editar) */
export async function atualizarReserva(id: string, mudanca: Partial<Reserva>) {
  const { error } = await supabase.from("reservas").update(mudanca).eq("id", id);
  if (error) throw new Error(error.message);
}

// --- Bloqueios manuais (tabela "bloqueios" no Supabase) ---

export async function lerBloqueios(): Promise<string[]> {
  const { data, error } = await supabase.from("bloqueios").select("data");
  if (error) {
    console.error("Erro ao ler bloqueios:", error.message);
    return [];
  }
  return (data ?? []).map((b) => b.data);
}

/** Alterna uma data: se já estava bloqueada, libera; senão, bloqueia */
export async function alternarBloqueio(data: string, bloqueadaAtualmente: boolean) {
  if (bloqueadaAtualmente) {
    const { error } = await supabase.from("bloqueios").delete().eq("data", data);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("bloqueios").insert({ data });
    if (error) throw new Error(error.message);
  }
}

/** Datas indisponíveis = bloqueadas pelo dono + reservas aprovadas */
export function datasIndisponiveis(reservas: Reserva[], bloqueios: string[]) {
  return new Set([
    ...bloqueios,
    ...reservas.filter((r) => r.status === "aprovada").map((r) => r.data),
  ]);
}

/** Escuta mudanças em tempo real nas tabelas de reservas e bloqueios */
export function escutarAtualizacoes(callback: () => void) {
  const canal = supabase
    .channel("recanto-mudancas")
    .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, callback)
    .on("postgres_changes", { event: "*", schema: "public", table: "bloqueios" }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
