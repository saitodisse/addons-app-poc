# Protocolo de add-ons

Este contexto define a linguagem usada para extensões independentes e para o host que as instala. Ele separa o que uma extensão declara do que o host pode verificar e permitir.

## Linguagem

**Declaração de interação**:
A parte do manifesto que informa as entradas, saídas, armazenamento e demais interações de um add-on. Para interações mediadas pelo host, ela também é a regra que o host usa para permitir ou bloquear o acesso.
_Evite_: permissões implícitas, capacidades escondidas

**Contrato de interação**:
Bloco obrigatório `interactions` no manifesto que reúne a declaração de interação de um add-on, sem substituir os atuais `services` e `resources`.
_Evite_: contrato separado por formato, cadastro manual no host

**Destino efetivo de estado**:
Meio de persistência escolhido pelo host para uma chave de estado declarada pelo add-on. Pode ser `localStorage`, `sessionStorage` ou memória e não faz parte da identidade nem da implementação do add-on.
_Evite_: destino físico declarado pelo add-on

**Esquema de interação**:
Subconjunto documentado de JSON Schema usado no contrato de interação para descrever os dados recebidos e devolvidos por uma operação.
_Evite_: descrição livre de formatos, schema não validado

**Manifesto compatível**:
Manifesto que contém um contrato de interação válido. O host recusa instalar manifestos sem esse contrato.
_Evite_: contrato ausente, compatibilidade silenciosa

**Interação externa declarada**:
Consulta ou envio feito fora do host, descrito no contrato para transparência. Na arquitetura atual, o host a mostra, mas ainda não a intercepta nem bloqueia.
_Evite_: interação externa mediada pelo host

**Requisição externa declarada**:
Interação externa que informa origem, método, rota-modelo, finalidade, campos transmitidos e esquema da resposta. A rota-modelo descreve variáveis sem revelar os valores de uma pessoa.
_Evite_: URL com dados de usuário, destino sem finalidade

**Classificação de dado**:
Rótulo `público`, `pessoal` ou `segredo` atribuído a um campo recebido, persistido ou transmitido. O contrato descreve o dado, mas valores `segredo` não são exibidos nem registrados pelo host.
_Evite_: segredo em manifesto, segredo em log

**Declaração de estado**:
Parte do contrato que informa a chave ou padrão de chave, esquema, operações permitidas, retenção e gatilho de exclusão de um estado. Quem grava declara uma chave concreta; um provedor de armazenamento pode declarar um padrão que aceita.
_Evite_: estado sem chave, retenção implícita

**Contrato coerente**:
Contrato de interação cujas partes mediadas pelo host correspondem aos serviços, recursos, ações, campos e acessos a estado observados na instalação. Uma divergência torna o add-on incompatível.
_Evite_: contrato apenas ilustrativo, capacidade mediada não declarada

**Revisão de contrato**:
Estado em que uma instalação aguarda uma nova aceitação porque o contrato de interação mudou na mesma URL de manifesto. A extensão permanece desativada até a revisão.
_Evite_: ampliação silenciosa de capacidade, reativação automática
