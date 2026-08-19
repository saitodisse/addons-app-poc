# As Fases do Projeto — Do Simples ao Complexo

*Cada fase é um degrau. No final de cada uma, o sistema já funciona e faz alguma coisa útil.*

---

## Fase 1 — O Núcleo (Em Andamento)

**Objetivo:** Um aplicativo que carrega add-ons.

### O que vai ser construído

#### 1.1 — O Domínio (tipos, validation, registry)
Arquivos: `packages/core/src/domain/`

O coração puro, sem dependência externa:
- **manifest.ts** — tipos do manifesto (AddonManifest, ServiceRegistration)
- **instance.ts** — AddonInstance (um add-on carregado)
- **host-api.ts** — o que o host oferece pro add-on
- **validation.ts** — função que valida manifesto
- **registry.ts** — o ServiceRegistry, que guarda e resolve serviços

#### 1.2 — As Portas (interfaces)
Arquivos: `packages/core/src/ports/`

Interfaces que o domínio espera do mundo exterior:
- **addon-loader.ts** — "preciso de algo que carregue add-ons"
- **logger.ts** — "preciso de algo que logue mensagens"

#### 1.3 — Os Adaptadores (implementações)
Arquivos: `packages/core/src/adapters/`

Implementações concretas que conectam o domínio ao mundo real:
- **http-loader.ts** — FetchAddonLoader: faz fetch, import(), setup
- **console-logger.ts** — ConsoleLogger: loga no console

#### 1.4 — Testes do Core
Testes unitários pra tudo. O domínio é testado sem fetch, sem I/O — puro.

#### 1.5 — Add-on Hello
O primeiro add-on de exemplo. Faz uma coisa simples: registra um serviço de saudação.

#### 1.6 — Add-on Counter
Segundo add-on de exemplo. Registra um serviço de contador (incrementar, decrementar, mostrar valor).

#### 1.7 — Host App
O aplicativo que junta tudo:
- Cria o registry e os adaptadores
- Carrega os add-ons
- Mostra numa lista o que foi carregado
- Permite invocar os serviços

#### 1.8 — Teste Manual
Abrir no navegador, ver os add-ons carregados, testar se funcionam.

---

## Fase 2 — Fallback e Domínio (Entregue ✅)

**Objetivo:** Serviços com fallback automático.

### O que foi construído

#### 2.1 — Interfaces Tipadas
Em vez de `registry.get("greeter")` devolver `unknown`, agora devolve um tipo específico: `registry.get<Greeter>("greeter")`. As interfaces `Greeter` e `Counter` estão definidas em `@addons/core`.

#### 2.2 — Fallback Automático
Se o serviço de maior prioridade falhar, o `withFallback()` tenta o próximo automaticamente. O host nem percebe. Se todos falharem, um `AggregateFallbackError` é lançado com todos os erros.

#### 2.3 — Add-on Concorrente
O `addon-hello-pt` registra o mesmo serviço `greeter` mas com prioridade 10 (maior que o hello padrão, que é 0). O host troca de implementação sem saber. Se você passar o nome "error", o hello-pt lança um erro, e o fallback automático usa o hello padrão.

#### 2.4 — Testes de Fallback
5 testes que verificam: prioridade, fallback em ação, erro total, implementação única, e nenhuma implementação.

---

## Fase 3 — Descoberta Remota (Planejado)

**Objetivo:** Add-ons carregados de qualquer lugar.

### O que vai ser construído

#### 3.1 — Manifesto Remoto
Loader faz fetch do manifesto de uma URL na internet. Não precisa estar no mesmo computador.

#### 3.2 — Catálogo de Add-ons
Uma lista de add-ons conhecidos que o usuário pode navegar e instalar.

#### 3.3 — Version Negotiation
O manifesto declara "preciso da versão X do host pra funcionar". Se o host for mais velho, o add-on não carrega e avisa o motivo.

---

## Fase 4 — Resiliência (Planejado)

**Objetivo:** Nenhum add-on quebra o host.

### O que vai ser construído

#### 4.1 — Error Boundary
Cada chamada de serviço é isolada. Se um add-on falha, ele não leva os outros junto.

#### 4.2 — Preferências do Usuário
O usuário pode:
- Ligar/desligar add-ons
- Reordenar prioridade (arrastar na lista)
- As preferências são salvas

#### 4.3 — Sandbox (Investigação)
Estudo sobre usar Web Worker ou Iframe pra isolar completamente o add-on do host. Comunicação via mensagens.

---

## Resumo Visual

```
Fase 1: [████████████░░░░] 60% — Núcleo funcionando
Fase 2: [░░░░░░░░░░░░░░] 0%  — Fallback automático
Fase 3: [░░░░░░░░░░░░░░] 0%  — Descoberta remota
Fase 4: [░░░░░░░░░░░░░░] 0%  — Resiliência
```

Cada fase depende da anterior. Mas cada uma é funcional por si só — no final da Fase 1 você já tem algo que roda.