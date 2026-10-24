# ICM 35 — Handoff parcial da auditoria histórica

Issue: https://github.com/stefancabral-oss/polimatch/issues/275
Base: `7c0bb27d55b756f62cf20398aabcd180b8c54203`
Branch: `feat/historical-fact-audit`
Data: 24/10/2026

## Entrega verificável

- Inventário de 133 cartões e respectivos diálogos, organizado em 37 temas.
- Treze registros já revisados no estágio 34; 120 históricos adicionais.
- Notas próprias de triagem, referências apresentadas pelo site e decisão por item em `references/historical-audit.json`.
- Relatório legível em `output/AUDIT.md`; sem reprodução das explicações completas do site.
- Três proposições estreitas confrontadas com fontes primárias: competência federal na segurança (H101), reservas em janeiro de 2002 (H111), operações do Pronaf fora do RS (H125).
- Dois PDFs do BCB baixados diretamente, texto extraído, páginas relevantes conferidas também no leitor web; hashes e localizadores em `references/primary-source-receipts.json`.
- Constituição e decreto consultados com sucesso pelo leitor web. Downloads locais desses dois HTML expiraram por timeout, explicitamente registrados como falha; não há hash inventado.

## Limites e estado real

**Não são 133 checagens independentes concluídas.** Os 117 históricos restantes têm apenas triagem metodológica. As três proposições documentais também dependem de confirmação independente de autoria, data e contexto da fala antes de publicação como quiz. Nenhuma pergunta nova foi liberada e nenhuma gravação foi transcrita/verificada integralmente nesta etapa.

A fonte divulga propaganda eleitoral e verificação assistida por IA; nem a origem, nem concordância entre modelos determina verdade. Em H126, o contexto expandido declara que o vídeo original não pôde ser acessado. O registro da entrevista de 1/10/2026 localizado no Podcast do Lula é uma pista, não prova de que cada recorte corresponde à gravação. Não usamos notícias como prova da veracidade dos números.

O relatório identifica problemas de comparabilidade que impedem importar automaticamente vereditos: valor versus volume físico, estoque versus fluxo, abrangência brasileira versus continental, previsão versus resultado e criação de regime novo versus preexistência de outro. Tampouco é lícito converter ausência de prova em falsidade.

## Produção e testes

Mudança apenas documental. Edições 1–4, runtime, artes, pontuação, ranking, dados dos jogadores e implantação não foram alterados. Não houve novo deploy nem novo QA de botões, pois nenhum botão foi modificado. A verificação desta etapa cobre integridade do inventário, cobertura de índices, contagens, URLs, referências primárias e ausência de arquivos de runtime no diff.

PR: registrada na conversa e na issue após criação; manter como rascunho porque a auditoria factual histórica está incompleta. Este handoff não aprova o human gate nem fecha a issue.

## Continuação concreta

1. Obter e conferir a gravação integral correspondente a H101/H111/H125, com data, referente e minutagem; não preencher data com a de checagem da página.
2. Resolver os 117 históricos por fontes primárias compatíveis, começando pelos grupos de reservas, emprego, salário e Pronaf, sem contar repetições como novas confirmações.
3. Redigir perguntas apenas quando tanto atribuição quanto conclusão estiverem demonstradas; preservar FALSO, ENGANOSO e EQUIVOCADO como classificações distintas.
4. Se houver itens publicáveis, criar edição versionada com rótulos por evento, sem classificar todas as falas como debate da Globo de 23/10; então testes de conteúdo, CI nos dois motores, build, deploy e QA público.
5. Gate editorial final continua com Stefan; a etapa permanece aberta.
