# As Fases do Projeto — Do Simples ao Complexo

*Cada fase é um degrau. No final de cada uma, o sistema já funciona e faz alguma coisa útil.*

---

## Fase 1 — O Núcleo (Em Andamento)

**Objetivo:** Um aplicativo que carrega add-ons.

### O que vai ser construído

#### 1.1 — Os Tipos do Manifesto
Arquivo: `packages/core/src/manifest.ts`

Criar as interfaces TypeScript que definem:
- Como é um manifesto
- Como é um serviço
- Como é o HostAPI
- Como é um add-on carregado

#### 1.2 — A Validação
Arquivo: `packages/core/src/validation.ts`

Uma função que recebe um JSON e diz se ele é um manifesto válido ou não. Verifica:
- Campos obrigatórios
- Formato da versão
- URL do entrypoint
- Estrutura dos serviços

#### 1.3 — O Registry
Arquivo: `packages/core/src/registry.ts`

O coração do sistema. Um mapa que guarda serviços e permite:
- Registrar (add-on oferece um serviço)
- Desregistrar (add-on remove um serviço)
- Consultar (host pede um serviço)
- Listar (host pede todos os serviços de um tipo)

#### 1.4 — O Loader
Arquivo: `packages/core/src/loader.ts`

Responsável por:
- Fazer fetch do manifesto
- Importar o bundle JavaScript
- Chamar o setup do add-on
- Tratar erros em cada etapa

#### 1.5 — Testes do Core
Testes unitários pra tudo que foi criado acima. Registry, validation, loader.

#### 1.6 — Add-on Hello
O primeiro add-on de exemplo. Faz uma coisa simples: registra um serviço de saudação.

#### 1.7 — Add-on Counter
Segundo add-on de exemplo. Registra um serviço de contador (incrementar, decrementar, mostrar valor).

#### 1.8 — Host App
O aplicativo que junta tudo:
- Cria o registry e o loader
- Carrega os add-ons
- Mostra numa lista o que foi carregado
- Permite invocar os serviços

#### 1.9 — Teste Manual
Abrir no navegador, ver os add-ons carregados, testar se funcionam.

---

## Fase 2 — Fallback e Domínio (Planejado)

**Objetivo:** Serviços com fallback automático.

### O que vai ser construído

#### 2.1 — Interfaces Tipadas
Em vez de `registry.get("greeter")` devolver `unknown`, vai devolver um tipo específico: `registry.get<Greeter>("greeter")`.

#### 2.2 — Fallback Automático
Se o serviço de maior prioridade falhar, o registry tenta o próximo automaticamente. O host nem percebe.

#### 2.3 — Add-on Concorrente
Criar um `addon-hello-pt` que registra o mesmo serviço `greeter` mas com prioridade maior. O host troca de implementação sem saber.

#### 2.4 — Testes de Fallback
Testar se o fallback funciona: registrar dois serviços, o de maior prioridade falha, o de menor assume.

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