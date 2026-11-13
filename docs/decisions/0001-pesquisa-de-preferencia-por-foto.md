# Decisão 0001 — PoliMatch como pesquisa de preferência por foto

- Data da decisão: 12/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude), a pedido dele
- Issues: #318 ([ICM 67]) e #277 (Q1)
- Estado: direção aprovada. **Nada desta decisão está em produção.**

## Contexto

A Q1 da #277 perguntava o que o PoliMatch vira depois da eleição de 2026 e
oferecia três caminhos: arquivo somente leitura com rodada diária atemporal, só
o arquivo, ou pausa. O Stefan respondeu com um quarto caminho.

## Decisão

1. **Por que existe.** Alternativa às pesquisas tradicionais: a pessoa se
   diverte escolhendo fotos e disso sai a preferência do público.
2. **Como funciona.** Cada pesquisa é um conjunto de fotos e uma pergunta curta.
   Tem começo e fim, não se repete para a mesma pessoa e permite desfazer a
   escolha. Só foto e nome, sem texto para ler. Rápido, com som.
3. **Quem conta.** Qualquer pessoa joga. A escolha só entra na pesquisa com
   cadastro por CPF, que passa a ser o único identificador que faz a escolha
   contar. O cadastro pede faixa de idade, gênero e estado. A pessoa joga
   primeiro e se cadastra depois.
4. **O que aparece.** Quem jogou vê os cinco primeiros. Resultado completo e
   recortes ficam com quem encomendou a pesquisa.
5. **O que sai do PoliMatch.** Só a resposta somada. Nunca o dado de uma pessoa.
6. **Assuntos de abertura.** Política, Famosos e influenciadores, Futebol.
7. **Congelado.** Os jogos de leitura ("Quem disse isso?", "Fato ou fake?") e a
   parte cívica e de notícias ficam no ar sem trabalho novo.
8. **Visual das telas novas.** Minimalista: fundo neutro que segue o
   claro/escuro do aparelho, um único verde, foto sem moldura na hora do voto.
   A pessoa pode compartilhar a própria escolha por iniciativa dela.

## O que muda em relação às decisões aprovadas

As decisões da coluna da esquerda continuam descrevendo o que está no ar. Elas
deixam de valer para as telas e regras da pesquisa por foto, que só entram em
produção por etapas próprias, cada uma com Issue e gate humano. Os detalhes de
formato da coluna da direita (eliminatória, janela de dias, coleção) vêm do
protótipo aprovado e serão detalhados nessas etapas.

| Decisão anterior | Onde está | O que vale na direção nova |
|---|---|---|
| "Não é pesquisa eleitoral" | `CONTEXT.md`, "Norte do produto" | Continua valendo, e exibida, no que está no ar. Deixa de valer para a direção nova: o texto que a substitui ali depende da revisão jurídica (Q5 da #277). Até lá o repositório não afirma enquadramento para a pesquisa por foto. |
| Produto definido como jogo casual de comparação | `CONTEXT.md`, "Norte do produto"; `README.md`, abertura | Pesquisa de preferência por foto, em formato de jogo. |
| Duas escolhas em ordem por tela | `CONTEXT.md`, "Duas escolhas ordenadas" (#239) | Um toque por tela, em eliminatória com final. |
| Resultado da rodada com variação de pontos nas cartas | `CONTEXT.md`, "Decisões atuais aprovadas" | Sem placar entre telas. O desfecho é a escolha final da pessoa. |
| Perfil e contexto para escolha informada; descrição curta na carta | `CONTEXT.md`, "Decisões atuais aprovadas" e "Gate final", item 3; `AGENTS.md`, "Estado atual" | Só foto e nome. |
| Ranking da edição e ranking pessoal como superfícies do produto | `CONTEXT.md`, "Decisões atuais aprovadas" e "Gate final", item 5 | Cada pesquisa tem o próprio resultado. Mostrar os cinco primeiros depende das pendências abaixo. |
| Chromas na rodada | `CONTEXT.md`, "Rodada diária com Chromas e encaixe no iPhone" (#265); `AGENTS.md`, "Estado atual" | Na hora do voto a foto aparece igual para todos, sem moldura. A personalização fica na coleção. |
| Capa presidencial | `CONTEXT.md`, "Capa presidencial" (#261) | A entrada passa a ser a próxima pesquisa aberta. |
| Somente `Eleições 2026` ativo como assunto | `CONTEXT.md`, "Decisões atuais aprovadas" | Abre com três assuntos: Política, Famosos e influenciadores, Futebol. |
| Rodada do dia como centro do produto | `README.md`, "Produto atual" | Pesquisas com começo e fim, abertas por uma janela de dias. |
| Direção de arte `Malaquita 2026 / Digital First` | `CONTEXT.md`, "Decisões atuais aprovadas"; `README.md`, "Produto atual"; `AGENTS.md`, "Estado atual" | Continua valendo para o que está no ar. Nas telas novas: fundo neutro, um único verde, foto sem moldura. |

## O que continua valendo

- O app é online-only: nenhuma escolha é confirmada antes do servidor.
- Todas as opções de uma tela aparecem com a mesma exposição.
- Nenhum resultado é manipulado para favorecer alguém.
- Compartilhamento é sempre iniciado pela pessoa.
- Jogar sem cadastro continua permitido.
- O [gate de publicação agregada](../legal/AGGREGATE_PUBLICATION_GATE.md) (#177)
  continua em vigor.
- A [política de integridade do voto](../security/VOTE_ABUSE_POLICY.md) continua
  em vigor até uma decisão versionada nela.
- O fluxo ICM e o gate humano do `AGENTS.md`.

## Pendências

Nada abaixo fica liberado por esta decisão. As respostas marcadas como
"Respondida" foram dadas em 12/11/2026 por delegação do Stefan e estão no
[comentário da #277](https://github.com/stefancabral-oss/polimatch/issues/277#issuecomment-6841156435).

- **Fotos (Q3 da #277, #284).** Respondida, e revista pelo Stefan em 12/11/2026: as fotos de
  pessoas públicas ficam enquanto o produto for gratuito. A regularização, com
  retrato oficial ou de licença livre ou com autorização, passa a ser condição
  para vender ou monetizar. O registro de autor, licença e origem por foto
  continua, para deixar essa regularização pronta. As duas fotos de identidade
  a confirmar continuam saindo já, como na #284. Fotos de agência ou de veículo
  ficam a confirmar antes de decidir. O compartilhamento da escolha leva a foto para a
  rede social com a marca do PoliMatch, o que pesa nessa regularização.
- **Jurídico (Q5 da #277, #283).** Sem resposta. Controlador de dados e revisão
  jurídica.
  Perguntas para o advogado: tratar CPF junto com preferência política;
  coletar respostas para entregar o resultado somado a terceiros;
  enquadramento diante das regras de pesquisa eleitoral; exibir os cinco
  primeiros com a publicação de agregados retida (#177); pergunta negativa
  sobre pessoa real; direito de imagem em pesquisa encomendada.
- **Política de abuso (Q4 da #277, #282).** Respondida: jogador criado só no
  primeiro voto e limite por rede mais alto. O número novo sai na decisão
  versionada da política, dentro da [ICM 40] #282.
- **Login Google e CPF.** Sem resposta. Como o acesso opcional com Google
  convive com o cadastro por CPF fica para a etapa do cadastro.
- **Visibilidade do repositório.** Sem resposta.
- **Ordem do trabalho (#309).** Respondida: maturidade primeiro. Os bloqueios de
  [ICM 36] a [ICM 44] vêm antes de qualquer etapa de produto da pesquisa, com
  uma exceção: a troca das fotos de pessoas públicas ([ICM 42] #284) é
  pré-requisito da monetização, não do lançamento gratuito. O registro por
  foto da mesma issue segue agora.
- **Processo (Q6 da #277).** Proposta do agente, a confirmar pelo Stefan,
  porque muda a forma como a aprovação dele vale: aprovação por comentário ou
  por instrução dele transcrita no PR, sem travar o fluxo; e o código do
  programa cívico, que está atrás de flags desligadas, vai para uma tag para
  2028 e sai da `main` ([ICM 62] #304), sem mudar nada do que está no ar. Até
  a confirmação vale a regra 6 do `AGENTS.md` como está. O "congelado" da
  decisão acima quer dizer "no ar sem trabalho novo".
- **Quiz (Q2 da #277).** Respondida: nenhuma edição nova; a edição 1 vira a
  padrão e as edições 2 a 4 ficam como arquivo de 2026 ([ICM 44] #286).

## Etapas seguintes propostas

Ainda não abertas. Depois dos bloqueios de maturidade: medir o uso
([ICM 60] #302), depois o servidor da pesquisa e por fim as telas. A
[ICM 65] #307 divide o `topic-store.js` e deveria vir antes do servidor da
pesquisa.

## Referências

- `stages/67_photo_survey_direction/`: contexto, handoff e verificação desta
  etapa.
- `stages/67_photo_survey_direction/references/prototipo-pesquisa.html`:
  protótipo navegável que o Stefan aprovou em 12/11/2026, com nomes e rostos
  fictícios.
