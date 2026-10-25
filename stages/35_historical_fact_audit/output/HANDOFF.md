# PoliMatch — Handoff para continuidade

Atualizado em **25/10/2026**, horário de Brasília. Este documento transfere o estado real do projeto; não certifica como concluída a auditoria histórica.

## 1. Objetivo a continuar

Ampliar o jogo **Quem disse isso? + Fato ou Fake**, usando o acervo do Mentiras do Lula como pauta e confrontando as alegações com documentos, dados e gravações originais. Stefan pediu analisar e validar, sem apenas substituir textos ou repetir vereditos de outros sites. A publicação deve conter explicação, provas consultáveis e liberdade para responder ou ver a checagem sem responder.

O trabalho ativo é a auditoria histórica da issue **[#275](https://github.com/stefancabral-oss/polimatch/issues/275)**. O pedido desta atualização foi somente preparar o handoff; não continuar pesquisa, mesclar ou implantar uma versão nova.

## 2. Repositório e referências de retomada

| Referência | Valor |
|---|---|
| Repositório canônico | https://github.com/stefancabral-oss/polimatch |
| Nome antigo do mesmo repositório | `stefancabral-oss/presidencia-duelo` |
| Repository ID já conferido | `1367432599` |
| Branch de trabalho | `feat/historical-fact-audit` |
| PR documental ativa | https://github.com/stefancabral-oss/polimatch/pull/276 |
| Estado da PR, conferido em 25/10 | Aberta, rascunho, não mesclada |
| Head remoto antes desta atualização do handoff | `64c4f3ba35d9715f648135d4c85d762bc593416d` |
| Base da auditoria | `7c0bb27d55b756f62cf20398aabcd180b8c54203` |
| Workspace desta sessão | `/workspace/scratch/f6ffe808905a/polimatch-mobile-fix` |

O SHA de merge de teste que o GitHub pode expor para uma PR aberta **não é merge real**. Conferir `merged` e o branch remoto, não inferir publicação por esse campo.

O commit local anterior `ffadf9a6347a281bf2b1dabce5db2ba12e5b7870` e o head remoto `64c4f3b` tinham a mesma árvore `cb4336ab297148151643a4a63c3acf0474d3f15c`; a diferença era metadado de commit produzido pelo conector. Ao retomar, usar o head remoto mais recente da branch e preservar alterações locais. Não usar reset destrutivo.

## 3. Última publicação confirmada

**Última confirmação em produção: 24/10/2026. Não houve nova inspeção ao vivo em 25/10 para este handoff.**

- Página: https://polimatch.com.br/quem-disse-isso.html
- Edição padrão 4: **27 perguntas, sendo 20 itens presidenciais e sete checagens factuais**.
- PR publicada: https://github.com/stefancabral-oss/polimatch/pull/274 — mesclada; estado reconferido em 25/10.
- Commit confirmado no deploy: `7c0bb27d55b756f62cf20398aabcd180b8c54203`.
- Bundle observado: `quoteQuiz-DzovBsAy.js`.
- Serviço Dokploy: `polimatch-web-fh4s3w`; publicação anterior concluída e SHA lido no painel.
- Edições 1–3 e progresso preservados; edição 3 tem 28 perguntas. Não recalcular placares antigos.

As sete checagens da edição 4 são PIB, Selic, data legal do Desenrola, Marco do Saneamento, estimativa de fome da PENSSAN, acusação sobre celular/cerveja e sanção da Lei Geral da Micro e Pequena Empresa. Os respectivos recortes e limites estão em `app/src/fact-check-reviewed.js`.

**A auditoria da PR #276 não mudou aplicação, artes, pontuação, ranking, dados dos jogadores ou produção. Não houve novo deploy nem teste de botões nesta etapa documental.**

## 4. O que a auditoria histórica efetivamente entregou

| Situação | Quantidade | Significado |
|---|---:|---|
| Cartões e diálogos lidos/inventariados | 133 | Cobertura da coleta, não validação de 133 vereditos |
| Registros já tratados no estágio 34 | 13 | Pautas do debate de 23/10 |
| Históricos adicionais | 120 | Conjunto novo da etapa 35 |
| Proposições estreitas confrontadas com originais | 3 | H101, H111 e H125; ainda falta conferir a fala completa |
| Históricos sem conclusão independente | 117 | Têm triagem metodológica e pendência por item |
| Temas agrupados | 37 | Repetições não são novas provas independentes |
| Novas perguntas liberadas nesta etapa | 0 | Não confundir dado confirmado com atribuição confirmada |
| Gravações históricas verificadas integralmente nesta etapa | 0 | Autoria, data e contexto continuam pendentes |

Os rótulos da fonte somam 31 “falso”, 72 “enganoso” e 30 “equivocado”. São **classificações do site, não vereditos aceitos automaticamente pelo PoliMatch**.

### Três pontos documentais já trabalhados

| ID local | Documento e localizador | Conclusão limitada e pendência |
|---|---|---|
| H101 | Constituição, art. 144, incisos I–III e atribuições federais: https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm | Há competência federal em segurança pública. Isso não resolve discussão sobre coordenação geral das polícias estaduais. Conferir gravação e sentido da fala. |
| H111 | BCB, relatório de junho de 2009, página impressa 5, sexta do PDF: https://www.bcb.gov.br/content/estabilidadefinanceira/relgestaoreservas/RGRI200901-relgestresint062009.pdf | Janeiro de 2002 tinha US$ 36,2 bilhões de reservas, conceito liquidez. Isso refuta inexistência literal; não demonstra suficiência de financiamento externo. Conferir referente e contexto. |
| H125 | BCB, acervo de crédito rural de 2001, gráficos 20–24 na primeira página: https://www.bcb.gov.br/htms/CreditoRural/2001/graf521.pdf ; Decreto 1.946/1996: https://www.planalto.gov.br/ccivil_03/decreto/d1946.htm | Há operações fora do RS, inclusive 13.485 contratos agrícolas de custeio em Rondônia. Não negar expansão posterior por causa da existência prévia. O decreto é histórico e foi revogado em 1999. Conferir fala completa. |

Os dois PDFs do BCB foram baixados com HTTP 200, texto extraído e páginas relevantes inspecionadas pelo leitor web. SHA-256 e localizadores estão nos recibos. Constituição e decreto foram lidos pelo leitor web; downloads locais dos HTML expiraram por timeout e estão registrados sem hash inventado.

## 5. Arquivos que o próximo executor deve ler

Caminhos relativos à raiz do repositório:

1. `AGENTS.md` e `CONTEXT.md` — contrato ICM e decisões do produto.
2. `stages/35_historical_fact_audit/CONTEXT.md` — escopo ativo.
3. `stages/35_historical_fact_audit/output/AUDIT.md` — relatório, ressalvas e tabela dos 133 registros.
4. `stages/35_historical_fact_audit/references/historical-audit.json` — inventário canônico com IDs, índices, temas, referências apresentadas pelo site, minutagem informada e decisão.
5. `stages/35_historical_fact_audit/references/primary-source-receipts.json` — recibos das quatro fontes efetivamente consultadas para os três pontos.
6. `stages/35_historical_fact_audit/output/verification.json` — verificações e limites da etapa.
7. `stages/34_primary_evidence/references/audit.json` — auditoria anterior das 13 pautas e oito checagens anteriores.
8. `app/src/fact-check-reviewed.js`, `app/src/quote-quiz-data.js`, `app/src/quote-quiz-page.js` — conteúdo e fluxo publicados.
9. Corpo da PR #274 — evidência final de CI, deploy e QA público; o verification.json antigo ainda aponta para a PR como fonte do fechamento.

Os IDs H001–H133 são locais, baseados na ordem observada. O índice do JSON começa em zero: H101 = índice 100. H125 é Pronaf; **H126 é primeiro cargo de Flávio**, não confundir.

A captura bruta de pesquisa existe nesta sessão em `/workspace/scratch/PoliMatch_Historical_Research_Internal.json` (360.915 bytes ao conferir em 25/10). É material intermediário, pode desaparecer e não foi publicada integralmente no Git. A retomada durável usa o inventário e notas do repositório; não depender de abas ou variáveis de navegador de outra sessão.

## 6. Cuidados editoriais e descobertas que não podem se perder

- A origem eleitoral da fonte não determina a verdade nem a falsidade de uma alegação. A página se identifica como propaganda de Flávio e informa uso de IA; checar o mérito em documentos originais.
- H126: o contexto expandido declara que o vídeo original não pôde ser acessado e que o resultado era subsídio, não decisão editorial final. Não adotar isso como prova audiovisual. Uma página de podcast localizada para 1/10/2026 é pista, não transcrição conferida de todos os recortes.
- `sourceDate` permanece nulo na coleta: não usar data de checagem como data da fala, nem atribuir todos os históricos ao debate da Globo de 23/10.
- H030: participação no **valor** da produção não é participação no **volume físico** dos alimentos consumidos.
- H064/H065: estoque no Brasil não mede fluxo contemporâneo na América Latina e África.
- H057/H078: projeções futuras não são resultados realizados; divergência entre projeções não prova mentira.
- H040: SIMPLES de 1996 e Simples Nacional de 2006 são regimes diferentes.
- H020: saldo líquido de vínculos não é soma de admissões.
- H096: recorde mensal não é refutado por saldo anual de outro período.
- Investigação, acusação, defesa técnica, prisão, absolvição e condenação são situações distintas. Vínculo pessoal ou intenção não se presume de foto, cronologia ou manchete.
- Ausência de confirmação não autoriza FAKE. Falso, enganoso e equivocado não são sinônimos. Evitar generalização de um erro numérico para toda uma fala.
- Desenrola publicado checa somente instituição legal em junho de 2023, não planejamento. A fala completa conserva a ressalva de “enganoso”.
- Wi-Fi e 700 mercados ficaram retidos na edição 4 por divergência de recortes/bases; não foram declarados falsos.

## 7. Validação já executada e limites

### Publicação anterior, etapa 34

- 226 testes unitários aprovados e build aprovado, excluindo ativos do piloto #176.
- Chromium em 320/440/768/1440; CI Chromium e WebKit aprovados.
- UI Interaction Smoke: https://github.com/stefancabral-oss/polimatch/actions/runs/40123099965
- Design Validator: https://github.com/stefancabral-oss/polimatch/actions/runs/40123099968
- QA público de 24/10: 27 autores concluídos; sete etapas factuais, com uma pulada; fonte real da Câmara em nova aba, reload/progresso, revisão, reinício e compartilhamento por cópia conferidos. Não houve envio a terceiros.
- Não afirmar teste físico em iPhone nem conferência audiovisual integral de todos os históricos.

### Auditoria documental, etapa 35

- 13 verificações de integridade registradas: IDs e índices, cobertura no relatório, contagens, fases, URLs, retenção editorial, ausência de datas inventadas e resolução dos IDs de evidência.
- `git diff --check` aprovado na entrega documental.
- Nenhuma alteração de runtime; não foi executado novo build, QA de botões ou deploy.
- A atualização deste handoff requer apenas validar referências, JSON e hashes dos arquivos alterados. Não reapresentar os testes de 24/10 como novos testes de 25/10.

## 8. Ordem concreta para continuar

1. Buscar o head remoto atual da PR #276 e ler os arquivos acima. Preservar trabalho local não relacionado.
2. Obter gravações integrais correspondentes a H101/H111/H125; conferir autoria, data, referente, minutagem e contexto anterior/posterior. Não basta o recorte hospedado no site ou sua explicação.
3. Resolver os 117 históricos em grupos, começando por reservas/FMI, emprego, salário e Pronaf. Para cada item registrar fonte primária realmente lida, período, unidade, tentativa de refutação, conclusão ou motivo de retenção. Não exigir que todo item termine binário.
4. Redigir somente perguntas com atribuição e conclusão demonstradas, com explicação própria, limite explícito, localizador e link de prova. Não copiar em massa as explicações da fonte.
5. Se houver itens publicáveis, criar edição nova e preservar as edições 1–4 e suas chaves de progresso. Não mudar o placar antigo.
6. Corrigir rótulos por evento/data: atualmente o fluxo factual contém textos fixos “Globo · 23/10/2026”. Históricos não podem herdar esses rótulos.
7. Atualizar contagens, textos de entrada e regressões de navegação, compartilhar e edição anterior. Em `app/e2e/quote-quiz-checked.mjs`, há expectativa da edição 4 e da edição 3 com 28 itens; adequar à edição nova sem eliminar regressão das antigas.
8. Executar testes proporcionais e build. Com alterações de jogo, validar autoria, Fato/Fake, pular, provas, próxima pergunta, reload, rever, compartilhar, reiniciar, edições antigas e reserva de arte em Chromium/WebKit e larguras móveis.
9. Registrar CI, publicar o commit correto, confirmar SHA e assets no painel/domínio, testar botões em produção e anexar evidência visual real. A PR documental atual não é evidência de deploy.
10. Atualizar HANDOFF/verification e PR; manter o gate editorial humano com Stefan. Não fechar a issue nem autoaprovar o gate.

## 9. Observações operacionais

- Fluxo do repositório: Issue → branch → PR → CI/testes → HANDOFF → revisão humana → fechamento. Autorizações anteriores permitem continuar o escopo; não pedir novamente permissão rotineira para pesquisa e implementação.
- O deploy anterior foi manual pelo Dokploy porque o autodeploy não era confiável. Conferir a configuração existente; não trocar provedor, variáveis, Dockerfile ou repositório por suposição.
- O painel pode manter o nome antigo `presidencia-duelo.git`; já foi comprovado que apontava ao mesmo GitHub ID e SHA. Se houver dúvida nova, revalidar antes de publicar. Não expor webhook, tokens ou credenciais em logs/handoff.
- O push anterior usou a API Git do conector GitHub, por falta de credencial de push no CLI. Ao criar árvore remota, comparar o SHA da árvore local, usar parent correto e atualizar a branch com `expected_sha`, sem force.
- As duas versões anteriores de commit local/remoto com árvore igual estão explicadas acima. Não confundir divergência de metadados com mudança funcional.
- As abas e bindings de navegador são transitórios. Reinspecionar superfícies; usar plugin quando suficiente, sem consultar estado interno oculto do site.
- O QA anterior não criou votos nem alterou ranking. Continuar testando quiz sem introduzir votos políticos no backend.

## 10. Instrução de retomada pronta

> Continue a issue #275 do repositório stefancabral-oss/polimatch, branch feat/historical-fact-audit, PR rascunho #276. Leia primeiro AGENTS.md, CONTEXT.md e este HANDOFF. A produção foi confirmada em 24/10 no commit 7c0bb27, com edição 4 de 27 perguntas e sete checagens. O acervo tem 133 registros inventariados em 37 temas, mas não 133 vereditos validados: 13 pertencem ao estágio anterior, três proposições históricas têm confronto documental e 117 históricos seguem sem conclusão independente. Comece por confirmar gravação, data e contexto de H101/H111/H125; depois avance a auditoria por grupos. Use dados/documentos/gravações originais, mantenha incertezas e não importe vereditos automaticamente. Só publique perguntas comprovadas, preserve edições/progresso, ajuste rótulos históricos, teste os controles e confirme o deploy real. O pedido atual de handoff não autorizou nem executou uma nova publicação.
