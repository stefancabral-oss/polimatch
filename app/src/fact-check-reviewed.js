import {FACT_EDITION} from './fact-check-data.js';
const record=(url,label,locator)=>({kind:'speech',url,label,locator});
const proof=(url,label,locator)=>({kind:'evidence',primary:true,url,label,locator});
const debate='https://www.mentirasdolula.com.br/publico/debate?sessao=22151358e53048f38d569588072e6565';
const previous=id=>FACT_EDITION.questions.find(q=>q.id===id);
const revise=(id,changes)=>({...previous(id),...changes,checkedAt:'2026-10-24',reviewed:true});
export const REVIEWED_FACT_EDITION={
 id:'globo-20261023-primary-v2',date:'2026-10-23',checkedAt:'2026-10-24',people:FACT_EDITION.people,
 label:'Debate da Globo · documentos conferidos',
 questions:[
  revise('pib-apos-2010',{
   quizSummary:'A economia brasileira não cresceu mais de 3% ao ano entre 2011 e 2022.',
   explanation:'A tabela 7.5.1.3 do Anuário Estatístico do IBGE registra crescimento real do PIB de 4,0% em 2011 e 4,8% em 2021. Ambos estão no intervalo citado. Um único contraexemplo basta para refutar a afirmação.',
   scope:'Crescimento anual real do PIB. A série de 2011 foi revisada: 3,9% era o valor da publicação de 2015; a tabela consultada agora traz 4,0%. O veredito não atribui intenção nem compara a qualidade dos governos.',
   sources:[record(debate,'Mentiras do Lula — recorte do debate','Item Economia, 01:29:31. Registro da fala; o veredito foi conferido na tabela do IBGE.'),proof('https://anuario.ibge.gov.br/images/aeb/2024/s7/2_pdf/s7t5103.pdf','IBGE — tabela do PIB, série anual','Tabela 7.5.1.3, coluna Variação real anual, linhas 2011 e 2021: 4,0% e 4,8%.')]
  }),
  revise('selic-debate',{
   quizSummary:'A taxa básica de juros está em torno de 14% ao ano.',
   explanation:'A série 432 do Sistema Gerenciador de Séries Temporais do Banco Central retorna meta Selic de 13,75% ao ano em 23/10/2026. Arredondar esse valor para cerca de 14% é compatível com o dado.',
   sources:[previous('selic-debate').sources[0],proof('https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=23/10/2026&dataFinal=23/10/2026','Banco Central — dado da Selic em 23/10/2026','Série 432, data 23/10/2026, valor 13.75. Consulta direta à base, em formato JSON.'),proof('https://www.bcb.gov.br/controleinflacao/historicotaxasjuros','Banco Central — histórico e decisões','Consulte a decisão vigente em 23/10/2026; a tabela exige JavaScript.')]
  }),
  {
   id:'desenrola-primeiro-mes',speaker:'lula',topic:'Dívidas',verdict:'fake',originalVerdict:'Falso no recorte da data',sourceVerdict:'Enganoso na fala completa',reviewed:true,checkedAt:'2026-10-24',
   quizSummary:'O primeiro Desenrola Brasil foi instituído já no primeiro mês do mandato iniciado em 2023.',
   statement:'A criação legal do primeiro Desenrola Brasil ocorreu em janeiro de 2023.',
   explanation:'A MP 1.176 é de 5 de junho de 2023 e foi publicada no Diário Oficial em 6 de junho. Seu artigo 1º institui o Desenrola Brasil. A criação legal documentada ocorreu em junho, e não em janeiro.',
   scope:'Aqui checamos somente a data da criação legal. O programa é do governo Lula e renegocia dívidas. O site classifica a fala completa como enganosa, não inteiramente falsa. Planejamento ou anúncio anterior não é a instituição legal do programa; não avaliamos quando começaram os estudos.',
   sources:[record(debate,'Mentiras do Lula — fala e contexto do Desenrola','Item Endividamento, 01:44:11. O site conserva o veredito Enganoso para a fala completa.'),proof('https://www2.camara.leg.br/legin/fed/medpro/2023/medidaprovisoria-1176-5-junho-2023-794262-publicacaooriginal-168003-pe.html','Câmara — texto original da MP 1.176/2023','Data de 5/6/2023; artigo 1º institui o programa.'),proof('https://www2.camara.leg.br/legin/fed/medpro/2023/medidaprovisoria-1176-5-junho-2023-794262-norma-pe.html','Câmara — registro de publicação no Diário Oficial','Publicação original: DOU, seção 1, 6/6/2023, página 8. Não confundir com a lei posterior de outubro.')]
  },
  revise('marco-saneamento',{
   quizSummary:'O novo Marco Legal do Saneamento foi aprovado e sancionado no nosso governo.',
   sources:[previous('marco-saneamento').sources[0],...previous('marco-saneamento').sources.slice(1).map(s=>({...s,primary:true}))]
  }),
  revise('fome-33-milhoes',{
   quizSummary:'O cenário anterior à posse era de cerca de 33 milhões de brasileiros passando fome, segundo pesquisa de 2022.',
   statement:'A pesquisa divulgada em 2022 estimava cerca de 33 milhões de brasileiros em insegurança alimentar grave.',
   explanation:'O II VIGISAN da Rede PENSSAN estimou 33,1 milhões de pessoas em insegurança alimentar grave, a partir de coleta de novembro de 2021 a abril de 2022. O número existe na pesquisa usada para descrever o cenário anterior à posse.',
   scope:'Este FATO confirma a estimativa e seu período, não uma medição em janeiro de 2023. Não misturamos pesquisas com métodos diferentes para afirmar que houve aumento ou queda. Atribuição causal a um governo exige outra análise.',
   sources:[previous('fome-33-milhoes').sources[0],proof('https://redepenssan.org.br/2o-inquerito-nacional-sobre-inseguranca-alimentar-no-contexto-da-pandemia-da-covid-19-no-brasil/','Rede PENSSAN — resultados do II VIGISAN','Publicação da instituição responsável pela pesquisa, de 8/6/2022: 33,1 milhões; período 2021/2022.'),proof('https://redepenssan.org.br/wp-content/uploads/2026/01/Relatorio-II-VIGISAN-2022_compressed.pdf#page=39','Rede PENSSAN — relatório e tabela da pesquisa','Página 39 do PDF, tabela 1: Brasil, IA Grave, 33.103 milhares de pessoas, ou cerca de 33,1 milhões.')]
  }),
  revise('celular-cerveja',{
   quizSummary:'O governo atual defende não prender quem rouba celular para comprar cerveja.',
   sources:[previous('celular-cerveja').sources[0],proof('https://www.youtube.com/watch?v=DK1k-Jm-8wo&t=796','Entrevista original — 25/08/2017','Compare 13min17s, sobre violência, e 13min48s, sobre torcidas e cerveja. A prova é a gravação integral, não o veredito de outro site.')]
  }),
  revise('lei-pequena-empresa',{
   quizSummary:'A Lei Geral da Micro e Pequena Empresa foi sancionada no nosso governo.',
   sources:[previous('lei-pequena-empresa').sources[0],...previous('lei-pequena-empresa').sources.slice(1).map(s=>({...s,primary:true}))]
  })
 ]
};
