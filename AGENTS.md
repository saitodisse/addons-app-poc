# Guia para agentes de IA

Este arquivo existe para que qualquer agente consiga trabalhar no projeto sem precisar redescobrir suas fronteiras. Primeiro, preserve a ideia central: esta é uma prova de conceito independente. Depois, use as regras técnicas abaixo para manter o experimento coerente.

Responda sempre em **português do Brasil**.

## Antes de alterar qualquer coisa

O **addons-app-poc** não faz parte do ecossistema AC, do monorepo `achorde` nem do `ac15`. Ele pode ter nascido de discussões anteriores, mas hoje é um repositório independente. Não mova código entre esses projetos e não crie dependências com eles.

Inspecione o código e a documentação antes de propor mudanças estruturais. Preserve alterações existentes do usuário e ignore diferenças que não façam parte da tarefa.

## Como o projeto está dividido

Pense no sistema como três áreas com responsabilidades bem separadas:

| Área | Papel | Regra de dependência |
|---|---|---|
| `packages/core/` | Protocolo, regras, portas e adaptadores | É a base compartilhada e a parte mais crítica |
| `packages/host-app/` | Aplicativo que consome os add-ons | Pode depender do `core`, mas não define o protocolo |
| `packages/addon-*/` | Implementações e exemplos | Dependem do `core` ou, no formato HTTP, do `addon-server` |

Nenhum add-on deve importar do `host-app`. Add-ons também não devem criar dependências diretas entre si: a colaboração acontece por contratos e serviços do `core`.

O `core` segue uma arquitetura hexagonal leve:

- `domain/` contém tipos e regras puras.
- `ports/` define o que o núcleo espera do mundo externo.
- `adapters/` implementa essas portas com navegador, rede, console ou armazenamento.

Add-ons de texto e `@addons/addon-server` usam JavaScript ESM puro. Eles não devem carregar o runtime TypeScript do `core` apenas para servir HTTP.

## Decisões que devem permanecer explícitas

As justificativas e consequências estão em [`docs/DECISIONS.md`](docs/DECISIONS.md). Ao alterar uma delas, atualize o código, a especificação e a decisão correspondente.

1. A URL do manifesto é a identidade única do add-on.
2. Um add-on em processo exporta `manifest` e `setup` separadamente.
3. O `HostAPI` expõe apenas `services`, `registerService`, `onUnload` e `log`.
4. Implementações de um mesmo serviço são ordenadas por prioridade explícita.
5. Falha no `setup` deixa a instância do add-on em estado de erro.
6. `withFallback` e `withFallbackAsync` tentam as implementações na ordem de prioridade.
7. Add-ons em processo usam módulos ESM carregáveis com `import()`.
8. As regras críticas do protocolo são testadas no `@addons/core`.
9. Todo manifesto contém metadados completos e declara `services` ou `resources`.
10. Serviços implementam interfaces de domínio explícitas quando houver um contrato público correspondente.
11. Um add-on também pode ser um servidor HTTP no estilo do protocolo Stremio.
12. O recurso `text` responde com `{ texts: [{ id, url, lang, name }] }` e entrega o conteúdo sob demanda.
13. O servidor HTTP de add-ons permanece sem dependências externas de runtime.
14. Serviços podem ser compostos pelo registro, inclusive quando a infraestrutura é fornecida pelo host.

## Como trabalhar com a documentação

Toda explicação deve seguir a mesma ordem:

1. **Por que:** qual problema existe e por que vale resolvê-lo.
2. **O que:** qual é a ideia em linguagem simples.
3. **Como:** quais contratos, fluxos, estados e arquivos implementam a ideia.

Escreva para que uma pessoa inteligente de 16 anos consiga acompanhar. Explique termos técnicos na primeira ocorrência, prefira frases curtas e use tabelas ou listas quando houver três ou mais itens.

Qualquer alteração no `core` exige revisão de `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/MANIFEST-SPEC.md` e `docs/GLOSSARY.md` conforme o impacto.

## Comandos do projeto

| Comando | Uso |
|---|---|
| `pnpm install` | Instalar dependências |
| `pnpm test` | Executar todos os testes |
| `pnpm dev` | Iniciar host e quatro add-ons HTTP |
| `pnpm kill-all` | Encerrar os processos do modo de desenvolvimento |
| `pnpm dev:addons` | Iniciar apenas os servidores HTTP |
| `pnpm --filter @addons/host-app dev` | Iniciar apenas o host |
| `pnpm --filter @addons/addon-text-biblioteca serve` | Iniciar somente o add-on Biblioteca |

Comece pela verificação mais estreita relacionada à mudança. Antes de concluir uma alteração de protocolo, execute também `pnpm test`.

## Convenções

- Use TypeScript em modo estrito nos pacotes TypeScript.
- Nomeie pacotes como `@addons/<nome>`.
- Coloque testes Vitest ao lado do código, no formato `arquivo.test.ts` ou `arquivo.test.js`.
- Mantenha comentários escassos e úteis para explicar decisões não óbvias.
- Evite novas dependências, abstrações genéricas e mudanças fora do escopo.
- Use commits descritivos em português quando houver autorização para criar commits.
- Não publique pacotes no npm sem autorização explícita.

## Estados do projeto

Use somente estes estados nos documentos de planejamento:

- **Planejado:** ainda não começou.
- **Em Andamento:** existe trabalho ativo, mas o resultado não está completo.
- **Entregue:** funciona e foi validado no escopo declarado.
- **Parcial:** parte relevante funciona, mas faltam requisitos conhecidos.
- **Desativado:** deixou de operar por decisão explícita.
- **Substituído:** foi trocado por outra solução registrada.

## Mapa rápido

| Documento | Quando consultar |
|---|---|
| `README.md` | Para entender e executar a POC |
| `docs/PLANNING.md` | Para conhecer a história e a evolução da proposta |
| `docs/PRD.md` | Para conferir escopo e critérios de sucesso |
| `docs/ARCHITECTURE.md` | Antes de qualquer mudança estrutural |
| `docs/DECISIONS.md` | Antes de rever uma decisão já tomada |
| `docs/MANIFEST-SPEC.md` | Ao criar ou alterar um add-on |
| `docs/PHASES.md` | Para distinguir entregas de planos futuros |
| `docs/GLOSSARY.md` | Ao encontrar um termo desconhecido |
| `CHANGELOG.md` | Para entender as mudanças entre versões |
