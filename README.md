# Recanto Reserva Fácil

Prompt para gerar o site — Recanto da Piscina

Copie o texto abaixo e cole na ferramenta de IA (Lovable, v0, Bolt.new).

Crie um site de reservas para o Recanto da Piscina, um espaço de eventos e lazer localizado em Padre Bernardo, GO (Setor Leste). Telefone de contato: (61) 99883-4734.

Sobre o local: Espaço para alugar por diária, com capacidade para cerca de 15 pessoas (pode passar um pouco disso). O aluguel inclui toda a estrutura: piscina (com cascata/chafariz decorativo), churrasqueira de alvenaria, área gourmet com cooktop, pia e bancada de mármore, mesa e banco rústicos de madeira, bastante espaço coberto para estacionar carros, e wi-fi. É um ambiente cercado de plantas e vegetação — ideal para reunir a família, curtir momentos de lazer, ou realizar pré-eventos como chá de bebê e despedida de solteiro, com conforto e tranquilidade.

Estilo visual: vibe natureza — tons verdes e azuis (a logo do local já usa essas cores, com folhagem e uma onda), tipografia elegante, transmitindo calma e acolhimento. Vou fornecer a logo e fotos reais do espaço (piscina, churrasqueira, área gourmet, fachada) para usar no site — pode usar placeholders temporários nesses espaços, mas deixe a estrutura pronta para eu substituir facilmente pelas imagens reais.

Estrutura do site — DUAS ÁREAS:

Área do Cliente (pública):

Página inicial com fotos do espaço, descrição, diferenciais e localização

Calendário mostrando as datas disponíveis para reserva (datas já ocupadas aparecem bloqueadas)

Formulário de solicitação de reserva: nome, telefone, data desejada

Informação de valor de referência: R$200 por diária (das 8h às 22h) — deixar fácil de editar depois, pois o valor pode variar

Informações de pagamento (Pix ou dinheiro) e política de cancelamento (até 24h de antecedência)

Área do Administrador (privada, com login):

Login separado, acessível só pelo dono

Lista de todas as solicitações de reserva recebidas (nome do cliente, telefone, data solicitada, status)

Permite aprovar ou recusar uma reserva

Permite editar valor e horário de cada reserva

Permite bloquear ou liberar datas no calendário de disponibilidade

Requisitos técnicos:

Manter a estrutura do código simples e organizada (poucos componentes, lógica direta, sem bibliotecas extras desnecessárias) — o site vai ser editado manualmente depois por alguém com conhecimento básico de programação

Design responsivo (funcionar bem em celular, já que a maioria dos clientes vai acessar pelo celular)

Pode usar dados de exemplo (mock) por enquanto nas reservas, sem precisar integrar banco de dados ainda

Depois de gerar: exporte o código ou compartilhe o link do projeto para revisão e ajustes finais (integração com banco de dados real, autenticação da área admin, etc.).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5bab8801-1c81-4aa9-a8fe-0f5ac39abd0d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
