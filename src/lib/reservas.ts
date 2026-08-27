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
  endereco: "Rua 41, Lote 03, Setor Leste",
  coordenadas: { lat: -15.175349, lng: -48.26786 },
  linkGoogleMaps:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Rua 41, Lote 03, Setor Leste, Padre Bernardo, GO"),
  capacidade: "até 40 pessoas",
  horario: "das 8h às 20h (12 horas)",
  pagamento: "Pix ou dinheiro",
  cancelamento: "Cancelamento gratuito até 7 dias antes da data reservada.",
  // O login do admin agora é feito por senha única, verificada no
  // servidor (variável de ambiente ADMIN_PASSWORD) — veja src/lib/admin-actions.ts.
};

/** Valor da diária: R$600, fixo. */
export function calcularValorDiaria(_dataISO: string): number {
  return 600;
}

export type Status = "pendente" | "aprovada" | "recusada";

export type Reserva = {
  id: string;
  nome: string;
  telefone: string;
  data: string; // AAAA-MM-DD
  valor: number;
  horario: string;
  status: Status;
  grupo_id?: string | null;
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

export type SolicitacaoInput = {
  nome: string;
  telefone: string;
  datas: string[]; // 1 a 3 datas (AAAA-MM-DD)
  horario: string;
};

/**
 * Cria uma solicitação de reserva — o cliente pode escolher de 1 a 3
 * datas de uma vez. Todas as datas ficam ligadas por um "grupo_id",
 * pra aparecerem juntas no painel do admin e serem aprovadas/recusadas
 * em conjunto. O valor de cada dia é calculado individualmente (útil
 * quando o pedido cruza a data do reajuste de preço); o desconto por
 * pacote é combinado diretamente entre o dono e o cliente.
 */
export async function criarSolicitacao({ nome, telefone, datas, horario }: SolicitacaoInput) {
  if (datas.length < 1 || datas.length > 3) {
    throw new Error("Escolha de 1 a 3 datas.");
  }
  const grupoId = crypto.randomUUID();
  const linhas = datas.map((data) => ({
    nome,
    telefone,
    data,
    valor: calcularValorDiaria(data),
    horario,
    status: "pendente" as const,
    grupo_id: grupoId,
  }));
  const { error } = await supabase.from("reservas").insert(linhas);
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

/**
 * Retorna as datas com solicitação PENDENTE (aguardando aprovação do
 * admin), sem nome/telefone — usado pra mostrar "Em análise" no calendário.
 */
export async function lerDatasPendentes(): Promise<string[]> {
  const { data, error } = await supabase.rpc("datas_pendentes");
  if (error) {
    console.error("Erro ao ler datas pendentes:", error.message);
    return [];
  }
  return (data ?? []).map((r: { data: string }) => r.data);
}

/**
 * Janela de datas permitida pro cliente reservar: só os PRÓXIMOS 6
 * meses, sem contar o mês atual. Ex.: hoje em agosto → libera de
 * setembro até fevereiro. O mesmo limite também é aplicado no banco
 * de dados (não depende só disso aqui pra ser seguro).
 */
export function janelaDeReserva(): { min: string; max: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 7, 0);
  return { min: toISO(inicio), max: toISO(fim) };
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
