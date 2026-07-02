import { NextResponse } from "next/server";
import type { GeneratedContentPayload } from "@/components/juridico/juridico-types";

export const dynamic = "force-dynamic";

const DISCLAIMER =
  "⚠️ Conteúdo informativo — não substitui consulta com advogado(a).";

interface PatternInput {
  pattern_type?: string | null;
  hook?: string | null;
  structure?: string | null;
  cta?: string | null;
}

interface GenerateRequest {
  legal_case_id?: string;
  pattern?: PatternInput | null;
  tema?: string | null;
  quantidade?: number;
  area?: string | null;
  publico?: string | null;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ===== Banco de temas por área (mock determinístico) =====

interface MockTema {
  titulo: string;
  hook: string;
  pontos: [string, string, string];
  cta: string;
}

const AREA_TEMAS: Record<string, MockTema[]> = {
  "Direito Trabalhista": [
    {
      titulo: "O que conferir ANTES de assinar a rescisão",
      hook: "Se você vai ser demitido essa semana, NÃO assine nada antes de ver esse vídeo.",
      pontos: [
        "Primeiro: confira o TRCT linha por linha. Saldo de salário, aviso prévio, férias vencidas e proporcionais com um terço, décimo terceiro proporcional e multa de 40% do FGTS. Se faltar uma dessas verbas na demissão sem justa causa, tem coisa errada.",
        "Segundo: assinar o termo NÃO significa concordar com os valores. Você pode escrever \"recebido com ressalvas\" ao lado da assinatura — isso preserva o seu direito de questionar depois na Justiça.",
        "Terceiro: guarde tudo. Contracheques, cartões de ponto, mensagens do chefe. Você tem até 2 anos depois da saída para cobrar diferenças — e quem tem prova, ganha.",
      ],
      cta: "Salva esse vídeo para o dia em que você precisar — e manda para aquele amigo que acabou de ser demitido.",
    },
    {
      titulo: "Horas extras: o dinheiro que fica para trás",
      hook: "Você chega 15 minutos antes e sai 20 depois todo dia? Então a empresa pode estar te devendo dinheiro.",
      pontos: [
        "Primeiro ponto: a lei tolera só 10 minutos de variação por dia. Passou disso, é hora extra — com adicional de no mínimo 50%. Aqueles minutinhos diários viram horas no fim do mês.",
        "Segundo ponto: responder mensagem do chefe fora do horário, fazer curso obrigatório à noite, ficar de sobreaviso com o celular na mão — tudo isso pode contar como jornada. A Justiça do Trabalho já reconheceu.",
        "Terceiro ponto: anote os seus horários reais em um caderno ou app, todos os dias. Print de conversa vale como prova. Sem registro, a discussão vira palavra contra palavra.",
      ],
      cta: "Comenta AQUI se você responde mensagem de trabalho depois do expediente — e me segue para saber o que fazer com isso.",
    },
    {
      titulo: "Pediram para você virar PJ? Cuidado",
      hook: "Te ofereceram \"virar PJ\" para continuar no mesmo emprego? Isso tem nome — e pode ser fraude.",
      pontos: [
        "Primeiro: se você trabalha todo dia no mesmo lugar, com horário fixo, recebendo ordens do mesmo chefe, você tem os requisitos do vínculo de emprego — não importa o que diz o contrato de PJ.",
        "Segundo: a pejotização irregular faz você perder FGTS, férias remuneradas, décimo terceiro, INSS recolhido pela empresa e proteção contra demissão. Some isso na ponta do lápis: costuma ser bem mais do que o \"aumento\" oferecido.",
        "Terceiro: se você já está nessa situação, guarde e-mails, escalas e comprovantes de pagamento. É possível pedir o reconhecimento do vínculo na Justiça e receber tudo retroativo.",
      ],
      cta: "Conhece alguém que virou PJ no mesmo emprego? Marca a pessoa aqui embaixo — esse vídeo pode valer dinheiro para ela.",
    },
  ],
  "Direito de Família": [
    {
      titulo: "Pensão alimentícia: os 3 pontos que geram briga",
      hook: "Pensão alimentícia NÃO é só 30% do salário — e acreditar nisso causa prejuízo dos dois lados.",
      pontos: [
        "Primeiro: não existe percentual fixo em lei. A pensão é calculada pelo binômio necessidade de quem recebe e possibilidade de quem paga. Cada caso é um caso, e o juiz olha provas, não achismos.",
        "Segundo: pagar \"por fora\", sem recibo ou transferência identificada, é um risco enorme. Juridicamente, pagamento sem prova é pagamento que não existiu — e pode acabar em execução e até prisão civil.",
        "Terceiro: perdeu o emprego ou a renda mudou? A pensão não se ajusta sozinha. É preciso pedir a revisão na Justiça. Enquanto isso, o valor antigo continua valendo e a dívida cresce.",
      ],
      cta: "Salva esse vídeo e compartilha com quem paga ou recebe pensão — essas 3 informações evitam processo.",
    },
    {
      titulo: "Guarda compartilhada não é o que você pensa",
      hook: "Guarda compartilhada NÃO significa o filho morar uma semana em cada casa — e quase todo mundo confunde.",
      pontos: [
        "Primeiro: guarda compartilhada é sobre DECISÕES. Escola, saúde, rotina: os dois pais decidem juntos. A criança normalmente segue tendo uma residência principal, com convivência ampla do outro genitor.",
        "Segundo: ela é a regra no Brasil, mesmo quando os pais não se dão bem. O juiz só afasta em situações graves, como risco à criança. Briga de ex não é motivo para guarda unilateral.",
        "Terceiro: guarda compartilhada não elimina a pensão. Quem tem mais renda ou menos tempo com a criança continua contribuindo — o que muda é a forma de organizar a vida do filho.",
      ],
      cta: "Comenta EU NÃO SABIA se você achava que era morar metade do tempo em cada casa — e me segue para entender o direito de família sem juridiquês.",
    },
    {
      titulo: "Divórcio: o checklist de quem sai no prejuízo",
      hook: "No divórcio, quem se organiza primeiro sofre menos — esses 3 passos protegem você.",
      pontos: [
        "Primeiro: levante o patrimônio ANTES de comunicar a decisão. Extratos, imóveis, veículos, dívidas e até milhas aéreas. O que você não sabe que existe, você não consegue partilhar.",
        "Segundo: entenda o seu regime de bens. Na comunhão parcial, divide-se o que foi construído durante o casamento — inclusive por quem \"só\" cuidou da casa. Esse trabalho tem valor jurídico.",
        "Terceiro: não saia de casa sem orientação. Dependendo do caso, isso pode afetar discussões sobre o imóvel e a convivência com os filhos. Uma consulta antes vale mais que dez processos depois.",
      ],
      cta: "Se esse vídeo abriu o seu olho, salva agora e me segue — semana que vem tem a parte 2.",
    },
  ],
  "Direito do Consumidor": [
    {
      titulo: "Cobrança indevida devolve em dobro",
      hook: "Apareceu uma cobrança estranha na sua fatura? Você pode receber o dobro de volta — e quase ninguém cobra.",
      pontos: [
        "Primeiro: o Código de Defesa do Consumidor diz que quem paga cobrança indevida tem direito à devolução em DOBRO, com correção monetária. Assinatura que você nunca contratou, tarifa surpresa, serviço não pedido: tudo entra.",
        "Segundo: o caminho começa com prova. Print da fatura, protocolo da reclamação, gravação da ligação. Registre a contestação na empresa e guarde o número do protocolo — ele vale ouro.",
        "Terceiro: se a empresa enrolar, use o consumidor.gov.br e o Procon. Persistindo, o Juizado Especial resolve causas de até 20 salários mínimos SEM precisar de advogado — mas com um, suas chances de indenização maior aumentam.",
      ],
      cta: "Abre a sua fatura agora e confere. Achou algo estranho? Comenta ACHEI aqui embaixo.",
    },
    {
      titulo: "Voo atrasado ou cancelado: seus direitos na hora",
      hook: "Voo cancelado NÃO é azar, é direito: veja o que a companhia te deve — hotel incluído.",
      pontos: [
        "Primeiro: a partir de 1 hora de atraso, você tem direito a comunicação; com 2 horas, alimentação; com 4 horas, acomodação e transporte — hotel, se precisar pernoitar. Isso vale por resolução da ANAC, e a companhia é obrigada a oferecer.",
        "Segundo: no cancelamento, você escolhe: reembolso integral, reacomodação no próximo voo ou remarcação sem custo. A escolha é SUA, não da empresa.",
        "Terceiro: perdeu compromisso importante, reunião, casamento, conexão internacional? Documente tudo. Atrasos com dano concreto geram indenização por dano moral que os tribunais fixam com frequência entre R$ 2 mil e R$ 10 mil.",
      ],
      cta: "Salva esse vídeo para a sua próxima viagem e manda para aquele amigo que vive pegando avião.",
    },
    {
      titulo: "Nome negativado indevidamente: o que fazer",
      hook: "Descobriu o nome sujo por uma dívida que você NÃO fez? Isso pode valer uma indenização.",
      pontos: [
        "Primeiro: peça o detalhamento da negativação nos birôs — Serasa, SPC, Boa Vista. Você tem direito de saber quem negativou, quando e por quê. Muita gente descobre dívida de empresa onde nunca pôs os pés.",
        "Segundo: conteste por escrito na empresa e no birô. Negativação sem dívida real ou sem notificação prévia é irregular — e a Justiça entende que dano moral, nesses casos, independe de prova de prejuízo.",
        "Terceiro: reúna o extrato da negativação e os protocolos e procure orientação. As indenizações por negativação indevida costumam variar de R$ 5 mil a R$ 15 mil, além da limpeza imediata do nome.",
      ],
      cta: "Consulta o seu CPF hoje. Se encontrar algo errado, volta aqui e comenta ENCONTREI — o próximo vídeo é o passo a passo completo.",
    },
  ],
  "Direito Previdenciário": [
    {
      titulo: "CNIS: o extrato que decide a sua aposentadoria",
      hook: "Um erro num documento que você nunca olhou pode ATRASAR a sua aposentadoria em anos.",
      pontos: [
        "Primeiro: o CNIS é o extrato de toda a sua vida de contribuições. É ele que o INSS olha para conceder ou negar benefício. Vínculos sem data de saída, salários zerados e empregos que não aparecem são erros comuns — e derrubam pedidos todos os dias.",
        "Segundo: consulte agora, de graça, pelo Meu INSS. Compare com a sua carteira de trabalho. Achou diferença? Junte carteira, contracheques e rescisões para pedir o acerto ANTES de dar entrada.",
        "Terceiro: tempo rural, serviço militar, trabalho como aprendiz e períodos de auxílio-doença podem contar no cálculo — mas quase nunca entram sozinhos. Quem revisa o CNIS com antecedência se aposenta mais cedo e com valor maior.",
      ],
      cta: "Abre o Meu INSS hoje e confere o seu CNIS. Comenta CONFERI depois — e salva esse vídeo para ajudar alguém da sua família.",
    },
    {
      titulo: "Benefício negado não é o fim",
      hook: "O INSS negou o seu benefício? Calma: a negativa é o começo da conversa, não o fim.",
      pontos: [
        "Primeiro: leia o motivo exato da negativa na carta de decisão. Falta de tempo, falta de qualidade de segurado, perícia desfavorável: cada motivo tem uma estratégia diferente de reversão.",
        "Segundo: você pode entrar com recurso administrativo em até 30 dias, sem custo. Novos documentos, laudos mais detalhados e o acerto do CNIS viram o jogo em muitos casos.",
        "Terceiro: se o recurso não resolver, a via judicial existe — e as estatísticas mostram que boa parte das negativas cai na Justiça, com pagamento de TODOS os atrasados desde o pedido. Guarde cada protocolo e cada laudo.",
      ],
      cta: "Conhece alguém que teve benefício negado e desistiu? Manda esse vídeo agora — pode mudar a vida dessa pessoa.",
    },
    {
      titulo: "Auxílio-doença: por que a perícia nega quem está doente",
      hook: "Laudo médico na mão e o INSS negou mesmo assim? O problema pode estar em UM detalhe do documento.",
      pontos: [
        "Primeiro: o perito não julga se você está doente — julga se você está INCAPAZ para o SEU trabalho. Laudo que não fala da profissão e das limitações práticas costuma ser ignorado.",
        "Segundo: o atestado ideal tem CID, data de início da doença, tempo estimado de afastamento e a frase-chave: \"incapaz para exercer a função de...\". Peça isso ao seu médico antes da perícia.",
        "Terceiro: negou? Você pode pedir reconsideração, novo pedido com documentos reforçados ou ação judicial com perícia independente. Manter o histórico de exames organizado por data é o que separa quem reverte de quem desiste.",
      ],
      cta: "Salva esse vídeo antes da sua perícia e comenta PERÍCIA se quiser um vídeo só sobre o dia do exame.",
    },
  ],
  "Direito Penal": [
    {
      titulo: "Abordagem policial: seus direitos em 60 segundos",
      hook: "Numa abordagem policial, o que você fala nos primeiros minutos pode definir TUDO — aprenda a se proteger.",
      pontos: [
        "Primeiro: mantenha a calma e não reaja. Você tem o direito de permanecer em silêncio e isso NÃO pode ser usado contra você. Identificar-se, sim; produzir prova contra si mesmo, jamais.",
        "Segundo: você não é obrigado a desbloquear o celular. O acesso ao aparelho, em regra, exige autorização judicial — e provas colhidas de forma ilegal podem ser anuladas.",
        "Terceiro: memorize ou anote o que puder: viatura, nomes, local, horário, testemunhas. Em caso de abuso, esses detalhes sustentam a sua defesa e a responsabilização de quem passou do limite.",
      ],
      cta: "Compartilha esse vídeo — informação assim protege quem você ama. E me segue para a parte 2: o que fazer na delegacia.",
    },
    {
      titulo: "Flagrante e audiência de custódia: as primeiras 24 horas",
      hook: "As primeiras 24 horas após uma prisão são as mais importantes do processo inteiro — e a maioria das famílias trava.",
      pontos: [
        "Primeiro: preso em flagrante, a pessoa deve ser apresentada a um juiz em até 24 horas na audiência de custódia. Ali se decide entre liberdade, medidas cautelares ou prisão preventiva — com advogado presente.",
        "Segundo: a família deve agir rápido: localizar a delegacia, levar documentos e comprovantes de residência e trabalho do preso. Vínculos comprovados pesam a favor da liberdade provisória.",
        "Terceiro: sem advogado particular, a Defensoria Pública atua — é um direito, não um favor. Mas em qualquer cenário, ninguém deve assinar nada sem orientação jurídica.",
      ],
      cta: "Salva esse vídeo. Ninguém espera precisar dele — até precisar. E comenta DÚVIDA que eu respondo.",
    },
    {
      titulo: "\"Retirar a queixa\": quando o processo realmente para",
      hook: "\"Vou retirar a queixa e acabou\" — será? Na maioria dos crimes, NÃO funciona assim.",
      pontos: [
        "Primeiro: em crimes de ação penal pública incondicionada — como lesão corporal grave, roubo e violência doméstica — o processo segue MESMO sem a vítima querer. Quem decide é o Ministério Público, não a vítima.",
        "Segundo: existem crimes que dependem de representação ou queixa, como ameaça e injúria. Nesses, a retratação da vítima até certo momento do processo pode encerrar o caso — os prazos são curtos e técnicos.",
        "Terceiro: na Lei Maria da Penha, a retratação só pode acontecer em audiência específica perante o juiz, e mesmo assim em hipóteses limitadas. Promessa de \"retirar a queixa\" não é botão de desligar processo.",
      ],
      cta: "Comenta EU ACHAVA QUE PODIA se você acreditava nisso — e compartilha para acabar com esse mito de vez.",
    },
  ],
  "Direito Civil": [
    {
      titulo: "Dívida prescrita: o que muda de verdade",
      hook: "Sua dívida \"caducou\"? Cuidado: ela não desaparece — mas o jogo muda a seu favor.",
      pontos: [
        "Primeiro: a maioria das dívidas prescreve em 5 anos. Depois disso, a empresa NÃO pode mais te cobrar na Justiça nem manter seu nome negativado por ela. A dívida vira obrigação sem força de cobrança judicial.",
        "Segundo: negativação por dívida prescrita é irregular — e os tribunais reconhecem dano moral nesses casos. Consulte seu CPF e confira as datas de cada apontamento.",
        "Terceiro: cuidado com ligações oferecendo \"acordo imperdível\" de dívida antiga: pagar qualquer valor ou renegociar pode reiniciar a contagem. Antes de aceitar, verifique a data da dívida original.",
      ],
      cta: "Salva esse vídeo antes de renegociar qualquer dívida antiga — e comenta DATA se quiser aprender a calcular a prescrição.",
    },
    {
      titulo: "Emprestou dinheiro sem contrato? Ainda dá para cobrar",
      hook: "Emprestou dinheiro para amigo ou parente sem nada assinado? Você ainda pode receber — com o que já tem no celular.",
      pontos: [
        "Primeiro: comprovante de PIX ou transferência, conversas de WhatsApp reconhecendo a dívida e áudios valem como prova. O conjunto delas pode substituir o contrato que nunca existiu.",
        "Segundo: comece formalizando: mande uma mensagem objetiva relembrando valor, data e pedindo a devolução. A resposta — mesmo pedindo prazo — é confissão de dívida e reforça o seu caso.",
        "Terceiro: sem acordo, causas de até 20 salários mínimos vão ao Juizado Especial sem custo inicial. E daqui para frente: empréstimo entre conhecidos, só com confissão de dívida assinada. Amizade boa é a que sobrevive ao dinheiro.",
      ],
      cta: "Manda esse vídeo para alguém que está esperando um PIX de volta — e me segue para mais direito do dia a dia.",
    },
    {
      titulo: "Dano moral: o que é (e o que NÃO é)",
      hook: "Nem todo aborrecimento vira indenização — mas os casos que viram, quase ninguém percebe.",
      pontos: [
        "Primeiro: dano moral é violação a direito da personalidade: honra, imagem, dignidade, paz psíquica. Fila demorada e produto atrasado, sozinhos, tendem a ser \"mero aborrecimento\" para os tribunais.",
        "Segundo: já negativação indevida, recusa ilegal de plano de saúde, fraude bancária, exposição vexatória e cobrança humilhante são clássicos com indenização reconhecida com frequência.",
        "Terceiro: o valor depende da gravidade, da capacidade do ofensor e do caráter pedagógico. Documente tudo: prints, protocolos, testemunhas, boletim de ocorrência. Sem prova do fato, não há indenização.",
      ],
      cta: "Ficou na dúvida se o seu caso é dano moral? Descreve em uma frase nos comentários — os melhores viram vídeo resposta.",
    },
  ],
  "Direito Tributário": [
    {
      titulo: "Malha fina: como sair (e como não cair)",
      hook: "Caiu na malha fina? Respira: na maioria dos casos dá para resolver sem pagar UM real de multa.",
      pontos: [
        "Primeiro: malha fina não é acusação, é pendência. Consulte o extrato do IR no e-CAC e veja exatamente o que a Receita apontou: despesa médica sem comprovante e renda divergente lideram a lista.",
        "Segundo: se você errou, a autocorreção salva: enviar declaração retificadora ANTES de ser intimado evita multa de ofício de 75%. Depois da intimação, o custo sobe muito.",
        "Terceiro: se você está certo, junte recibos, notas e informes e aguarde a intimação para apresentar tudo — ou antecipe-se agendando atendimento. Documento organizado resolve a maioria das malhas sem briga.",
      ],
      cta: "Salva esse vídeo para a próxima declaração e comenta MALHA se você já passou por isso.",
    },
    {
      titulo: "Impostos pagos a mais: o dinheiro que você não busca",
      hook: "Você pode ter pago imposto DEMAIS nos últimos 5 anos — e a Receita não vai te avisar.",
      pontos: [
        "Primeiro: pessoa física esquece deduções clássicas: dependentes, previdência privada PGBL, despesas médicas de todo tipo e pensão judicial. Declaração retificadora dos últimos 5 anos pode gerar restituição corrigida pela Selic.",
        "Segundo: empresas no Simples, presumido ou real recolhem tributos indevidos com frequência — verbas indenizatórias na folha e enquadramentos errados são os campeões. A recuperação é administrativa, sem processo.",
        "Terceiro: o prazo é de 5 anos contados do pagamento. Cada mês que passa, um mês de crédito prescreve. Uma revisão fiscal séria começa com os comprovantes de recolhimento em mãos.",
      ],
      cta: "Comenta REVISÃO se você nunca revisou os últimos 5 anos — e compartilha com aquele amigo empresário.",
    },
    {
      titulo: "Conta bloqueada por dívida fiscal: o que fazer",
      hook: "Acordou com a conta bloqueada por dívida fiscal? Nem sempre isso é legal — e dá para reagir rápido.",
      pontos: [
        "Primeiro: o bloqueio judicial tem regras: valores impenhoráveis, como salários e poupança até 40 salários mínimos, não podiam ter sido atingidos. Identifique a origem do bloqueio no seu banco e no processo.",
        "Segundo: verifique se a cobrança é válida: dívida prescrita, CDA com erro ou débito já pago derrubam a execução fiscal. É mais comum do que parece.",
        "Terceiro: aja em dias, não em semanas: os prazos para embargos e exceção de pré-executividade são curtos. Parcelamentos e transações tributárias também podem suspender a cobrança e liberar valores.",
      ],
      cta: "Salva esse vídeo — na hora do bloqueio ninguém tem tempo de pesquisar. E me segue para entender impostos sem dor de cabeça.",
    },
  ],
  "Direito Imobiliário": [
    {
      titulo: "Imóvel na planta atrasou: a conta é da construtora",
      hook: "A obra do seu apê atrasou? A partir de certo ponto, quem paga a conta é a construtora — literalmente.",
      pontos: [
        "Primeiro: o contrato pode prever tolerância de até 180 dias de atraso. PASSOU disso, a construtora está em mora: você pode exigir multa, juros e até o valor de um aluguel mensal pelo período extra de espera.",
        "Segundo: se preferir desistir, o atraso além da tolerância permite a rescisão POR CULPA da construtora — com devolução integral e imediata do que você pagou, corrigido.",
        "Terceiro: guarde o contrato, o memorial, os e-mails e cada promessa de prazo. E cuidado com aditivos que \"esticam\" a entrega em troca de brindes: assinar pode enfraquecer o seu direito.",
      ],
      cta: "Comprou na planta? Comenta o mês prometido de entrega aqui embaixo — e salva esse vídeo até as chaves na mão.",
    },
    {
      titulo: "Distrato: quanto você recebe de volta",
      hook: "Desistiu do imóvel comprado na planta? Veja quanto do seu dinheiro a construtora é OBRIGADA a devolver.",
      pontos: [
        "Primeiro: pela Lei do Distrato, se a desistência é sua, a construtora pode reter até 25% do que você pagou — ou até 50% em empreendimentos com patrimônio de afetação. Mais que isso é abusivo.",
        "Segundo: se a culpa é da construtora — atraso além da tolerância, mudança de projeto, defeitos graves — a história inverte: devolução de 100%, corrigida, em parcela única.",
        "Terceiro: antes de assinar qualquer termo de distrato, confira o cálculo linha por linha: comissão de corretagem e taxas costumam ser descontadas indevidamente. Assinou dando quitação, a discussão fica muito mais difícil.",
      ],
      cta: "Salva esse vídeo antes de assinar qualquer distrato e manda para quem está pensando em desistir do imóvel.",
    },
    {
      titulo: "Alugar sem dor de cabeça: 3 cláusulas para conferir",
      hook: "Essas 3 cláusulas do contrato de aluguel causam 90% das brigas entre inquilino e proprietário.",
      pontos: [
        "Primeiro: a vistoria de entrada. Sem laudo detalhado com fotos, TODO desgaste vira briga na saída. Faça a vistoria juntos, assine e anexe ao contrato — protege os dois lados.",
        "Segundo: multa por rescisão antecipada: ela deve ser proporcional ao tempo restante do contrato. E atenção: quem é transferido de cidade pelo trabalho pode sair sem multa, com aviso de 30 dias.",
        "Terceiro: benfeitorias: pintou, trocou piso, reformou banheiro? Sem autorização por escrito, o inquilino pode não ter direito a nada de volta. Formalize antes de gastar.",
      ],
      cta: "Vai assinar contrato de aluguel? Salva esse vídeo e leva essas 3 cláusulas para a conversa.",
    },
  ],
};

const DEFAULT_TEMAS: MockTema[] = [
  {
    titulo: "3 direitos que os brasileiros mais desconhecem",
    hook: "Você pode estar abrindo mão de dinheiro e direitos AGORA — só por não saber que eles existem.",
    pontos: [
      "Primeiro: cobrança indevida dá devolução em dobro. Tarifa estranha, assinatura fantasma, serviço não contratado — o Código do Consumidor protege, mas só quem reclama recebe.",
      "Segundo: prazos correm contra você. Direitos trabalhistas prescrevem, dívidas prescrevem, revisões têm janela. Quem procura orientação cedo preserva opções; quem espera, perde.",
      "Terceiro: documento é poder. Prints, protocolos, recibos e contratos organizados transformam \"palavra contra palavra\" em caso ganho. Crie o hábito de guardar tudo por 5 anos.",
    ],
    cta: "Salva esse vídeo e me segue — toda semana um direito que ninguém te contou.",
  },
  {
    titulo: "Quando vale a pena procurar um advogado",
    hook: "Esperar \"o problema crescer\" para procurar advogado é o erro mais caro que existe.",
    pontos: [
      "Primeiro: a consulta preventiva custa uma fração do processo. Revisar um contrato antes de assinar evita anos de disputa — vale para emprego, aluguel, compra de imóvel e sociedade.",
      "Segundo: em muitos casos há caminhos rápidos e baratos: Procon, consumidor.gov, Juizados Especiais e acordos extrajudiciais. Um bom profissional te aponta a rota mais curta, não a mais cara.",
      "Terceiro: quem não pode pagar tem a Defensoria Pública e os núcleos de prática jurídica das faculdades. Falta de dinheiro não pode significar falta de defesa.",
    ],
    cta: "Comenta a sua dúvida jurídica em uma frase — as mais curtidas viram os próximos vídeos.",
  },
  {
    titulo: "O passo a passo para provar o que aconteceu",
    hook: "Na Justiça, não vence quem tem razão — vence quem CONSEGUE PROVAR que tem razão.",
    pontos: [
      "Primeiro: registre no momento: fotos com data, vídeos, prints com o número do telefone visível e e-mails. Prova produzida na hora vale mais do que memória reconstruída depois.",
      "Segundo: protocolo é prova de que você tentou resolver. Toda ligação para empresa, anote data, hora e número do protocolo. Reclamações por escrito sempre que possível.",
      "Terceiro: testemunhas contam — avise pessoas de confiança sobre o que está acontecendo enquanto acontece. E o boletim de ocorrência, mesmo em casos cíveis, documenta a sua versão com data oficial.",
    ],
    cta: "Salva esse guia — no dia em que precisar, você vai me agradecer. E compartilha com alguém que está passando por um perrengue.",
  },
];

const AREA_HASHTAGS: Record<string, string[]> = {
  "Direito Trabalhista": [
    "#direitotrabalhista",
    "#trabalhista",
    "#clt",
    "#direitosdotrabalhador",
    "#demissao",
  ],
  "Direito de Família": [
    "#direitodefamilia",
    "#pensaoalimenticia",
    "#divorcio",
    "#guardacompartilhada",
    "#familia",
  ],
  "Direito do Consumidor": [
    "#direitodoconsumidor",
    "#consumidor",
    "#cdc",
    "#nomelimpo",
    "#procon",
  ],
  "Direito Previdenciário": [
    "#direitoprevidenciario",
    "#inss",
    "#aposentadoria",
    "#beneficio",
    "#previdencia",
  ],
  "Direito Penal": [
    "#direitopenal",
    "#criminalista",
    "#advogadocriminalista",
    "#seusdireitos",
    "#justica",
  ],
  "Direito Civil": [
    "#direitocivil",
    "#danomoral",
    "#contratos",
    "#indenizacao",
    "#seusdireitos",
  ],
  "Direito Tributário": [
    "#direitotributario",
    "#impostos",
    "#impostoderenda",
    "#receitafederal",
    "#tributario",
  ],
  "Direito Imobiliário": [
    "#direitoimobiliario",
    "#imoveis",
    "#aluguel",
    "#imovelnaplanta",
    "#construtora",
  ],
};

const GENERIC_HASHTAGS = [
  "#advogado",
  "#direito",
  "#dicasjuridicas",
  "#advocacia",
];

function buildHashtags(area: string): string[] {
  const areaTags = AREA_HASHTAGS[area] ?? ["#direito", "#seusdireitos"];
  return Array.from(new Set([...areaTags, ...GENERIC_HASHTAGS])).slice(0, 8);
}

/** Variações genéricas quando o usuário informa um tema específico. */
function buildTemaVariant(
  tema: string,
  area: string,
  index: number
): MockTema {
  const areaLabel = area || "direito";
  const variants: MockTema[] = [
    {
      titulo: `3 erros sobre ${tema} que custam caro`,
      hook: `Se você acha que entende de ${tema}, esses 3 erros podem provar o contrário — e custar caro.`,
      pontos: [
        `Erro número 1: agir por achismo. Em ${tema}, o que \"todo mundo diz\" quase nunca é o que a lei diz — e decisões tomadas no boato viram prejuízo concreto.`,
        `Erro número 2: não guardar provas. Conversas, recibos, contratos e protocolos sobre ${tema} precisam estar organizados ANTES do problema estourar. Depois, pode ser tarde.`,
        `Erro número 3: deixar o prazo passar. Em ${areaLabel}, quase tudo tem prazo — e direito com prazo vencido é direito perdido. Quem age primeiro, resolve melhor.`,
      ],
      cta: `Salva esse vídeo sobre ${tema} e comenta qual desses erros você já cometeu.`,
    },
    {
      titulo: `O que a lei realmente diz sobre ${tema}`,
      hook: `Quase tudo o que você ouviu sobre ${tema} está incompleto — em 1 minuto eu te mostro o que a lei diz de verdade.`,
      pontos: [
        `Ponto um: a regra geral. Em ${tema}, a lei estabelece direitos claros que a maioria das pessoas desconhece — e desconhecer não te desobriga, mas conhecer te protege.`,
        `Ponto dois: as exceções. Todo caso de ${tema} tem detalhes que mudam o resultado: documentos, datas e a forma como cada passo foi dado. É aí que mora a diferença entre ganhar e perder.`,
        `Ponto três: o primeiro passo prático. Antes de qualquer decisão sobre ${tema}, reúna os seus documentos e busque uma orientação — uma consulta certa na hora certa evita anos de dor de cabeça.`,
      ],
      cta: `Ficou com dúvida sobre ${tema}? Comenta aqui embaixo que eu respondo — e me segue para mais conteúdo sem juridiquês.`,
    },
    {
      titulo: `${tema}: o caso real que serve de alerta`,
      hook: `Uma pessoa me procurou por causa de ${tema} — e o que aconteceu com ela pode acontecer com você.`,
      pontos: [
        `A situação: ela enfrentou um problema clássico de ${tema} e, como a maioria, tentou resolver sozinha, confiando no que leu em grupos e no que \"um conhecido\" disse.`,
        `A virada: quando os documentos foram analisados com calma, apareceu o detalhe que mudava tudo — um direito claro que estava sendo ignorado desde o início.`,
        `A lição: em ${tema}, o barato sai caro. Guarde tudo, não assine nada sob pressão e valide a informação com quem estuda isso todos os dias. O desfecho dela foi positivo porque ainda dava tempo.`,
      ],
      cta: `Conhece alguém passando por algo parecido com ${tema}? Marca a pessoa aqui — esse vídeo pode chegar na hora certa.`,
    },
    {
      titulo: `O maior mito sobre ${tema}`,
      hook: `MITO ou VERDADE: o que dizem por aí sobre ${tema} é verdade? A resposta surpreende.`,
      pontos: [
        `O mito: existe uma crença popular sobre ${tema} repetida em toda roda de conversa — e ela simplesmente não se sustenta quando a gente abre a lei.`,
        `A verdade: a regra real sobre ${tema} é mais favorável do que parece para quem se informa, e mais dura para quem age no impulso. O detalhe está nos requisitos e nos prazos.`,
        `Na prática: antes de decidir qualquer coisa envolvendo ${tema}, confirme a informação em fonte séria. Decisão baseada em mito é a mais cara que existe.`,
      ],
      cta: `Comenta EU ACREDITAVA se você já repetiu esse mito sobre ${tema} — e salva para não esquecer a verdade.`,
    },
    {
      titulo: `${tema}: o passo a passo para resolver`,
      hook: `Ninguém te ensinou o caminho certo para resolver ${tema} — então eu vou te mostrar em 3 passos.`,
      pontos: [
        `Passo 1: documente a situação. Em ${tema}, tudo começa com prova: contratos, prints, recibos e protocolos organizados por data. Sem isso, qualquer caminho fica mais longo.`,
        `Passo 2: tente a via mais rápida. Muitos casos de ${tema} se resolvem com notificação, reclamação formal ou acordo — mais rápido e mais barato do que processo.`,
        `Passo 3: se não resolver, escale com estratégia. Com as provas em mãos e orientação profissional, a via judicial deixa de ser um bicho de sete cabeças e vira um plano com começo, meio e fim.`,
      ],
      cta: `Salva esse passo a passo sobre ${tema} — e compartilha com quem está adiando resolver isso.`,
    },
  ];
  return variants[index % variants.length];
}

function buildMockContents(req: {
  caseId: string;
  area: string;
  publico: string;
  tema: string;
  quantidade: number;
  patternType: string;
  patternCta: string;
}): GeneratedContentPayload[] {
  const { caseId, area, publico, tema, quantidade, patternType, patternCta } = req;
  const seed = hashString(`${caseId}|${area}|${tema}|${patternType}`);
  const bank = AREA_TEMAS[area] ?? DEFAULT_TEMAS;
  const hashtags = buildHashtags(area);

  const out: GeneratedContentPayload[] = [];
  for (let i = 0; i < quantidade; i++) {
    const base: MockTema = tema
      ? buildTemaVariant(tema, area, seed + i)
      : bank[(seed + i) % bank.length];

    // Evita títulos idênticos quando a quantidade excede o banco de temas
    const repeated = !tema && quantidade > bank.length && i >= bank.length;
    const titulo = repeated ? `${base.titulo} (nova versão)` : base.titulo;

    const cta = patternCta && i % 2 === 1 ? patternCta : base.cta;
    const body = base.pontos.join("\n\n");
    const fullScript = [
      `HOOK (0-3s):`,
      base.hook,
      ``,
      `CORPO (3-50s):`,
      body,
      ``,
      `CTA (50-60s):`,
      cta,
    ].join("\n");

    const publicoLinha = publico
      ? `Conteúdo pensado para ${publico.slice(0, 100)}.`
      : "Informação jurídica direta, sem juridiquês.";

    const caption = [
      `${titulo} 👇`,
      ``,
      base.hook,
      ``,
      publicoLinha,
      ``,
      DISCLAIMER,
    ].join("\n");

    out.push({
      title: titulo,
      hook: base.hook,
      body,
      cta,
      full_script: fullScript,
      caption,
      hashtags,
    });
  }
  return out;
}

// ===== Parse robusto da resposta da IA =====

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates: string[] = [];
  if (fenced?.[1]) candidates.push(fenced[1]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1));
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // tenta o próximo candidato
    }
  }
  return null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function ensureDisclaimer(caption: string): string {
  if (caption.includes("não substitui consulta")) return caption;
  return caption.trim().length > 0
    ? `${caption.trim()}\n\n${DISCLAIMER}`
    : DISCLAIMER;
}

function parseAiContents(
  parsed: Record<string, unknown>,
  area: string
): GeneratedContentPayload[] {
  if (!Array.isArray(parsed.contents)) return [];
  const out: GeneratedContentPayload[] = [];
  for (const raw of parsed.contents as unknown[]) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as Record<string, unknown>;
    const hook = str(c.hook);
    const body = str(c.body);
    if (!hook || !body) continue;
    const cta = str(c.cta);
    const fullScript =
      str(c.full_script) ||
      [`HOOK (0-3s):`, hook, ``, `CORPO:`, body, ``, `CTA:`, cta].join("\n");
    const hashtags = Array.isArray(c.hashtags)
      ? (c.hashtags as unknown[])
          .filter((h): h is string => typeof h === "string")
          .slice(0, 10)
      : buildHashtags(area);
    out.push({
      title: str(c.title) || hook.slice(0, 80),
      hook,
      body,
      cta,
      full_script: fullScript,
      caption: ensureDisclaimer(str(c.caption) || `${hook}\n\n${cta}`),
      hashtags,
    });
  }
  return out;
}

export async function POST(request: Request) {
  let body: GenerateRequest;
  try {
    body = (await request.json()) as GenerateRequest;
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  const caseId = (body.legal_case_id ?? "").trim();
  if (!caseId) {
    return NextResponse.json(
      { error: "Informe o legal_case_id" },
      { status: 400 }
    );
  }

  const pattern = body.pattern ?? {};
  const area = (body.area ?? "").trim();
  const publico = (body.publico ?? "").trim();
  const tema = (body.tema ?? "").trim();
  const quantidade = Math.min(5, Math.max(1, Math.round(Number(body.quantidade) || 1)));

  const mockArgs = {
    caseId,
    area,
    publico,
    tema,
    quantidade,
    patternType: (pattern.pattern_type ?? "").trim(),
    patternCta: (pattern.cta ?? "").trim(),
  };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      contents: buildMockContents(mockArgs),
      source: "mock",
    });
  }

  const prompt = [
    `Você é um roteirista especialista em vídeos curtos virais (Reels, Shorts, TikTok) para advogados brasileiros. Escreva em português do Brasil, sem juridiquês, em linguagem falada e natural.`,
    ``,
    `Contexto:`,
    `- Área de atuação: ${area || "Direito (geral)"}`,
    publico ? `- Público-alvo: ${publico}` : `- Público-alvo: público leigo interessado em direitos`,
    tema ? `- Tema específico solicitado: ${tema}` : `- Tema: escolha temas quentes e práticos da área`,
    ``,
    `Padrão viral a replicar:`,
    `- Tipo: ${pattern.pattern_type || "formato livre de alta retenção"}`,
    pattern.hook ? `- Exemplo de gancho do padrão: ${pattern.hook}` : ``,
    pattern.structure ? `- Estrutura do padrão: ${pattern.structure}` : ``,
    pattern.cta ? `- CTA do padrão: ${pattern.cta}` : ``,
    ``,
    `Gere exatamente ${quantidade} conteúdo(s) completo(s) e DIFERENTES entre si, cada um com roteiro falado de 45-60 segundos: gancho de até 3 segundos, corpo com 3 pontos claros e CTA final.`,
    ``,
    `Responda APENAS com um objeto JSON válido, sem texto adicional, no formato:`,
    `{"contents": [{"title": "título curto do vídeo", "hook": "gancho falado (até 3s)", "body": "corpo falado com 3 pontos, separados por quebras de linha", "cta": "chamada para ação final", "full_script": "roteiro completo formatado com HOOK, CORPO e CTA", "caption": "legenda pronta para o post, terminando com o disclaimer", "hashtags": ["#tag1", "#tag2"]}]}`,
    ``,
    `Regras obrigatórias:`,
    `- TODA caption deve terminar com o disclaimer exato: "${DISCLAIMER}"`,
    `- 6 a 10 hashtags jurídicas relevantes por conteúdo, em minúsculas;`,
    `- nenhuma promessa de resultado ou aconselhamento individualizado — apenas informação geral;`,
    `- o corpo deve ser texto falado, natural, que caiba em 45-60 segundos.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4.5",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`OpenRouter respondeu ${res.status}`);

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(content);
    const contents = parsed ? parseAiContents(parsed, area) : [];

    if (contents.length === 0) {
      return NextResponse.json({
        contents: buildMockContents(mockArgs),
        source: "mock",
      });
    }
    return NextResponse.json({
      contents: contents.slice(0, quantidade),
      source: "ai",
    });
  } catch {
    return NextResponse.json({
      contents: buildMockContents(mockArgs),
      source: "mock",
    });
  }
}
