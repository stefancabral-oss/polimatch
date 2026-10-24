import * as legacy from "./quote-quiz-legacy.js";
import {FACT_EDITION} from './fact-check-data.js';
export const EDITION = "presidential-02";
export const COMBINED_EDITION = 'presidential-checked-03';
export const PEOPLE = Object.freeze([
 {id:"lula", name:"Lula", personId:1},
 {id:"flavio", name:"Flávio Bolsonaro", personId:2},
 {id:"janja", name:"Janja", personId:47},
 {id:"nikolas", name:"Nikolas Ferreira", personId:39},
]);
export const QUESTIONS = Object.freeze([
  {
    "id": "p01",
    "author": "lula",
    "quote": "Acho que só ganha de mim aqui no Brasil Jesus Cristo.",
    "date": "2016-09-15",
    "context": "Em pronunciamento após uma denúncia, falava de sua história pública conhecida. A comparação com Jesus se referia à notoriedade, não à honestidade. A checagem traz o trecho completo e o vídeo original.",
    "sourceUrl": "https://www.aosfatos.org/noticias/video-2016-editado-lula-disse-que-so-bolsonaro-ganha-dele/",
    "sourceLabel": "Aos Fatos · trecho completo e vídeo original",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "quote"
  },
  {
    "id": "p02",
    "author": "flavio",
    "quote": "Classificar facções e milícias como organizações narcoterroristas.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=13",
    "sourceLabel": "TSE · plano de governo · página 13",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "proposal",
    "page": 13
  },
  {
    "id": "p03",
    "author": "janja",
    "quote": "Eu não tenho medo de você, inclusive, Fuck you, Elon Musk",
    "date": "2024-11-16",
    "context": "No G20 Social, no Rio, após um ruído interromper o discurso sobre plataformas digitais. Dirigiu-se a Elon Musk. Trecho com palavrão, registrado em vídeo.",
    "sourceUrl": "https://noticias.r7.com/brasilia/em-evento-paralelo-ao-g20-janja-xinga-elon-musk-16112024/",
    "sourceLabel": "R7 · reportagem com vídeo",
    "choices": [
      "janja",
      "nikolas"
    ],
    "kind": "quote"
  },
  {
    "id": "p04",
    "author": "lula",
    "quote": "O conceito de democracia é relativo para você e para mim.",
    "date": "2023-06-29",
    "context": "À Rádio Gaúcha, ao responder sobre eleições na Venezuela. Em seguida, defendeu respeitar resultados eleitorais e disse que exercia a democracia. Compare com sua defesa da democracia e da alternância de poder em fevereiro de 2025.",
    "sourceUrl": "https://www.cnnbrasil.com.br/politica/conceito-de-democracia-e-relativo-para-voce-e-para-mim-diz-lula-ao-responder-sobre-eleicoes-na-venezuela/",
    "sourceLabel": "CNN Brasil · entrevista à Rádio Gaúcha",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "quote",
    "relatedSource": {
      "url": "https://agenciagov.ebc.com.br/noticias/202502/presidente-defende-regulacao-do-ambiente-digital-201cquanto-maior-a-liberdade-de-expressao-maior-a-responsabilidade201d",
      "label": "Compare: defesa da democracia em 06/02/2025"
    }
  },
  {
    "id": "p05",
    "author": "flavio",
    "quote": "Criar cinco novos presídios federais de segurança máxima.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=14",
    "sourceLabel": "TSE · plano de governo · página 14",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "proposal",
    "page": 14
  },
  {
    "id": "p06",
    "author": "nikolas",
    "quote": "Hoje eu me sinto mulher, a Deputada Nikole.",
    "date": "2023-03-08",
    "context": "Na tribuna da Câmara, colocou uma peruca para fazer um protesto contra políticas de inclusão de mulheres trans. Registro literal do pronunciamento; a frase se refere à encenação do deputado.",
    "sourceUrl": "https://www.camara.leg.br/internet/SitaqWeb/TextoHTML.asp?Data=08/03/2023&dtHoraQuarto=14:44&dtHorarioQuarto=14:44&etapa=5&nuDiscurso=1&nuInsercao=1&nuOrador=1&nuQuarto=2827616&nuSessao=17.2023&sgFaseSessao=BC&txApelido=Nikolas+Ferreira&txEtapa=&txFaseSessao=Breves+Comunica%C3%A7%C3%B5es&txTipoSessao=Ordin%C3%A1ria+-+CD",
    "sourceLabel": "Câmara dos Deputados · transcrição integral",
    "choices": [
      "nikolas",
      "janja"
    ],
    "kind": "quote"
  },
  {
    "id": "p07",
    "author": "flavio",
    "quote": "Adotar um prontuário único, com consentimento, ligando redes de saúde públicas e privadas.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=26",
    "sourceLabel": "TSE · plano de governo · página 26",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "proposal",
    "page": 26
  },
  {
    "id": "p08",
    "author": "lula",
    "quote": "Ainda bem que a natureza, contra a vontade da humanidade, criou esse monstro chamado coronavírus…",
    "date": "2020-05-19",
    "context": "Em entrevista à CartaCapital, defendia o papel do Estado na crise. No dia seguinte, pediu desculpas e classificou a frase como infeliz. O recorte termina antes da explicação; a reportagem traz a continuação.",
    "sourceUrl": "https://noticias.uol.com.br/politica/ultimas-noticias/2020/05/20/lula-entrevista-coronavirus-ainda-bem.htm",
    "sourceLabel": "UOL · fala, continuação e retratação",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "quote"
  },
  {
    "id": "p09",
    "author": "flavio",
    "quote": "Reduzir a maioridade penal de 18 para 16 anos.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=13",
    "sourceLabel": "TSE · plano de governo · página 13",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "proposal",
    "page": 13
  },
  {
    "id": "p10",
    "author": "lula",
    "quote": "Não existe viva alma mais honesta do que eu nesse país",
    "date": "2016-01-20",
    "context": "Em conversa com blogueiros no Instituto Lula, ao responder sobre investigações e corrupção. A frase é uma autodeclaração, não prova sobre fatos investigados. Trecho literal.",
    "sourceUrl": "https://epoca.globo.com/tempo/filtro/noticia/2016/01/nao-existe-viva-alma-mais-honesta-do-que-eu-diz-lula.html",
    "sourceLabel": "Época · encontro no Instituto Lula",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "quote"
  },
  {
    "id": "p11",
    "author": "janja",
    "quote": "Esse é o verdadeiro ungido de Deus",
    "date": "2026-09-09",
    "context": "Sobre Lula, em comício em Teresina, ao responder ao apoio religioso de Michelle Bolsonaro a André Mendonça. A frase é dela; não disse que nem Deus tiraria a eleição de Lula.",
    "sourceUrl": "https://noticias.uol.com.br/eleicoes/2026/09/09/esse-e-o-verdadeiro-ungido-de-deus-diz-janja-sobre-lula-em-teresina.ghtm",
    "sourceLabel": "UOL · comício em Teresina",
    "choices": [
      "janja",
      "nikolas"
    ],
    "kind": "quote",
    "relatedSource": {
      "url": "https://www.aosfatos.org/noticias/janja-deus-eleicao-lula/",
      "label": "Checagem: frase falsa que circulou sobre esse comício"
    }
  },
  {
    "id": "p12",
    "author": "flavio",
    "quote": "Dar auxílio para estudar em outra escola quando faltar vaga na rede pública.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=36",
    "sourceLabel": "TSE · plano de governo · página 36",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "proposal",
    "page": 36
  },
  {
    "id": "p13",
    "author": "lula",
    "quote": "Se tem uma profissão honesta é a do político.",
    "date": "2023-04-28",
    "context": "No Planalto, ao falar com servidores, argumentou que políticos precisam ser aprovados nas urnas periodicamente. Não disse que todo político é honesto: a comparação era sobre prestação de contas eleitoral.",
    "sourceUrl": "https://noticias.uol.com.br/ultimas-noticias/agencia-estado/2023/04/28/lula-se-tem-uma-profissao-honesta-e-a-do-politico.htm",
    "sourceLabel": "Estadão Conteúdo / UOL · discurso no Planalto",
    "choices": [
      "lula",
      "nikolas"
    ],
    "kind": "quote"
  },
  {
    "id": "p14",
    "author": "flavio",
    "quote": "Revisar normas obsoletas e simplificar exigências para abrir e manter negócios.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=27",
    "sourceLabel": "TSE · plano de governo · página 27",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "proposal",
    "page": 27
  },
  {
    "id": "p15",
    "author": "lula",
    "quote": "Exportadora de veado",
    "date": "2000",
    "context": "Sobre Pelotas, em diálogo gravado na campanha municipal e divulgado por adversários. A expressão pejorativa fazia referência a homossexuais. Este é um registro histórico de uma fala preconceituosa, não uma descrição da cidade.",
    "sourceUrl": "https://www1.folha.uol.com.br/folha/brasil/ult96u9767.shtml",
    "sourceLabel": "Folha · gravação divulgada em outubro de 2000",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "quote"
  },
  {
    "id": "p16",
    "author": "nikolas",
    "quote": "Eu estou aqui para defender a sua liberdade.",
    "date": "2023-03-08",
    "context": "No mesmo pronunciamento em que usou uma peruca na Câmara. Defendia sua posição sobre liberdade de expressão e políticas relativas a pessoas trans; a frase foi registrada pelo serviço de taquigrafia.",
    "sourceUrl": "https://www.camara.leg.br/internet/SitaqWeb/TextoHTML.asp?Data=08/03/2023&dtHoraQuarto=14:44&dtHorarioQuarto=14:44&etapa=5&nuDiscurso=1&nuInsercao=1&nuOrador=1&nuQuarto=2827616&nuSessao=17.2023&sgFaseSessao=BC&txApelido=Nikolas+Ferreira&txEtapa=&txFaseSessao=Breves+Comunica%C3%A7%C3%B5es&txTipoSessao=Ordin%C3%A1ria+-+CD",
    "sourceLabel": "Câmara dos Deputados · transcrição integral",
    "choices": [
      "flavio",
      "nikolas"
    ],
    "kind": "quote"
  },
  {
    "id": "p17",
    "author": "flavio",
    "quote": "Permitir retorno imediato ao benefício após o seguro-desemprego, mantidos os critérios de elegibilidade.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=43",
    "sourceLabel": "TSE · plano de governo · página 43",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "proposal",
    "page": 43
  },
  {
    "id": "p18",
    "author": "lula",
    "quote": "Quem chega em Windhoek não parece que está em um país africano.",
    "date": "2003-11-07",
    "context": "Ao visitar a capital da Namíbia, elogiou a limpeza e a arquitetura. A associação gerou constrangimento e críticas por seu estereótipo sobre a África. Na sequência, atribuiu dificuldades do continente à colonização e às guerras.",
    "sourceUrl": "https://www.tribunapr.com.br/noticias/brasil/lula-namibia-e-tao-limpa-que-nem-parece-a-africa/",
    "sourceLabel": "Tribuna · cobertura da visita à Namíbia",
    "choices": [
      "flavio",
      "lula"
    ],
    "kind": "quote"
  },
  {
    "id": "p19",
    "author": "flavio",
    "quote": "Retomar o Casa Verde e Amarela, mirando 2,5 milhões de residências.",
    "date": "2026",
    "dateLabel": "Plano 2027–2030 · consultado em 20/10/2026",
    "context": "Resumo do plano registrado no TSE; proposta, não realização.",
    "sourceUrl": "https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl#page=47",
    "sourceLabel": "TSE · plano de governo · página 47",
    "choices": [
      "lula",
      "flavio"
    ],
    "kind": "proposal",
    "page": 47
  },
  {
    "id": "p20",
    "author": "lula",
    "quote": "Cadê as mulheres de grelo duro do nosso partido?",
    "date": "2016-03-15",
    "context": "Em conversa telefônica com Paulo Vannuchi, divulgada em março de 2016. Falava de correligionárias que queria mobilizar contra um procurador. O áudio e a transcrição registram a expressão grosseira; as acusações feitas no diálogo não são confirmadas pelo jogo.",
    "sourceUrl": "https://www.metropoles.com/brasil/politica-brasil/lula-ofende-feministas-do-pt-em-novo-audio-divulgado-pela-pf",
    "sourceLabel": "Metrópoles · áudio e íntegra do diálogo",
    "choices": [
      "janja",
      "lula"
    ],
    "kind": "quote"
  }
].map(q => Object.freeze({...q, choices:Object.freeze(q.choices)})));
const debateSummaries = [
 'A economia brasileira não cresceu mais de 3% ao ano entre 2011 e 2022.',
 'Até dezembro de 2022, instalamos mais de 21 mil pontos de internet pelo Wi-Fi Brasil.',
 'O Brasil abriu 700 novos mercados para produtos agropecuários desde 2023.',
 'O governo atual defende não prender quem rouba celular para comprar cerveja.',
 'Quando nosso governo assumiu, em 2023, havia cerca de 33 milhões de brasileiros passando fome.',
 'A taxa básica de juros está em torno de 14% ao ano.',
 'Nosso governo fez a Lei Geral da Micro e Pequena Empresa.',
 'Nós fizemos o novo Marco Legal do Saneamento.'
];
export const DEBATE_QUESTIONS = Object.freeze(FACT_EDITION.questions.map((fact,i)=>Object.freeze({
 id:`debate-${fact.id}`,author:fact.speaker,quote:debateSummaries[i],kind:'fact',
 date:FACT_EDITION.date,context:fact.explanation,sourceUrl:fact.sources[0].url,
 sourceLabel:fact.sources[0].label,choices:Object.freeze(i%2?['flavio','lula']:['lula','flavio']),fact
})));
export const COMBINED_QUESTIONS = Object.freeze(DEBATE_QUESTIONS.flatMap((q,i)=>[q,...QUESTIONS.slice(i*2,i*2+2)]).concat(QUESTIONS.slice(DEBATE_QUESTIONS.length*2)));
export const EDITIONS = Object.freeze({
 [COMBINED_EDITION]: Object.freeze({id:COMBINED_EDITION,number:'3',label:'Corrida presidencial + Fato ou fake',people:PEOPLE,questions:COMBINED_QUESTIONS}),
 [EDITION]: Object.freeze({id:EDITION, number:"2", label:"Corrida presidencial", people:PEOPLE, questions:QUESTIONS}),
 [legacy.EDITION]: Object.freeze({id:legacy.EDITION, number:"1", label:"Lula ou Flávio?", people:legacy.PEOPLE, questions:Object.freeze(legacy.QUESTIONS.map(q=>Object.freeze({...q,kind:"quote",choices:Object.freeze(["lula","flavio"])})))}),
});
export const LEGACY_EDITION = legacy.EDITION;
export function editionFor(id=EDITION) {return EDITIONS[id] || EDITIONS[EDITION];}
