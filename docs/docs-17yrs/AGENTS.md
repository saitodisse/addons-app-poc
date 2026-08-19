# Instruções pra Agentes de IA — addons-app-poc (versão jovem)

Esse arquivo é um conjunto de lembretes pra qualquer agente de IA que vier a trabalhar nesse projeto. É tipo um "manual de boas maneiras" pra não fazer bagunça.

---

## O que é esse projeto?

É uma **prova de conceito** — um experimento. Não é código de verdade pronto pra produção. É um laboratório pra testar uma ideia.

## As regras de convivência

- O código mais importante é o `packages/core`. É o cérebro. O resto depende dele.
- Add-ons (`packages/addon-*`) só podem depender do `core`. Eles não podem importar do `host-app`.
- O `host-app` depende do `core` pra funcionar, mas não depende de nenhum add-on específico.
- As decisões importantes já foram tomadas (tá tudo no `docs/`). Não invente regras novas.

## As decisões que já foram tomadas

1. **URL = identidade** — o que identifica um add-on é o endereço URL do manifesto dele
2. **Manifest + Setup** — add-on exporta um cartão de visita (manifest) e uma função de ativação (setup)
3. **HostAPI mínimo** — o add-on só recebe o necessário: registry, onUnload, log
4. **Prioridade** — serviços têm prioridade; o maior vence, e se falhar, cai pro próximo
5. **Erro no setup = add-on desligado** — quebrou? desativa. O host nem sente.
6. **Fallback automático** — serviço falhou? próximo da fila. Sem stress.
7. **ESM puro** — os add-ons são módulos JavaScript modernos, carregados com `import()`
8. **Testes no core** — o core tem que ser testado. O resto a gente testa na mão.
9. **Manifesto completo** — nome, versão, descrição, autor, entrypoint, serviços

## O que NÃO fazer

- Não misturar esse código com o projeto AC (aquele outro monorepo)
- Não publicar no npm sem autorização
- Não adicionar dependências que não são necessárias
- Não pular os testes
- Se mudar o `core`, atualiza a `docs/` também