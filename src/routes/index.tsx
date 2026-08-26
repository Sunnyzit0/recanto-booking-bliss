import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendario } from "@/components/Calendario";
import { BotaoTema } from "@/components/BotaoTema";
import {
  CONFIG,
  calcularValorDiaria,
  criarSolicitacao,
  escutarBloqueios,
  formatarData,
  janelaDeReserva,
  lerBloqueios,
  lerDatasOcupadas,
  lerDatasPendentes,
} from "@/lib/reservas";

import logo from "@/assets/logo.png";
import fotoPiscina from "@/assets/piscina-dia.jpg";
import fotoArea from "@/assets/piscina-area-externa.jpg";
import fotoGourmet from "@/assets/area-gourmet-churrasqueira.jpg";
import fotoNoite from "@/assets/piscina-noite.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recanto da Piscina — Reserve sua diária em Padre Bernardo, GO" },
      {
        name: "description",
        content:
          "Alugue por diária o Recanto da Piscina: piscina com cascata, churrasqueira, área gourmet e wi-fi. Consulte datas disponíveis e solicite sua reserva.",
      },
      { property: "og:title", content: "Recanto da Piscina — Reserve sua diária" },
      {
        property: "og:description",
        content: "Piscina, churrasqueira e área gourmet em Padre Bernardo, GO. Reserve online.",
      },
    ],
  }),
  component: Home,
});

const DIFERENCIAIS = [
  { titulo: "Piscina com cascata", texto: "Piscina ampla com chafariz decorativo e iluminação à noite." },
  { titulo: "Churrasqueira de alvenaria", texto: "Forno e churrasqueira prontos para o dia inteiro de festa." },
  { titulo: "Área gourmet", texto: "Cooktop, pia e bancada de mármore com mesa e banco rústicos." },
  { titulo: "Estacionamento coberto", texto: "Bastante espaço coberto para os carros dos convidados." },
  { titulo: "Wi-fi liberado", texto: "Internet disponível em todo o espaço." },
  { titulo: "Cercado de verde", texto: "Ambiente tranquilo, rodeado de plantas e vegetação." },
];

const FOTOS = [
  { src: fotoPiscina, alt: "Piscina com cascata do Recanto da Piscina" },
  { src: fotoArea, alt: "Área externa com pergolado e piscina" },
  { src: fotoGourmet, alt: "Área gourmet com churrasqueira de alvenaria e cooktop" },
  { src: fotoNoite, alt: "Piscina iluminada à noite" },
];

function Home() {
  const [datasOcupadas, setDatasOcupadas] = useState<string[]>([]);
  const [datasPendentes, setDatasPendentes] = useState<string[]>([]);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const janela = janelaDeReserva();
  const MAX_DATAS = 3;
  const [datasEscolhidas, setDatasEscolhidas] = useState<string[]>([]);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  async function carregar() {
    const [novasDatas, novasPendentes, novosBloqueios] = await Promise.all([
      lerDatasOcupadas(),
      lerDatasPendentes(),
      lerBloqueios(),
    ]);
    setDatasOcupadas(novasDatas);
    setDatasPendentes(novasPendentes);
    setBloqueios(novosBloqueios);
  }

  useEffect(() => {
    carregar();
    // Bloqueios manuais atualizam na hora; reservas aprovadas por novos
    // clientes aparecem em até 1 minuto (não exigem login pra consultar).
    const parar = escutarBloqueios(() => carregar());
    const intervalo = setInterval(carregar, 60_000);
    return () => {
      parar();
      clearInterval(intervalo);
    };
  }, []);

  const reservadas = new Set(datasOcupadas);
  const indisponivelAdmin = new Set(bloqueios);
  const pendentes = new Set(datasPendentes);

  function alternarData(iso: string) {
    setDatasEscolhidas((atual) => {
      if (atual.includes(iso)) return atual.filter((d) => d !== iso);
      if (atual.length >= MAX_DATAS) return atual;
      return [...atual, iso].sort();
    });
  }

  const valorTotal = datasEscolhidas.reduce((soma, d) => soma + calcularValorDiaria(d), 0);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !telefone || datasEscolhidas.length === 0) return;
    const foraDaJanela = datasEscolhidas.some((d) => d < janela.min || d > janela.max);
    if (foraDaJanela) {
      setErroEnvio("Uma das datas escolhidas está fora do período permitido.");
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      await criarSolicitacao({
        nome,
        telefone,
        datas: datasEscolhidas,
        horario: CONFIG.horario,
      });
      setEnviada(true);
      setNome("");
      setTelefone("");
      setDatasEscolhidas([]);
    } catch (erro) {
      console.error(erro);
      setErroEnvio("Não foi possível enviar sua solicitação. Tente novamente ou chame no WhatsApp.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Topo */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <img
            src={logo}
            alt="Logo Recanto da Piscina"
            className="h-12 w-12 rounded-full object-cover"
          />
          <nav className="flex items-center gap-4 text-sm">
            <a href="#reservar" className="text-muted-foreground transition hover:text-foreground">
              Reservar
            </a>
            <Link to="/admin" className="text-muted-foreground transition hover:text-foreground">
              Admin
            </Link>
            <BotaoTema />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <img
          src={fotoPiscina}
          alt="Piscina do Recanto da Piscina em dia de sol"
          className="h-[60vh] min-h-80 w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-primary/45 px-4">
          <div className="max-w-2xl text-center text-primary-foreground">
            <p className="text-sm tracking-[0.3em] uppercase opacity-90">{CONFIG.subtitulo}</p>
            <h1 className="font-display mt-3 text-4xl leading-tight sm:text-6xl">{CONFIG.nome}</h1>
            <p className="mt-4 text-base opacity-95 sm:text-lg">
              Um refúgio cercado de verde em {CONFIG.cidade}, para reunir a família e celebrar
              momentos com tranquilidade.
            </p>
            <a
              href="#reservar"
              className="mt-7 inline-block rounded-full bg-background px-7 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
            >
              Ver datas disponíveis
            </a>
          </div>
        </div>
      </section>

      {/* Sobre */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="font-display text-3xl text-foreground">Sobre o espaço</h2>
        <p className="mt-4 max-w-3xl text-muted-foreground">
          Espaço para alugar por diária, com capacidade para {CONFIG.capacidade} (pode passar um
          pouco disso). O aluguel inclui toda a estrutura: piscina com cascata, churrasqueira de
          alvenaria, área gourmet completa, estacionamento coberto e wi-fi. Ideal para encontros de
          família, momentos de lazer e pré-eventos como chá de bebê e despedida de solteiro.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIFERENCIAIS.map((d) => (
            <div key={d.titulo} className="shadow-soft rounded-2xl border border-border bg-card p-5">
              <h3 className="font-display text-xl text-foreground">{d.titulo}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{d.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Fotos */}
      <section className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="font-display text-3xl text-foreground">O espaço</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {FOTOS.map((f) => (
            <img
              key={f.src}
              src={f.src}
              alt={f.alt}
              loading="lazy"
              className="h-64 w-full rounded-2xl object-cover"
            />
          ))}
        </div>
      </section>

      {/* Reserva */}
      <section id="reservar" className="bg-secondary/60 py-14">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-display text-3xl text-foreground">Reserve sua data</h2>
          <p className="mt-2 text-muted-foreground">
            Diária: <strong>R$ 600</strong> ({CONFIG.horario}).
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reservas abertas de {formatarData(janela.min)} até {formatarData(janela.max)}. Escolha
            de 1 a {MAX_DATAS} datas — para pacotes de 2 ou mais dias, o desconto é combinado
            diretamente com o dono do espaço.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Calendario
              reservadas={reservadas}
              pendentes={pendentes}
              indisponivelAdmin={indisponivelAdmin}
              dataMinima={janela.min}
              dataMaxima={janela.max}
              selecionadas={new Set(datasEscolhidas)}
              onSelecionar={alternarData}
            />

            <form
              onSubmit={enviar}
              className="shadow-soft flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <h3 className="font-display text-2xl text-foreground">Solicitar reserva</h3>

              <label className="text-sm text-muted-foreground">
                Nome completo
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
                />
              </label>

              <label className="text-sm text-muted-foreground">
                Telefone / WhatsApp
                <input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                  placeholder="(61) 90000-0000"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
                />
              </label>

              <div className="text-sm text-muted-foreground">
                Datas escolhidas ({datasEscolhidas.length}/{MAX_DATAS})
                {datasEscolhidas.length === 0 ? (
                  <p className="mt-1 text-foreground">Clique no calendário ao lado para escolher.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {datasEscolhidas.map((d) => (
                      <li key={d} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-foreground">
                        <span>{formatarData(d)}</span>
                        <span className="flex items-center gap-2">
                          R$ {calcularValorDiaria(d)}
                          <button
                            type="button"
                            onClick={() => alternarData(d)}
                            className="text-destructive hover:underline"
                            aria-label={`Remover ${formatarData(d)}`}
                          >
                            remover
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {datasEscolhidas.length > 0 && (
                  <p className="mt-2 font-medium text-foreground">
                    Total de referência: R$ {valorTotal}
                    {datasEscolhidas.length > 1 && " (desconto a combinar)"}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={enviando || datasEscolhidas.length === 0}
                className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {enviando ? "Enviando..." : "Enviar solicitação"}
              </button>

              {enviada && (
                <p className="rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground">
                  Solicitação enviada! Entraremos em contato pelo telefone {CONFIG.telefone} para
                  confirmar.
                </p>
              )}

              {erroEnvio && (
                <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {erroEnvio}
                </p>
              )}

              <p className="text-xs text-muted-foreground">
                Pagamento: {CONFIG.pagamento}. {CONFIG.cancelamento}
              </p>
            </form>
          </div>

          {datasOcupadas.length > 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              Próximas datas já confirmadas: {datasOcupadas.map(formatarData).join(", ")}
            </p>
          )}
        </div>
      </section>

      {/* Contato */}
      <footer className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="font-display text-3xl text-foreground">Onde estamos</h2>
        <p className="mt-3 text-muted-foreground">{CONFIG.endereco}</p>
        <p className="mt-1 text-muted-foreground">{CONFIG.cidade}</p>
        <p className="mt-1 text-muted-foreground">Telefone: {CONFIG.telefone}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`https://wa.me/${CONFIG.whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-full bg-leaf px-6 py-3 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Falar no WhatsApp
          </a>
          <a
            href={CONFIG.linkGoogleMaps}
            target="_blank"
            rel="noreferrer"
            className="inline-block rounded-full border border-input px-6 py-3 text-sm font-medium text-foreground transition hover:bg-secondary"
          >
            Ver no mapa
          </a>
        </div>
      </footer>
    </main>
  );
}
