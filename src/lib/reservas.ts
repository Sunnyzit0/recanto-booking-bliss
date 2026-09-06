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
  coordenadas: { lat: -15.175238575576874, lng: -48.26782284958184 },
  linkGoogleMaps:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent("Rua 41, Lote 03, Setor Leste, Padre Bernardo, GO"),
  instagram: "https://www.instagram.com/_recantodapiscina/",
  capacidade: "até 40 pessoas",
  // Ajuste aqui quando comprar o domínio próprio (ex: https://recantodapiscina.com.br)
  urlBase: "https://www.recantodapiscina.com.br",
  horario: "das 8h às 20h",
  pagamento: "Pix ou dinheiro",
  cancelamento: "Cancelamento gratuito até 7 dias antes da data reservada.",
  // O login do admin agora é feito por senha única, verificada no
  // servidor (variável de ambiente ADMIN_PASSWORD) — veja src/lib/admin-actions.ts.
};

export type Status = "pendente" | "aprovada" | "recusada";

export type Reserva = {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  data: string; // AAAA-MM-DD
  valor: number;
  horario: string;
  status: Status;
  grupo_id?: string | null;
  observacao?: string | null;
};

export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos.replace(/^(\d{0,2})/, "($1");
  if (digitos.length <= 7) return digitos.replace(/^(\d{2})(\d{0,5})/, "($1) $2");
  return digitos.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function telefoneValido(valor: string): boolean {
  return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(valor);
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

// --- Funções usadas pela página PÚBLICA (sem login, chave anônima) ---

export type SolicitacaoInput = {
  nome: string;
  telefone: string;
  email?: string;
  datas: string[]; // 1 a 3 datas (AAAA-MM-DD)
  horario: string;
};

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
/** Checa se o site está aceitando novas reservas no momento */
export async function reservasEstaoAbertas(): Promise<boolean> {
  const { data, error } = await supabase.rpc("reservas_estao_abertas");
  if (error) {
    console.error("Erro ao checar status das reservas:", error.message);
    return true; // por segurança, não trava o formulário por causa de um erro de leitura
  }
  return data ?? true;
}

export type Diferencial = { titulo: string; texto: string };
export type FotoGaleria = { src: string; alt: string; caminho?: string };

export type ConfigPublica = {
  valorDiaria: number;
  capacidade: string;
  horario: string;
  sobreTexto: string;
  diferenciais: Diferencial[];
  regras: string[];
  galeriaFotos: FotoGaleria[];
};

const DIFERENCIAIS_PADRAO: Diferencial[] = [
  { titulo: "Piscina com cascata", texto: "Piscina ampla com chafariz decorativo e iluminação à noite." },
  { titulo: "Churrasqueira e fogão a lenha", texto: "Fogão a lenha, forno e churrasqueira prontos para o dia inteiro de festa." },
  { titulo: "Área gourmet", texto: "Cooktop, pia e bancada de mármore com mesa e banco rústicos." },
  { titulo: "Espaço amplo", texto: "Bastante espaço externo para receber os convidados com conforto." },
  { titulo: "Wi-fi liberado", texto: "Internet disponível em todo o espaço." },
  { titulo: "Lugar tranquilo", texto: "Ambiente calmo, ideal para relaxar e aproveitar o dia com quem você ama." },
];

const CONFIG_PADRAO: ConfigPublica = {
  valorDiaria: 600,
  capacidade: "até 40 pessoas",
  horario: "das 8h às 20h",
  sobreTexto:
    "O aluguel inclui toda a estrutura: piscina com cascata, churrasqueira, fogão a lenha, área " +
    "gourmet completa e wi-fi. Ideal para todo tipo de evento e celebração, dos encontros em " +
    "família às festas maiores.",
  diferenciais: DIFERENCIAIS_PADRAO,
  regras: [],
  galeriaFotos: [],
};

/**
 * Lê preço/capacidade/horário e o conteúdo (sobre, diferenciais,
 * regras, fotos) configurados pelo admin no painel. Se ainda não
 * foram configurados, usa os valores padrão acima.
 */
export async function lerConfigPublica(): Promise<ConfigPublica> {
  const { data, error } = await supabase.rpc("obter_config_publica");
  if (error || !data) {
    console.error("Erro ao ler configuração pública:", error?.message);
    return CONFIG_PADRAO;
  }
  const mapa = Object.fromEntries(
    (data as { chave: string; valor: string }[]).map((c) => [c.chave, c.valor]),
  );
  return {
    valorDiaria: Number(mapa.valor_diaria) || CONFIG_PADRAO.valorDiaria,
    capacidade: mapa.capacidade || CONFIG_PADRAO.capacidade,
    horario: mapa.horario || CONFIG_PADRAO.horario,
    sobreTexto: mapa.sobre_texto || CONFIG_PADRAO.sobreTexto,
    diferenciais: mapa.diferenciais ? JSON.parse(mapa.diferenciais) : CONFIG_PADRAO.diferenciais,
    regras: mapa.regras ? JSON.parse(mapa.regras) : CONFIG_PADRAO.regras,
    galeriaFotos: mapa.galeria_fotos ? JSON.parse(mapa.galeria_fotos) : CONFIG_PADRAO.galeriaFotos,
  };
}

export function janelaDeReserva(): { min: string; max: string } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
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
