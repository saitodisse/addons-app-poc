# Product Requirements Document — addons-app-poc

**Status: Planejado** · **Versão: 1.0.0** · **Data: 2025**

---

## 1. Resumo Executivo

O addons-app-poc é uma prova de conceito de um sistema de add-ons universal para aplicações web TypeScript. O objetivo é validar um protocolo onde qualquer desenvolvedor pode criar extensões independentes, publicá-las em qualquer URL, e um aplicativo host pode descobri-las, carregá-las dinamicamente e usá-las com fallback automático.

---

## 2. Problema

Aplicações modulares hoje dependem de uma de duas abordagens:

1. **Dependências em tempo de compilação** — tudo é importado e resolvido no build. Trocar uma implementação exige modificar o código e rebuildar.

2. **Marketplaces centralizados** — plugins só existem se aprovados e hospedados por um repositório central.

Ambas as abordagens criam um gargalo: o desenvolvedor do core decide o que pode ser estendido, e o desenvolvedor de extensões depende de permissão para publicar.

O Stremio provou que existe uma terceira via: **add-ons independentes descobertos por URL**, onde cada extensão é um módulo autônomo que se anuncia via manifesto, e o host as consome sem saber quem implementa.

---

## 3. Público-Alvo

| Perfil | O que faz com o sistema |
|--------|------------------------|
| Desenvolvedor de add-ons | Cria extensões usando as interfaces públicas |
| Mantenedor do host | Integra o protocolo no aplicativo |
| Usuário final | Instala e gerencia add-ons via interface |

---

## 4. Requisitos Funcionais

### Fase 1 — Núcleo

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F1.1 | O sistema deve definir um formato de manifesto para add-ons | Alta |
| F1.2 | O manifesto deve conter id, versão, entrypoint, e lista de serviços | Alta |
| F1.3 | O sistema deve permitir que um add-on registre serviços no registry | Alta |
| F1.4 | O sistema deve permitir que o host consulte serviços por ID | Alta |
| F1.5 | O sistema deve suportar múltiplas implementações para o mesmo serviço | Alta |
| F1.6 | O sistema deve definir prioridade entre implementações | Alta |
| F1.7 | O sistema deve carregar add-ons dinamicamente via `import()` | Alta |
| F1.8 | O sistema deve validar o manifesto antes de carregar | Média |
| F1.9 | O sistema deve tratar erros de setup sem quebrar o host | Alta |
| F1.10 | O sistema deve fornecer um `HostAPI` mínimo para add-ons | Alta |
| F1.11 | O host-app deve exibir add-ons instalados em uma lista | Média |
| F1.12 | O host-app deve permitir invocar serviços dos add-ons | Média |
| F1.13 | O sistema deve ter testes unitários para registry, validação e loader | Alta |

### Fase 2 — Fallback e Domínio

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F2.1 | O sistema deve implementar fallback automático entre implementações | Alta |
| F2.2 | O sistema deve registrar e logar falhas de serviço | Média |
| F2.3 | O sistema deve permitir interfaces de domínio tipadas (ex: `Greeter`) | Alta |
| F2.4 | Add-ons devem poder substituir serviços de outros add-ons por prioridade | Alta |

### Fase 3 — Descoberta

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F3.1 | O sistema deve carregar add-ons de URLs remotas | Alta |
| F3.2 | O sistema deve validar versão do host contra versão requerida pelo add-on | Média |
| F3.3 | O sistema deve manter um catálogo de add-ons conhecidos | Média |
| F3.4 | O host-app deve permitir instalação de add-ons por URL | Alta |

### Fase 4 — Resiliência

| ID | Requisito | Prioridade |
|----|-----------|------------|
| F4.1 | O sistema deve isolar erros de cada add-on | Alta |
| F4.2 | O sistema deve degradar add-ons que falham repetidamente | Média |
| F4.3 | O usuário deve poder habilitar/desabilitar add-ons | Alta |
| F4.4 | O usuário deve poder reordenar prioridade dos add-ons | Média |

---

## 5. Requisitos Não Funcionais

| ID | Requisito | Descrição |
|----|-----------|-----------|
| NF1 | Testabilidade | O core deve ser testável isoladamente sem dependências externas |
| NF2 | Isolamento | Nenhum add-on deve conseguir quebrar o host |
| NF3 | Simplicidade | O protocolo deve caber em 3 tipos principais e 2 funções |
| NF4 | Compatibilidade | Deve funcionar em navegadores modernos (ESM nativo) |
| NF5 | Zero dependências externas no core | O pacote `@addons/core` não deve depender de React, Vite, ou qualquer framework |

---

## 6. Casos de Uso

### UC1: Desenvolvedor cria um add-on

1. Desenvolvedor cria um projeto TypeScript
2. Importa os tipos de `@addons/core`
3. Implementa a interface do serviço desejado
4. Exporta `manifest` e `setup`
5. Compila para ESM com Vite
6. Publica o bundle em qualquer URL

### UC2: Usuário instala um add-on

1. Usuário obtém a URL do manifesto
2. Cola no host-app
3. Host valida o manifesto
4. Host carrega o bundle via `import()`
5. Host chama `setup` com o `HostAPI`
6. Add-on registra seus serviços
7. Add-on aparece na lista de instalados

### UC3: Fallback automático

1. Dois add-ons registram o mesmo serviço
2. O de maior prioridade falha ao ser invocado
3. Registry captura o erro
4. Registry tenta o próximo da lista
5. Host recebe o resultado sem saber da falha

---

## 7. Critérios de Sucesso

A POC será considerada bem-sucedida quando:

1. Um add-on de exemplo é carregado e seu serviço é invocado com sucesso
2. Dois add-ons registram o mesmo serviço com prioridades diferentes
3. O de maior prioridade é usado por padrão
4. Se o de maior prioridade falhar, o fallback assume automaticamente
5. Um add-on com erro no setup não impede o funcionamento do host
6. Testes unitários do core passam com 100% de cobertura nos cenários principais

---

## 8. Não Escopo

- Interface gráfica complexa (o host-app é o mínimo demonstrável)
- Suporte a Service Workers
- WebAssembly
- Sandbox em Web Worker ou Iframe (investigação futura)
- Autenticação ou autorização
- Loja de add-ons com backend
- Publicação no npm