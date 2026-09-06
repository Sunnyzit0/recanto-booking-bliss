import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, MessageCircle, Plus, Trash2, Upload } from "lucide-react";
import { Calendario } from "@/components/Calendario";
import { BotaoTema } from "@/components/BotaoTema";
import {
  alternarBloqueioAdmin,
  atualizarReservaAdmin,
  atualizarVariasReservasAdmin,
  definirStatusReservas,
  enviarFotoGaleriaAdmin,
  excluirFotoGaleriaAdmin,
  excluirReservasAdmin,
  listarBloqueiosAdmin,
  listarFotosGaleriaAdmin,
  listarReservasAdmin,
  loginAdmin,
  obterConfigSiteAdmin,
  obterConteudoSiteAdmin,
  obterEmailAdmin,
  obterStatusReservas,
  sairAdmin,
  salvarConfigSiteAdmin,
  salvarConteudoSiteAdmin,
  salvarEmailAdmin,
  solicitarRecuperacaoSenha,
  trocarSenhaAdmin,
  verificarSessaoAdmin,
} from "@/lib/admin-actions";
import { formatarData, type Diferencial, type FotoGaleria, type Reserva, type Status } from "@/lib/reservas";

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
  pendente: "bg-orange-200 text-orange-950 dark:bg-orange-600/70 dark:text-orange-50",
  aprovada: "bg-green-200 text-green-950 dark:bg-green-700/70 dark:text-green-50",
  recusada: "bg-red-200 text-red-950 dark:bg-red-700/70 dark:text-red-50",
};

const BORDA_CARD: Record<Status, string> = {
  pendente: "border-l-4 border-l-orange-400 dark:border-l-orange-500",
  aprovada: "border-l-4 border-l-green-500 dark:border-l-green-500",
  recusada: "border-l-4 border-l-red-400 dark:border-l-red-500",
};

const TITULO_SECAO: Record<Status, string> = {
  pendente: "🟠 Pendentes",
  aprovada: "🟢 Aprovadas",
  recusada: "🔴 Recusadas",
};

function linkWhatsApp(telefone: string) {
  const digitos = telefone.replace(/\D/g, "");
  return `https://wa.me/55${digitos}`;
}

function Admin() {
  const [logado, setLogado] = useState(false);
  const [verificandoSessao, setVerificandoSessao] = useState(true);
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [enviandoRecuperacao, setEnviandoRecuperacao] = useState(false);
  const [recuperacaoEnviada, setRecuperacaoEnviada] = useState(false);

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [emailAdmin, setEmailAdmin] = useState("");
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [emailSalvo, setEmailSalvo] = useState(false);

  const [reservasAbertas, setReservasAbertas] = useState(true);
  const [alterandoStatus, setAlterandoStatus] = useState(false);
  const [excluindoIds, setExcluindoIds] = useState<string[]>([]);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<Status | "todas">("todas");

  const [configSite, setConfigSite] = useState({ valorDiaria: 600, capacidade: "", horario: "" });
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [configSalva, setConfigSalva] = useState(false);
  const [senhaConfig, setSenhaConfig] = useState("");
  const [erroConfig, setErroConfig] = useState<string | null>(null);

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [trocandoSenha, setTrocandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [senhaTrocada, setSenhaTrocada] = useState(false);

  const [sobreTexto, setSobreTexto] = useState("");
  const [diferenciais, setDiferenciais] = useState<Diferencial[]>([]);
  const [regras, setRegras] = useState<string[]>([]);
  const [salvandoConteudo, setSalvandoConteudo] = useState(false);
  const [conteudoSalvo, setConteudoSalvo] = useState(false);

  const [fotosGaleria, setFotosGaleria] = useState<FotoGaleria[]>([]);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);
  const [excluindoFoto, setExcluindoFoto] = useState<string | null>(null);

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
    setErro(null);
    const resultado = await loginAdmin({ data: { senha } });
    if (resultado.ok) {
      setLogado(true);
    } else if (resultado.bloqueado) {
      setErro(
        `Muitas tentativas erradas. Tente novamente em ${resultado.minutosRestantes} minuto(s).`,
      );
    } else {
      setErro(
        resultado.tentativasRestantes !== undefined
          ? `Senha incorreta. ${resultado.tentativasRestantes} tentativa(s) restante(s).`
          : "Senha incorreta.",
      );
    }
    setEntrando(false);
  }

  async function pedirRecuperacaoSenha() {
    setEnviandoRecuperacao(true);
    setRecuperacaoEnviada(false);
    try {
      await solicitarRecuperacaoSenha();
      setRecuperacaoEnviada(true);
    } finally {
      setEnviandoRecuperacao(false);
    }
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
    obterEmailAdmin().then((r) => setEmailAdmin(r.email));
    obterStatusReservas().then((r) => setReservasAbertas(r.abertas));
    obterConfigSiteAdmin().then(setConfigSite);
    obterConteudoSiteAdmin().then((r) => {
      setSobreTexto(r.sobreTexto);
      setDiferenciais(r.diferenciais);
      setRegras(r.regras);
    });
    listarFotosGaleriaAdmin().then((r) => setFotosGaleria(r.fotos));
    // Sem login "realtime" do banco aqui — atualiza a cada 20s, e também
    // logo depois de qualquer ação (aprovar, recusar, editar, bloquear).
    const intervalo = setInterval(carregar, 20_000);
    return () => clearInterval(intervalo);
  }, [logado]);

  async function alternarStatusReservas() {
    setAlterandoStatus(true);
    const novoValor = !reservasAbertas;
    try {
      await definirStatusReservas({ data: { abertas: novoValor } });
      setReservasAbertas(novoValor);
    } finally {
      setAlterandoStatus(false);
    }
  }

  async function excluirGrupo(ids: string[]) {
    if (!confirm(`Excluir ${ids.length > 1 ? "essas " + ids.length + " datas" : "essa reserva"}? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setExcluindoIds((atual) => [...atual, ...ids]);
    try {
      await excluirReservasAdmin({ data: { ids } });
      setReservas((atual) => atual.filter((r) => !ids.includes(r.id)));
    } finally {
      setExcluindoIds((atual) => atual.filter((id) => !ids.includes(id)));
    }
  }

  async function salvarEmail(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoEmail(true);
    setEmailSalvo(false);
    try {
      await salvarEmailAdmin({ data: { email: emailAdmin } });
      setEmailSalvo(true);
    } finally {
      setSalvandoEmail(false);
    }
  }

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoConfig(true);
    setConfigSalva(false);
    setErroConfig(null);
    try {
      const resultado = await salvarConfigSiteAdmin({ data: { ...configSite, senhaAtual: senhaConfig } });
      if (resultado.ok) {
        setConfigSalva(true);
        setSenhaConfig("");
      } else {
        setErroConfig(resultado.erro ?? "Não foi possível salvar.");
      }
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function salvarConteudo(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoConteudo(true);
    setConteudoSalvo(false);
    try {
      await salvarConteudoSiteAdmin({ data: { sobreTexto, diferenciais, regras } });
      setConteudoSalvo(true);
    } finally {
      setSalvandoConteudo(false);
    }
  }

  function atualizarDiferencial(indice: number, campo: "titulo" | "texto", valor: string) {
    setDiferenciais((atual) =>
      atual.map((d, i) => (i === indice ? { ...d, [campo]: valor } : d)),
    );
    setConteudoSalvo(false);
  }

  function adicionarDiferencial() {
    setDiferenciais((atual) => [...atual, { titulo: "", texto: "" }]);
    setConteudoSalvo(false);
  }

  function removerDiferencial(indice: number) {
    setDiferenciais((atual) => atual.filter((_, i) => i !== indice));
    setConteudoSalvo(false);
  }

  function atualizarRegra(indice: number, valor: string) {
    setRegras((atual) => atual.map((r, i) => (i === indice ? valor : r)));
    setConteudoSalvo(false);
  }

  function adicionarRegra() {
    setRegras((atual) => [...atual, ""]);
    setConteudoSalvo(false);
  }

  function removerRegra(indice: number) {
    setRegras((atual) => atual.filter((_, i) => i !== indice));
    setConteudoSalvo(false);
  }

  function arquivoParaBase64(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve((leitor.result as string).split(",")[1]);
      leitor.onerror = reject;
      leitor.readAsDataURL(arquivo);
    });
  }

  /** Redimensiona/comprime a imagem no navegador antes de enviar, pra
   * não sobrecarregar o upload com fotos gigantes de celular. */
  function comprimirImagem(arquivo: File, ladoMaximo = 1600, qualidade = 0.82): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(arquivo);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const escala = Math.min(1, ladoMaximo / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Falha ao comprimir imagem"));
            resolve(new File([blob], arquivo.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          qualidade,
        );
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;

    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      const comprimido = await comprimirImagem(arquivo);
      const dadosBase64 = await arquivoParaBase64(comprimido);
      const resultado = await enviarFotoGaleriaAdmin({
        data: {
          nomeArquivo: comprimido.name,
          tipoMime: "image/jpeg",
          dadosBase64,
          alt: "Foto do Recanto da Piscina",
        },
      });
      if (resultado.ok) {
        setFotosGaleria(resultado.fotos);
      } else {
        setErroFoto(resultado.erro ?? "Não foi possível enviar a foto.");
      }
    } catch {
      setErroFoto("Não foi possível processar essa imagem.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function excluirFoto(caminho: string | undefined) {
    if (!caminho) return;
    if (!confirm("Excluir essa foto da galeria?")) return;
    setExcluindoFoto(caminho);
    try {
      const resultado = await excluirFotoGaleriaAdmin({ data: { caminho } });
      setFotosGaleria(resultado.fotos);
    } finally {
      setExcluindoFoto(null);
    }
  }

  async function trocarSenha(e: React.FormEvent) {
    e.preventDefault();
    setErroSenha(null);
    setSenhaTrocada(false);
    if (novaSenha.length < 6) {
      setErroSenha("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarNovaSenha) {
      setErroSenha("As senhas novas não são iguais.");
      return;
    }
    setTrocandoSenha(true);
    try {
      const resultado = await trocarSenhaAdmin({ data: { senhaAtual, novaSenha } });
      if (resultado.ok) {
        setSenhaTrocada(true);
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarNovaSenha("");
      } else {
        setErroSenha(resultado.erro ?? "Não foi possível trocar a senha.");
      }
    } finally {
      setTrocandoSenha(false);
    }
  }

  async function atualizar(id: string, mudanca: Partial<Reserva>) {
    setReservas((atual) => atual.map((r) => (r.id === id ? { ...r, ...mudanca } : r)));
    await atualizarReservaAdmin({ data: { id, mudanca } });
  }

  async function atualizarGrupo(ids: string[], mudanca: Partial<Reserva>) {
    setReservas((atual) => atual.map((r) => (ids.includes(r.id) ? { ...r, ...mudanca } : r)));
    await atualizarVariasReservasAdmin({ data: { ids, mudanca } });
  }

  /** Agrupa as reservas que vieram do mesmo pedido (mesmo grupo_id) */
  function agruparReservas(lista: Reserva[]) {
    const grupos = new Map<string, Reserva[]>();
    for (const r of lista) {
      const chave = r.grupo_id ?? r.id;
      grupos.set(chave, [...(grupos.get(chave) ?? []), r]);
    }
    return Array.from(grupos.values());
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
              setErro(null);
            }}
            placeholder="Senha"
            autoComplete="current-password"
            className="mt-5 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
          />
          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
          <button
            type="submit"
            disabled={entrando}
            className="mt-4 w-full rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {entrando ? "Entrando..." : "Entrar"}
          </button>
          <button
            type="button"
            onClick={pedirRecuperacaoSenha}
            disabled={enviandoRecuperacao}
            className="mt-3 block w-full text-center text-sm text-muted-foreground hover:underline disabled:opacity-60"
          >
            {enviandoRecuperacao ? "Enviando..." : "Esqueci minha senha"}
          </button>
          {recuperacaoEnviada && (
            <p className="mt-2 text-center text-sm text-leaf">
              Se houver um e-mail cadastrado, um link foi enviado pra ele.
            </p>
          )}
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
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="text-muted-foreground hover:underline">Ver site</Link>
          <button onClick={sair} className="text-muted-foreground hover:underline">
            Sair
          </button>
          <BotaoTema />
        </div>
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {(() => {
          const hojeISO = new Date().toISOString().slice(0, 10);
          const mesAtual = hojeISO.slice(0, 7);
          const pendentes = new Set(
            reservas.filter((r) => r.status === "pendente").map((r) => r.grupo_id ?? r.id),
          ).size;
          const aprovadasEsteMes = reservas.filter(
            (r) => r.status === "aprovada" && r.data.slice(0, 7) === mesAtual,
          ).length;
          const proxima = reservas
            .filter((r) => r.status === "aprovada" && r.data >= hojeISO)
            .sort((a, b) => a.data.localeCompare(b.data))[0];

          return (
            <>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Solicitações pendentes</p>
                <p className="font-display text-3xl text-foreground">{pendentes}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Aprovadas este mês</p>
                <p className="font-display text-3xl text-foreground">{aprovadasEsteMes}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Próxima reserva</p>
                <p className="font-display text-2xl text-foreground">
                  {proxima ? formatarData(proxima.data) : "—"}
                </p>
              </div>
            </>
          );
        })()}
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl text-foreground">Aviso por e-mail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toda vez que chegar uma reserva nova, mandamos um e-mail pra esse endereço com um resumo
          e botões pra aprovar ou recusar direto, sem precisar entrar aqui no painel.
        </p>
        <form onSubmit={salvarEmail} className="mt-4 flex flex-wrap gap-3">
          <input
            type="email"
            value={emailAdmin}
            onChange={(e) => {
              setEmailAdmin(e.target.value);
              setEmailSalvo(false);
            }}
            placeholder="seuemail@exemplo.com"
            required
            className="min-w-64 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
          />
          <button
            type="submit"
            disabled={salvandoEmail}
            className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {salvandoEmail ? "Salvando..." : "Salvar"}
          </button>
        </form>
        {emailSalvo && <p className="mt-2 text-sm text-leaf">E-mail salvo com sucesso.</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-foreground">Receber novas reservas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {reservasAbertas
                ? "O site está aceitando novas solicitações de reserva normalmente."
                : "As novas solicitações estão pausadas — o site mostra um aviso pro cliente."}
            </p>
          </div>
          <button
            onClick={alternarStatusReservas}
            disabled={alterandoStatus}
            className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-60 ${
              reservasAbertas
                ? "bg-destructive text-destructive-foreground shadow-md hover:opacity-90"
                : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {reservasAbertas && <AlertTriangle className="h-4 w-4" />}
            {alterandoStatus ? "Salvando..." : reservasAbertas ? "Pausar reservas" : "Reativar reservas"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl text-foreground">Preço, capacidade e horário</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Esses valores aparecem no site pro cliente. Edite aqui sem precisar mexer em código.
        </p>
        <form onSubmit={salvarConfig} className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">
            Valor da diária (R$)
            <input
              type="number"
              value={configSite.valorDiaria}
              onChange={(e) => {
                setConfigSite((c) => ({ ...c, valorDiaria: Number(e.target.value) }));
                setConfigSalva(false);
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Capacidade
            <input
              value={configSite.capacidade}
              onChange={(e) => {
                setConfigSite((c) => ({ ...c, capacidade: e.target.value }));
                setConfigSalva(false);
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Horário
            <input
              value={configSite.horario}
              onChange={(e) => {
                setConfigSite((c) => ({ ...c, horario: e.target.value }));
                setConfigSalva(false);
              }}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <label className="text-xs text-muted-foreground sm:col-span-3">
            Confirme sua senha pra salvar
            <input
              type="password"
              value={senhaConfig}
              onChange={(e) => {
                setSenhaConfig(e.target.value);
                setErroConfig(null);
              }}
              placeholder="Senha atual"
              autoComplete="current-password"
              required
              className="mt-1 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={salvandoConfig}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {salvandoConfig ? "Salvando..." : "Salvar"}
            </button>
            {configSalva && <span className="ml-3 text-sm text-leaf">Salvo com sucesso.</span>}
            {erroConfig && <p className="mt-2 text-sm text-destructive">{erroConfig}</p>}
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl text-foreground">Conteúdo do site</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Edite o texto "Sobre o espaço", os destaques e as regras do local — aparecem no site na
          hora, sem precisar de código.
        </p>

        <form onSubmit={salvarConteudo} className="mt-5 space-y-6">
          <label className="block text-xs text-muted-foreground">
            Texto "Sobre o espaço" (depois de "com capacidade para X pessoas.")
            <textarea
              value={sobreTexto}
              onChange={(e) => {
                setSobreTexto(e.target.value);
                setConteudoSalvo(false);
              }}
              rows={4}
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Destaques (cards)</p>
              <button
                type="button"
                onClick={adicionarDiferencial}
                className="flex items-center gap-1 text-sm text-leaf hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {diferenciais.map((d, i) => (
                <div key={i} className="flex gap-2 rounded-xl bg-secondary/40 p-3">
                  <div className="flex-1 space-y-2">
                    <input
                      value={d.titulo}
                      onChange={(e) => atualizarDiferencial(i, "titulo", e.target.value)}
                      placeholder="Título"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                    <textarea
                      value={d.texto}
                      onChange={(e) => atualizarDiferencial(i, "texto", e.target.value)}
                      placeholder="Descrição"
                      rows={2}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removerDiferencial(i)}
                    aria-label="Remover destaque"
                    className="self-start rounded-full p-2 text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Regras do espaço</p>
              <button
                type="button"
                onClick={adicionarRegra}
                className="flex items-center gap-1 text-sm text-leaf hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Enquanto a lista estiver vazia, essa seção não aparece no site.
            </p>
            <div className="mt-3 space-y-2">
              {regras.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={r}
                    onChange={(e) => atualizarRegra(i, e.target.value)}
                    placeholder="Ex: Não é permitido som após as 22h"
                    className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => removerRegra(i)}
                    aria-label="Remover regra"
                    className="rounded-full p-2 text-destructive transition hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={salvandoConteudo}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {salvandoConteudo ? "Salvando..." : "Salvar conteúdo"}
            </button>
            {conteudoSalvo && <span className="ml-3 text-sm text-leaf">Salvo com sucesso.</span>}
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl text-foreground">Galeria de fotos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Adicione ou remova as fotos que aparecem na seção "O espaço" do site.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotosGaleria.map((f) => (
            <div key={f.caminho ?? f.src} className="group relative overflow-hidden rounded-xl">
              <img src={f.src} alt={f.alt} className="h-32 w-full object-cover" />
              <button
                type="button"
                onClick={() => excluirFoto(f.caminho)}
                disabled={excluindoFoto === f.caminho}
                aria-label="Excluir foto"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-muted-foreground transition hover:border-ring hover:text-foreground">
            {enviandoFoto ? (
              <span className="text-xs">Enviando...</span>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                <span className="text-xs">Adicionar foto</span>
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={enviarFoto}
              disabled={enviandoFoto}
              className="hidden"
            />
          </label>
        </div>
        {erroFoto && <p className="mt-2 text-sm text-destructive">{erroFoto}</p>}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl text-foreground">Trocar senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">Muda a senha de acesso a esse painel.</p>
        <form onSubmit={trocarSenha} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            placeholder="Senha atual"
            autoComplete="current-password"
            required
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Nova senha"
            autoComplete="new-password"
            required
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            type="password"
            value={confirmarNovaSenha}
            onChange={(e) => setConfirmarNovaSenha(e.target.value)}
            placeholder="Confirmar nova senha"
            autoComplete="new-password"
            required
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={trocandoSenha}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {trocandoSenha ? "Salvando..." : "Trocar senha"}
            </button>
            {senhaTrocada && <span className="ml-3 text-sm text-leaf">Senha trocada com sucesso.</span>}
            {erroSenha && <p className="mt-2 text-sm text-destructive">{erroSenha}</p>}
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl text-foreground">Solicitações</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome..."
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as Status | "todas")}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="aprovada">Aprovadas</option>
              <option value="recusada">Recusadas</option>
            </select>
          </div>
        </div>
        <div className="mt-4 space-y-6">
          {carregando && <p className="text-sm text-muted-foreground">Carregando reservas...</p>}
          {!carregando && reservas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação recebida ainda.</p>
          )}
          {(() => {
            const filtradas = reservas.filter(
              (r) =>
                (filtroStatus === "todas" || r.status === filtroStatus) &&
                r.nome.toLowerCase().includes(busca.toLowerCase()),
            );
            const grupos = agruparReservas(filtradas);
            const ordem: Status[] = ["pendente", "aprovada", "recusada"];
            const secoes = ordem
              .map((status) => ({ status, grupos: grupos.filter((g) => g[0].status === status) }))
              .filter((s) => s.grupos.length > 0);

            if (!carregando && secoes.length === 0 && reservas.length > 0) {
              return (
                <p className="text-sm text-muted-foreground">
                  Nenhuma solicitação encontrada com esse filtro.
                </p>
              );
            }

            return secoes.map(({ status, grupos: gruposDoStatus }) => (
              <div key={status}>
                <h3 className="mb-3 flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${CORES[status]}`}>
                    {status} ({gruposDoStatus.length})
                  </span>
                </h3>
                <div className="space-y-4">
                  {gruposDoStatus.map((grupo) => {
                    const primeira = grupo[0];
                    const ids = grupo.map((r) => r.id);
                    const valorTotal = grupo.reduce((soma, r) => soma + r.valor, 0);
                    return (
                      <div
                        key={ids.join("-")}
                        className={`shadow-soft rounded-2xl border border-border bg-card p-5 ${BORDA_CARD[primeira.status]}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{primeira.nome}</p>
                            <a
                              href={linkWhatsApp(primeira.telefone)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 text-sm text-leaf hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {primeira.telefone}
                            </a>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs capitalize ${CORES[primeira.status]}`}>
                            {primeira.status}
                          </span>
                        </div>

                        {grupo.length > 1 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Pedido com {grupo.length} datas — total de referência R$ {valorTotal} (desconto a
                            combinar)
                          </p>
                        )}

                        <div className="mt-4 space-y-3">
                          {grupo.map((r) => (
                            <div key={r.id} className="grid gap-3 rounded-xl bg-secondary/40 p-3 sm:grid-cols-3">
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
                              <label className="text-xs text-muted-foreground sm:col-span-3">
                                Observação
                                <textarea
                                  value={r.observacao ?? ""}
                                  onChange={(e) => atualizar(r.id, { observacao: e.target.value })}
                                  placeholder="Ex: cliente confirmou por telefone, pediu 1h a mais..."
                                  rows={2}
                                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                                />
                              </label>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => atualizarGrupo(ids, { status: "aprovada" })}
                            className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground transition hover:opacity-90"
                          >
                            {grupo.length > 1 ? "Aprovar todas" : "Aprovar"}
                          </button>
                          <button
                            onClick={() => atualizarGrupo(ids, { status: "recusada" })}
                            className="rounded-full border border-input px-5 py-2 text-sm text-foreground transition hover:bg-secondary"
                          >
                            {grupo.length > 1 ? "Recusar todas" : "Recusar"}
                          </button>
                          <button
                            onClick={() => excluirGrupo(ids)}
                            disabled={ids.some((id) => excluindoIds.includes(id))}
                            className="rounded-full border border-destructive/40 px-5 py-2 text-sm text-destructive transition hover:bg-destructive/10 disabled:opacity-60"
                          >
                            {ids.some((id) => excluindoIds.includes(id)) ? "Excluindo..." : "Excluir"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
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
            reservadas={new Set(reservas.filter((r) => r.status === "aprovada").map((r) => r.data))}
            pendentes={new Set(reservas.filter((r) => r.status === "pendente").map((r) => r.data))}
            indisponivelAdmin={new Set(bloqueios)}
            onSelecionar={alternarBloqueio}
          />
        </div>
      </section>
    </main>
  );
}
