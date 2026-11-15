# ICM 70 — Capa com várias pesquisas, suas escolhas e compartilhar — #334

Base: `main` depois do estágio 69 (#331).
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001, 0002 e 0003 e os
contextos dos estágios 68 e 69.

## Objetivo

A capa deixa de ser uma pesquisa só. Mostra as pesquisas abertas e as que
vêm, as escolhas que a pessoa já fez e um jeito de compartilhar a escolha.

## Entradas

- Issue #334. Avaliação do Stefan em 14/11/2026, com a capa nova no ar:
  "Subiu. Mas está bem simples. Precisa de mais coisas."
- A folha em `references/`, enviada a ele no mesmo dia.
- O que os estágios 68 e 69 construíram: regras em `shared/photo-survey.js`,
  servidor em `back/src/photo-survey-store.js`, página em
  `app/src/photo-survey-page.js`, menu em `app/src/site-menu.js`.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| Pesquisas | Uma: `politica-2026-01`, "Quem você prefere?" | Duas, com as mesmas 20 cartas: entra `politica-2026-02`, "Em quem você confia mais?" |
| Capa | A entrada da única pesquisa | A primeira pesquisa aberta que a pessoa não respondeu, em destaque; embaixo, as outras e as que vêm |
| Endereço | Só `/` | `/` é a capa; `/?p=<pesquisa>` abre uma pesquisa |
| Quem já respondeu | Cai na tela de resposta registrada | Vê na capa as escolhas que fez e a próxima pesquisa |
| Depois de responder | A escolha, as finalistas e as próximas pesquisas | A escolha, as finalistas, "Compartilhar minha escolha" e a próxima pesquisa |
| Compartilhar | Não existe | Imagem com a carta escolhida, a pergunta e o endereço do site |

## O formato deste estágio

1. **Assunto.** Cada pesquisa passa a ter `subject` ("Política"), na
   definição e na visão pública.
2. **Capa.** O topo é a entrada da pesquisa em destaque: assunto, pergunta,
   o leque de três cartas e "Começar". A pesquisa em destaque é a primeira
   aberta que esta pessoa ainda não respondeu neste aparelho; se respondeu
   todas, a capa diz isso. Abaixo vêm "Suas escolhas" (se houver), "Mais
   pesquisas" (as outras abertas) e "Em breve" (as do estágio 69). As três
   linhas do formato ("4 telas…") saem da capa: estão em "Como funciona".
3. **Pesquisa com endereço.** Tocar numa pesquisa da lista leva a
   `/?p=<id>`, que mostra a entrada dela. Tocar em "Começar" na capa também
   põe `?p=<id>` no endereço, para a recarga voltar à mesma pesquisa.
   Uma pesquisa que a pessoa deixou pela metade neste aparelho, se ainda
   estiver aberta, vira o destaque da capa, com "Continuar". A capa não
   redireciona: continua sendo a capa.
4. **Suas escolhas.** Para cada pesquisa que este aparelho sabe respondida
   pela identidade atual, a capa busca a resposta no servidor (o mesmo
   pedido de sorteio que já devolve a resposta, sem gravar nada novo) e
   mostra a carta escolhida, com link para a tela da resposta.
5. **Depois de responder.** Dois botões: "Compartilhar minha escolha" e
   "Próxima pesquisa", quando há outra sem resposta neste aparelho, ou "Ver
   pesquisas". Os dois levam à capa: é ela que sabe quais estão abertas e
   qual fica em destaque.
6. **Compartilhar.** No toque, a página monta uma imagem (a carta, o nome, a
   pergunta e "polimatch.com.br") e chama o compartilhamento do aparelho.
   Onde o aparelho não compartilha arquivo, vai o texto com o link; onde não
   há compartilhamento, o link é copiado. Nada sai sem o toque, e a imagem
   leva só a escolha da pessoa.
7. **Menu.** A lista de pesquisas do menu passa a vir das definições: cada
   pesquisa com a pergunta e o link dela.

## Regras

- **Tudo é por pesquisa.** Sorteio, escolhas guardadas no aparelho e
  resposta: responder uma não mexe na outra. O servidor já é assim.
- **Abrir não grava.** A capa lê as definições e, só para quem já respondeu
  neste aparelho ou para uma pesquisa já fechada, a resposta. Não cria
  jogador. Há um caso de borda: se o aparelho diz que uma pesquisa aberta
  foi respondida e o servidor não tem a resposta (perda de dados no
  servidor), o pedido da resposta emite o sorteio dela para o jogador. Não
  grava resposta.
- **Uma leitura que falha não vira lista pela metade.** Se a definição de
  alguma pesquisa não chega (fora o 404 de uma pesquisa que o servidor não
  conhece), a capa avisa e oferece tentar de novo.
- **As regras do estágio 68 valem para cada pesquisa**, sem mudança.
- **Sem resultado público.** Compartilhar leva a escolha da pessoa, nunca
  soma de respostas (#177).
- **Mesma ilustração.** A entrada das duas pesquisas sorteia as três cartas
  da lista do estágio 68 (`ENTRY_CARD_IDS`).
- **Depois de registrada, o aparelho continua guardando só que a pessoa
  respondeu.** A carta escolhida vem sempre do servidor.

## Entregas

Um PR, com commits por parte:

| Parte | O que traz |
|---|---|
| 70a — Regras | `subject` e a segunda pesquisa em `shared/`; testes de `shared/` e do servidor |
| 70b — Página por pesquisa | A página passa a valer para qualquer pesquisa, com `?p=` |
| 70c — Capa | Destaque, "Suas escolhas", "Mais pesquisas", "Em breve"; menu com as pesquisas |
| 70d — Compartilhar | Botão, imagem e as saídas para quem não tem compartilhamento |
| 70e — Publicação | API e app, com o sim do Stefan para cada um |

## Fora de escopo

- Cartas novas (famosos, roupas) e qualquer pesquisa com outro conjunto.
- Top 5, resultado somado, comparação com a maioria.
- Cadastro por CPF, avisos, indicação, som e háptica.
- Rota nova no servidor. A capa usa as três rotas que existem.
- A pesquisa de lançamento com código zerado.

## Critérios de aceite

- `shared/`: as duas pesquisas têm assunto, 20 cartas, sorteio de 16 em
  telas de 4; os ids são únicos.
- Servidor: o mesmo jogador responde as duas, uma vez cada; a resposta de
  uma não aparece na outra.
- Capa sem identidade: uma leitura por pesquisa e nenhuma gravação; destaque
  na primeira pesquisa; a segunda em "Mais pesquisas"; duas "em breve".
- `/?p=politica-2026-02` abre a entrada da segunda pesquisa; um `p`
  desconhecido cai na capa.
- Uma pesquisa pela metade que fecha não prende a pessoa: a capa continua
  alcançável.
- Responder a primeira e voltar à capa: a escolha aparece em "Suas
  escolhas" e a segunda vira o destaque. Respondidas as duas, a capa diz
  que não há pesquisa aberta sem resposta.
- As escolhas guardadas de uma pesquisa não aparecem na outra; recarregar no
  meio retoma a pesquisa certa.
- "Compartilhar minha escolha" chama o compartilhamento do aparelho com uma
  imagem e o texto; sem suporte a arquivo, só o texto e o link; sem
  compartilhamento, copia o link e avisa. Nenhuma chamada sem o toque.
- Os 34 cenários do estágio 68 e os 24 do estágio 69 passam, ajustados onde
  a tela mudou de propósito.

## Condições de publicação

As do estágio 69 continuam abertas (privacidade, #283; backup, #279). A
pesquisa nova é uma pergunta a mais sobre pessoas reais: fica registrada
como escolha do agente, a mudar se o Stefan quiser.

## Dependências e riscos

- **A página tem estado por módulo.** Passar para "por pesquisa" mexe em
  quase todas as funções; os 58 cenários de navegador são a rede.
- **A imagem compartilhada leva a foto de uma pessoa real com a marca do
  PoliMatch.** Está na consulta jurídica sobre direito de imagem (decisão
  0001, pendência de fotos).
- **API e app precisam ir juntos.** O app novo pede a segunda pesquisa; com a
  API antiga ela responde 404 e a capa mostra só a primeira.
