import { createServerFn } from "@tanstack/react-start";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { Resend } from "resend";
import { segredoSessao, supabaseAdmin, traduzirErroBanco } from "@/lib/admin-actions";
import { CONFIG, calcularValorDiaria, formatarData } from "@/lib/reservas";

// Instância própria (não compartilhada com admin-actions.ts) — evita um
// bug de separação cliente/servidor quando a mesma instância é usada
// em mais de um arquivo.

// ---------------------------------------------------------------------------
// Roda só no servidor. Cuida de: (1) gravar a solicitação de reserva com
// tudo validado, (2) mandar um e-mail pro dono com um resumo e dois links
// (Aprovar / Recusar) que abrem uma página de confirmação simples — sem
// precisar fazer login no /admin pra decidir.
// ---------------------------------------------------------------------------

function resend() {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("RESEND_API_KEY não configurada no servidor.");
  return new Resend(chave);
}

// --- Token de confirmação (assinado, com validade de 7 dias) ---
// Guarda dentro dele: quais reservas afeta (ids) e pra qual status vai
// (aprovada/recusada) — assim o link já sabe exatamente o que fazer,
// sem precisar de login.

const VALIDADE_TOKEN_MS = 1000 * 60 * 60 * 24 * 7;

type Payload = { ids: string[]; status: "aprovada" | "recusada"; expiraEm: number };

function assinarToken(payload: Omit<Payload, "expiraEm">): string {
  const expiraEm = Date.now() + VALIDADE_TOKEN_MS;
  const corpo = Buffer.from(JSON.stringify({ ...payload, expiraEm })).toString("base64url");
  const assinatura = createHmac("sha256", segredoSessao()).update(corpo).digest("hex");
  return `${corpo}.${assinatura}`;
}

function lerToken(token: string): Payload | null {
  const [corpo, assinatura] = token.split(".");
  if (!corpo || !assinatura) return null;

  const esperada = createHmac("sha256", segredoSessao()).update(corpo).digest("hex");
  const bufA = Buffer.from(assinatura, "hex");
  const bufB = Buffer.from(esperada, "hex");
  if (bufA.length !== bufB.length || !timingSafeEqual(bufA, bufB)) return null;

  try {
    const payload = JSON.parse(Buffer.from(corpo, "base64url").toString()) as Payload;
    if (!payload.expiraEm || Date.now() > payload.expiraEm) return null;
    return payload;
  } catch {
    return null;
  }
}

// --- Criar solicitação (chamado pelo formulário público) ---

const CriarSolicitacaoSchema = z.object({
  nome: z.string().trim().min(3).max(150),
  telefone: z.string().regex(/^\(\d{2}\) \d{4,5}-\d{4}$/),
  email: z.string().email().max(200).optional().or(z.literal("")),
  datas: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(3),
  horario: z.string().min(1).max(100),
});

export const criarSolicitacaoServidor = createServerFn({ method: "POST" })
  .validator(CriarSolicitacaoSchema)
  .handler(async ({ data }) => {
    const client = supabaseAdmin();
    const grupoId = crypto.randomUUID();
    const linhas = data.datas.map((d) => ({
      nome: data.nome,
      telefone: data.telefone,
      email: data.email || null,
      data: d,
      valor: calcularValorDiaria(d),
      horario: data.horario,
      status: "pendente" as const,
      grupo_id: grupoId,
    }));

    const { data: inseridas, error } = await client.from("reservas").insert(linhas).select("id");
    if (error) traduzirErroBanco(error);

    const ids = (inseridas ?? []).map((r) => r.id as string);

    // Manda o e-mail pro dono, mas se der erro no e-mail a reserva já
    // foi gravada — não trava o cliente por causa disso.
    try {
      await enviarEmailNovaReserva({ ...data, ids });
    } catch (erroEmail) {
      console.error("Falha ao enviar e-mail de notificação:", erroEmail);
    }

    return { ok: true };
  });

async function enviarEmailNovaReserva(dados: {
  nome: string;
  telefone: string;
  email?: string;
  datas: string[];
  horario: string;
  ids: string[];
}) {
  const { data: config } = await supabaseAdmin()
    .from("configuracoes")
    .select("valor")
    .eq("chave", "email_admin")
    .maybeSingle();

  const emailAdmin = config?.valor;
  if (!emailAdmin) {
    console.warn("Nenhum e-mail de admin configurado — aviso não enviado.");
    return;
  }

  const valorTotal = dados.datas.reduce((soma, d) => soma + calcularValorDiaria(d), 0);
  const linkAprovar = `${CONFIG.urlBase}/confirmar?token=${assinarToken({ ids: dados.ids, status: "aprovada" })}`;
  const linkRecusar = `${CONFIG.urlBase}/confirmar?token=${assinarToken({ ids: dados.ids, status: "recusada" })}`;

  const listaDatas = dados.datas.map(formatarData).join(", ");

  await resend().emails.send({
    from: "Recanto da Piscina <onboarding@resend.dev>",
    to: emailAdmin,
    subject: `Nova solicitação de reserva — ${listaDatas}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #0C4137;">Nova solicitação de reserva</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
          <tr><td style="padding: 6px 0; color: #555;">Nome</td><td style="padding: 6px 0;"><strong>${dados.nome}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Telefone</td><td style="padding: 6px 0;">${dados.telefone}</td></tr>
          ${dados.email ? `<tr><td style="padding: 6px 0; color: #555;">E-mail</td><td style="padding: 6px 0;">${dados.email}</td></tr>` : ""}
          <tr><td style="padding: 6px 0; color: #555;">Data(s)</td><td style="padding: 6px 0;">${listaDatas}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Horário</td><td style="padding: 6px 0;">${dados.horario}</td></tr>
          <tr><td style="padding: 6px 0; color: #555;">Valor de referência</td><td style="padding: 6px 0;">R$ ${valorTotal}</td></tr>
        </table>
        <div style="margin-top: 24px;">
          <a href="${linkAprovar}" style="background: #06D6A0; color: #0C4137; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold; margin-right: 12px;">Aprovar</a>
          <a href="${linkRecusar}" style="background: #eee; color: #333; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">Recusar</a>
        </div>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">
          Os links acima abrem uma página de confirmação simples (pra evitar cliques acidentais). Você também pode gerenciar tudo pelo painel do site em ${CONFIG.urlBase}/admin.
        </p>
      </div>
    `,
  });
}

// --- Confirmação via link do e-mail (sem precisar de login) ---

export const lerConfirmacaoPorToken = createServerFn({ method: "GET" })
  .validator(z.object({ token: z.string().min(10) }))
  .handler(async ({ data }) => {
    const payload = lerToken(data.token);
    if (!payload) return { valido: false as const };

    const { data: reservas, error } = await supabaseAdmin()
      .from("reservas")
      .select("id, nome, telefone, data, valor, horario, status")
      .in("id", payload.ids);
    if (error || !reservas || reservas.length === 0) return { valido: false as const };

    return { valido: true as const, acao: payload.status, reservas };
  });

export const executarConfirmacaoPorToken = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(10) }))
  .handler(async ({ data }) => {
    const payload = lerToken(data.token);
    if (!payload) throw new Error("Link inválido ou expirado.");

    const { error } = await supabaseAdmin()
      .from("reservas")
      .update({ status: payload.status })
      .in("id", payload.ids);
    if (error) traduzirErroBanco(error);

    return { ok: true, acao: payload.status };
  });
