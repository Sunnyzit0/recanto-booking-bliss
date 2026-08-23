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
  // O login do admin agora é feito por senha única, verificada no
  // servidor (variável de ambiente ADMIN_PASSWORD) — veja src/server/admin.ts.
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

// --- Funções usadas pela página PÚBLICA (sem login, chave anônima) ---

/** Cria uma nova solicitação de reserva (formulário do cliente) */
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

/**
 * Retorna só as datas já ocupadas (reservas aprovadas), sem nome/telefone
 * de ninguém — usado pelo calendário da página pública.
 */
export async function lerDatasOcupadas(): Promise<string[]> {
  const { data, error } = await supabase.rpc("datas_ocupadas");
  if (error) {
    console.error("Erro ao ler datas ocupadas:", error.message);
    return [];
  }
  return (data ?? []).map((r: { data: string }) => r.data);
}

/** Datas bloqueadas manualmente pelo dono (não contém dados sensíveis) */
export async function lerBloqueios(): Promise<string[]> {
  const { data, error } = await supabase.from("bloqueios").select("data");
  if (error) {
    console.error("Erro ao ler bloqueios:", error.message);
    return [];
  }
  return (data ?? []).map((b) => b.data);
}

/** Escuta mudanças nos bloqueios em tempo real (página pública) */
export function escutarBloqueios(callback: () => void) {
  const canal = supabase
    .channel("recanto-bloqueios-publico")
    .on("postgres_changes", { event: "*", schema: "public", table: "bloqueios" }, callback)
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
