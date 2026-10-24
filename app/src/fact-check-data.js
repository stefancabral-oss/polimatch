const LUPA='https://www.agencialupa.org/checagem/2026/10/23/ao-vivo-checagem-do-ultimo-debate-entre-lula-e-flavio-bolsonaro-no-segundo-turno/';
const AOS='https://www.aosfatos.org/noticias/checamos-flavio-bolsonaro-lula-debate-globo/';
const UOL='https://noticias.uol.com.br/confere/ultimas-noticias/2026/10/24/debate-globo-checagem-flavio-lula.ghtm';
const speech=(url,label,locator)=>({kind:'speech',url,label,locator});
const evidence=(url,label,locator)=>({kind:'evidence',url,label,locator});
export const FACT_EDITION={
  id:'globo-20261023-v1', date:'2026-10-23', checkedAt:'2026-10-24',
  label:'Debate da Globo · 23/10/2026',
  people:{lula:{name:'Lula',personId:1},flavio:{name:'Flávio Bolsonaro',personId:2}},
  questions:[
    {
      id:'pib-apos-2010',speaker:'lula',topic:'Economia',verdict:'fake',originalVerdict:'Falso',
      statement:'Entre a saída de Lula, em 2010, e sua volta, o Brasil não cresceu mais de 3% ao ano.',
      explanation:'O IBGE registra crescimento de 3,9% em 2011, já no governo Dilma. Esse resultado, sozinho, contradiz a afirmação de que a marca não foi superada nesse intervalo.',
      scope:'A checagem trata do crescimento anual do PIB. Não é uma avaliação de qual governo foi melhor.',
      sources:[speech(AOS+'#0b45cc05-ec6c-43ba-a4dc-b26ed62c5068','Aos Fatos — registro e checagem da fala','Seção Lula, item 6: crescimento depois de 2010.'),evidence('https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/9726-em-2011-pib-da-nova-serie-cresceu-3-9-e-chegou-a-r-4-375-trilhoes','IBGE — Contas Nacionais de 2011','Release de 11/03/2015: variação em volume de 3,9% na série revisada.')]
    },
    {
      id:'wifi-brasil',speaker:'flavio',topic:'Internet',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'O governo Bolsonaro instalou mais de 21 mil pontos de internet pelo Wi-Fi Brasil.',
      explanation:'O balanço do Ministério das Comunicações de dezembro de 2022 informa 21,3 mil pontos instalados. O NIC.br preserva uma reprodução pública desse comunicado.',
      scope:'Pontos de acesso não são casas conectadas. O balanço se refere ao acumulado até dezembro de 2022.',
      sources:[speech(UOL,'UOL Confere — registro e checagem da fala','Seção Flávio: buscar “21.300 pontos”.'),evidence('https://www.nic.br/noticia/na-midia/mais-de-21-3-mil-pontos-de-internet-do-wi-fi-brasil-sao-instalados/','NIC.br — reprodução do balanço do MCom','Publicado em 20/12/2022; reproduz comunicado do Portal Gov.br de 19/12/2022.')]
    },
    {
      id:'mercados-agro',speaker:'lula',topic:'Exportações',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'Desde 2023, o Brasil abriu 700 novos mercados para produtos agropecuários.',
      explanation:'A marca foi anunciada pelo Ministério da Agricultura em outubro de 2026. A contagem reúne novas permissões de acesso de produtos brasileiros a mercados externos.',
      scope:'700 mercados não significa 700 países. Também não significa 700 contratos de venda já fechados.',
      sources:[speech(AOS+'#85d0edcd-1adb-447f-aa2a-6b566a10d659','Aos Fatos — registro e checagem da fala','Seção Lula, item 11: abertura de mercados.'),evidence('https://www.gov.br/agricultura/pt-br/assuntos/noticias/vice-presidente-geraldo-alckmin-e-ministro-andre-de-paula-anunciam-marca-de-700-novos-mercados-abertos-para-o-agro-brasileiro','Ministério da Agricultura — anúncio dos 700 mercados','Aviso de 12/10/2026 para a coletiva de 13/10. O título registra a marca anunciada.')]
    },
    {
      id:'celular-cerveja',speaker:'flavio',topic:'Segurança pública',verdict:'fake',originalVerdict:'Falso',
      statement:'Lula defendeu não prender quem rouba celular para comprar cerveja.',
      explanation:'A acusação se apoia em trechos rearranjados de uma entrevista de 2017. No vídeo completo, a referência à cerveja é sobre torcedores rivais confraternizando depois do futebol, em outra resposta.',
      scope:'Quem repetiu a acusação no debate foi Flávio. O jogo checa se ela é verdadeira; não a apresenta como uma fala autêntica de Lula.',
      sources:[speech(UOL,'UOL Confere — acusação feita no debate','Seção Flávio: buscar “cervejinha”.'),evidence('https://www.youtube.com/watch?v=DK1k-Jm-8wo&t=796','Entrevista original de Lula — 25/08/2017','Compare 13min17s, sobre violência, e 13min48s, sobre torcidas e cerveja.'),evidence('https://checamos.afp.com/doc.afp.com.32EX3QR','AFP Checamos — análise da edição do vídeo','Checagem de 19/07/2022, com os dois trechos da mesma entrevista.')]
    },
    {
      id:'fome-33-milhoes',speaker:'lula',topic:'Alimentação',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'Ao retornar à Presidência, Lula encontrou um cenário de cerca de 33 milhões de brasileiros passando fome.',
      explanation:'O II VIGISAN, da Rede PENSSAN, estimou 33,1 milhões de pessoas em insegurança alimentar grave. A pesquisa foi divulgada em junho de 2022, antes da posse de janeiro de 2023.',
      scope:'É uma estimativa de pesquisa com dados de 2021/2022, usada para descrever aquele cenário. Não é uma contagem feita no dia da posse nem um número de 2026.',
      sources:[speech(AOS,'Aos Fatos — registro e checagem da fala','Seção Lula, item 21: insegurança alimentar grave.'),evidence('https://redepenssan.org.br/2o-inquerito-nacional-sobre-inseguranca-alimentar-no-contexto-da-pandemia-da-covid-19-no-brasil/','Rede PENSSAN — II Inquérito Nacional','Divulgação de 08/06/2022: estimativa de 33,1 milhões de pessoas em situação de fome.')]
    },
    {
      id:'selic-debate',speaker:'flavio',topic:'Juros',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'No dia do debate, a taxa básica de juros estava em torno de 14% ao ano.',
      explanation:'A meta Selic era de 13,75% ao ano em 23/10/2026. A expressão “em torno de 14%” é um arredondamento compatível com esse valor.',
      scope:'Isso não confirma outra fala sobre uma previsão de juros de 7%, nem atribui toda a diferença a um presidente. A taxa é decidida pelo Copom.',
      sources:[speech(LUPA,'Agência Lupa — registro e checagem da fala','Buscar “taxa de juros oficial”: classificação VERDADEIRO.'),evidence('https://www.bcb.gov.br/controleinflacao/historicotaxasjuros','Banco Central — histórico da meta Selic','Consultar a decisão em vigor em 23/10/2026: 13,75% ao ano. A tabela depende de JavaScript.'),evidence('https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/custos-referenciais/sistemas-de-custos/bdi/bdi-2','DNIT — registro público da taxa aplicada','Primeira linha da tabela, vigente desde 25/09/2026: meta Selic de 13,75% ao ano.')]
    },
    {
      id:'lei-pequena-empresa',speaker:'lula',topic:'Pequenos negócios',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'A Lei Geral da Micro e Pequena Empresa foi sancionada no governo Lula.',
      explanation:'A Lei Complementar 123 foi sancionada por Lula em 14 de dezembro de 2006. Ela instituiu o Estatuto Nacional da Microempresa e da Empresa de Pequeno Porte e o Simples Nacional.',
      scope:'É uma lei de 2006, não uma criação do mandato iniciado em 2023. A aprovação legislativa também envolveu o Congresso.',
      sources:[speech(LUPA,'Agência Lupa — registro e checagem da fala','Buscar “lei da pequena e média empresa”: classificação VERDADEIRO.'),evidence('https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp123.htm','Planalto — Lei Complementar 123/2006','Data, artigos 1º e 12 e assinatura ao final do texto da lei.')]
    },
    {
      id:'marco-saneamento',speaker:'flavio',topic:'Água e esgoto',verdict:'fato',originalVerdict:'Verdadeiro',
      statement:'O novo Marco Legal do Saneamento foi aprovado e sancionado durante o governo Bolsonaro.',
      explanation:'A Lei 14.026, de 15 de julho de 2020, tem a sanção de Jair Bolsonaro. O projeto que a originou, PL 4.162/2019, foi apresentado pelo Executivo e aprovado pelo Congresso.',
      scope:'A lei de 2020 atualizou o marco de 2007. Não foi o começo de toda a legislação de saneamento e não significa que a universalização já tenha sido entregue.',
      sources:[speech(LUPA,'Agência Lupa — registro e checagem da fala','Buscar “Marco Legal do Saneamento Básico”: classificação VERDADEIRO.'),evidence('https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14026.htm','Planalto — Lei 14.026/2020','Ementa, artigo 1º e assinatura presidencial ao final.'),evidence('https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2213200','Câmara — tramitação do PL 4.162/2019','Ficha de autoria do Poder Executivo e tramitação da proposta.')]
    }
  ]
};
