const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// ============================================================
// 👑 BOT AUTOMÁTICO003
// ============================================================

const DONO = "258SEUNUMERO@s.whatsapp.net";

// COLOQUE O WEBHOOK DO SEU MACRODROID ENTRE AS ASPAS
const WEBHOOK_URL = "COLE_AQUI_SEU_WEBHOOK_MACRODROID";

const PREFIXO = ".";

const DATA_DIR = "./dados";
const AUTH_DIR = "./auth_info_baileys";

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// ============================================================
// 💾 BANCO JSON
// ============================================================

const ARQUIVO = path.join(DATA_DIR, "banco.json");

const BANCO_PADRAO = {
  clientes: {},
  compras: [],
  fila: [],
  nanos: {},
  grupos: {},
  pagamentos: {
    mpesa: [],
    emola: []
  },
  config: {
    aluguelBot: false,
    manutencao: false,
    detector: true,
    antiburlador: true,
    filaSilenciosa: false
  },
  precosBot: {
    1: 50,
    7: 150,
    30: 500
  },
  stock: [],
  sessoes: {},
  alugueis: {}
};

function carregarBanco() {
  try {
    if (!fs.existsSync(ARQUIVO)) {
      fs.writeFileSync(
        ARQUIVO,
        JSON.stringify(BANCO_PADRAO, null, 2)
      );
      return JSON.parse(JSON.stringify(BANCO_PADRAO));
    }

    const dados = JSON.parse(
      fs.readFileSync(ARQUIVO, "utf8")
    );

    return {
      ...BANCO_PADRAO,
      ...dados
    };
  } catch (e) {
    console.log("Erro ao carregar banco:", e);
    return JSON.parse(JSON.stringify(BANCO_PADRAO));
  }
}

let banco = carregarBanco();

function salvarBanco() {
  fs.writeFileSync(
    ARQUIVO,
    JSON.stringify(banco, null, 2)
  );
}

// ============================================================
// 📦 TABELA DE PREÇOS
// ============================================================

const TABELA_PADRAO = {

  "410MB": 10,
  "520MB": 13,
  "610MB": 15,
  "810MB": 20,
  "1.30GB": 25,
  "1.220GB": 30,
  "1.540GB": 38,
  "2.60GB": 50,
  "2.440GB": 60,
  "3.100GB": 75,
  "4.150GB": 100,
  "5.200GB": 150,
  "10GB": 230,

  "3.4GB": 95,
  "5.2GB": 145,
  "7.1GB": 185,
  "10.7GB": 285,
  "14.300GB": 379,

  "2.920GB": 100,
  "7GB": 190,
  "10.715GB": 290,
  "17.900GB-489": 489,
  "17.900GB-470": 470,
  "35.800GB": 989,
  "53.600GB": 1399,
  "71.500GB": 1849,
  "89.400GB": 2350
};

if (!banco.tabela) {
  banco.tabela = TABELA_PADRAO;
  salvarBanco();
}

// ============================================================
// 🔧 FUNÇÕES
// ============================================================

function normalizarNumero(numero) {
  return String(numero || "")
    .replace(/\D/g, "");
}

function jidNumero(jid) {
  return String(jid || "")
    .split("@")[0]
    .split(":")[0];
}

function ehGrupo(jid) {
  return jid && jid.endsWith("@g.us");
}

function mencionar(jid) {
  return `@${jidNumero(jid)}`;
}

function obterNome(msg) {
  return (
    msg.pushName ||
    jidNumero(msg.key.participant || msg.key.remoteJid)
  );
}

function salvarCliente(jid) {

  if (!banco.clientes[jid]) {
    banco.clientes[jid] = {
      nome: "",
      compras: 0,
      totalGasto: 0,
      pontos: 0,
      mbComprados: 0,
      ultimaCompra: null
    };
  }

  return banco.clientes[jid];
}

function converterParaMB(pacote) {

  const texto = String(pacote)
    .toUpperCase()
    .replace(/\s/g, "");

  const numero = parseFloat(texto);

  if (!numero || isNaN(numero)) {
    return 0;
  }

  if (texto.includes("GB")) {
    return Math.round(numero * 1000);
  }

  return Math.round(numero);
}

function procurarPacote(texto) {

  if (!texto) return null;

  const entrada = String(texto)
    .toUpperCase()
    .replace(/\s/g, "");

  const tabela = banco.tabela || {};

  for (const [pacote, preco] of Object.entries(tabela)) {

    if (
      pacote.toUpperCase() === entrada ||
      pacote.toUpperCase().replace("-", "") ===
      entrada.replace("-", "")
    ) {
      return {
        pacote,
        preco
      };
    }
  }

  return null;
}

function formatarMT(valor) {
  return Number(valor || 0).toFixed(2) + " MT";
}

// ============================================================
// 👑 ADMIN
// ============================================================

function ehDono(jid) {
  return jidNumero(jid) === jidNumero(DONO);
}

async function ehAdmin(sock, grupo, usuario) {

  if (ehDono(usuario)) return true;

  try {

    const meta = await sock.groupMetadata(grupo);

    const participante = meta.participants.find(
      p => jidNumero(p.id) === jidNumero(usuario)
    );

    return !!(
      participante &&
      (participante.admin === "admin" ||
       participante.admin === "superadmin")
    );

  } catch {
    return false;
  }
}

// ============================================================
// 📋 MENU
// ============================================================

function menuAdmin() {

  return `
👑 *⚡BOT AUTOMÁTICO003⚡*

🛡️ *MENU DE ADMINISTRAÇÃO*

*1️⃣ GERENCIAR MEMBROS*

1.1 🔨 .ban @user
1.2 👢 .kick @user
1.3 ➕ .add [número]
1.4 ⬆️ .promover @user
1.5 ⬇️ .rebaixar @user
1.6 🔇 .mute @user
1.7 🔊 .unmute @user

*2️⃣ GRUPO*

2.1 🔓 .abrir
2.2 🔒 .fechar
2.3 ⏰ .abrirhorario HH:MM
2.4 ⏰ .fecharhorario HH:MM

*3️⃣ MENSAGENS*

3.1 👋 .boasvindas on/off
3.2 💬 .nanobemvindo [msg]
3.3 🗑️ .delete
3.4 🧹 .limpar
3.5 🆔 .id
3.6 🆔 .jid
3.7 🆔 .meujid

*4️⃣ RESPOSTAS AUTOMÁTICAS*

4.1 🤖 .nano on/off
4.2 ➕ .nanoadd gatilho, resposta
4.3 ➖ .nanodel [gatilho]
4.4 📋 .nanolist
4.5 🧹 .limparnanos

*5️⃣ PROTEÇÕES*

5.1 🚫 .antilink on/off
5.2 🚫 .antilinkhard on/off
5.3 🚫 .antifoto on/off
5.4 🚫 .antivideo on/off
5.5 🚫 .antiaudio on/off
5.6 🚫 .antisticker on/off
5.7 🚫 .antidocumento on/off
5.8 🌊 .antiflood on/off

*6️⃣ COMPRAS*

6.1 🛒 .compra [pacote]
6.2 📦 .compras
6.3 👤 .clientes
6.4 📊 .relatorio
6.5 ✅ .aprovar [ID]
6.6 ❌ .recusar [ID]

*7️⃣ PAGAMENTOS*

7.1 💳 .addmpesa [número] [nome]
7.2 💳 .addemola [número] [nome]
7.3 🔎 .detector on/off
7.4 🕵️ .antiburlador on/off
7.5 ↩️ .estornar [ID]
7.6 🧾 .compras
7.7 ⚙️ .status
7.8 🛠️ .manutencao on/off
7.9 💵 .caixa
7.10 💳 .contas
7.11 🔕 .filasilenciosa on/off

*8️⃣ TABELA*

8.1 ⚙️ .config
8.2 ✏️ .editarconfig [pacote] - [preço]
8.3 🗑️ .removerconfig [pacote]
8.4 📋 .tabela

*9️⃣ FIDELIDADE*

9.1 🎁 .pontos
9.2 🎉 .resgatar [pontos]

*🔟 FILA*

10.1 📋 .fila
10.2 🧹 .limparfila [número]/tudo

*1️⃣1️⃣ MULTI-SESSÃO*

11.1 🆕 .novasessao [número] qr/pairing
11.2 🎁 .brinde [número]
11.3 📋 .sessoes
11.4 🔄 .renovarsessao [número] [dias]
11.5 🔌 .encerrarsessao [número]
11.6 🗑️ .cancelarsessao [número]

*1️⃣2️⃣ ALUGUEL*

12.1 💲 .addprecobot [dias] [preço]
12.2 📜 .precosbot
12.3 🔛 .aluguelbot on/off

*1️⃣3️⃣ MACRODROID*

13.1 🔗 .setwebhookgrupo [link]
13.2 👁️ .verwebhookgrupo
13.3 ❌ .removerwebhookgrupo

*1️⃣4️⃣ STOCK & LUCRO*

14.1 ➕ .addstock [quantidade] [custo] [descrição]
14.2 📦 .stock
14.3 💰 .lucro
14.4 🧹 .resetstock

*1️⃣5️⃣ DONO*

15.1 📅 .alugar [dias]
15.2 🎟️ .alugarc [dias]
15.3 ✅ .ativar [código]
15.4 ❌ .anular
15.5 📋 .alugueis

*1️⃣6️⃣ GERAL*

📜 .menu
👑 .dono
🏓 .ping
🕒 .horas

━━━━━━━━━━━━━━━━━━
🤖 *⚡BOT AUTOMÁTICO003⚡*
`;
}

function menuPublico() {

  return `
👑 *⚡ BOT AUTOMÁTICO003 ⚡*

🛒 *COMPRAS*
`.trim();
}

// ============================================================
// 📋 TABELA
// ============================================================

function gerarTabela() {

  const tabela = banco.tabela || {};

  let diario = "";
  let semanal = "";
  let mensal = "";

  for (const [pacote, preco] of Object.entries(tabela)) {

    const mb = converterParaMB(pacote);

    if (mb <= 10000) {
      diario += `📦 ${pacote} → ${preco} MT\n`;
    } else if (mb <= 15000) {
      semanal += `📦 ${pacote} → ${preco} MT\n`;
    } else {
      mensal += `📦 ${pacote} → ${preco} MT\n`;
    }
  }

  return `
🔥 *TABELA DE PROMOÇÃO ATUALIZADA* 🔥

☀️ *PACOTES*
${diario || "Nenhum pacote"}

📅 *SEMANAL*
${semanal || "Nenhum pacote"}

🗓️ *MENSAL*
${mensal || "Nenhum pacote"}

💳 Para comprar:
*.compra PACOTE*

Exemplo:
*.compra 810MB*
`;
}

// ============================================================
// 💳 PAGAMENTOS
// ============================================================

function gerarPagamento() {

  const mpesa = banco.pagamentos.mpesa || [];
  const emola = banco.pagamentos.emola || [];

  let texto = `
💳 *FORMAS DE PAGAMENTO*

`;

  if (mpesa.length) {
    texto += `📱 *M-PESA*\n`;

    for (const conta of mpesa) {
      texto += `• ${conta.nome}: ${conta.numero}\n`;
    }

    texto += "\n";
  }

  if (emola.length) {
    texto += `📱 *E-MOLA*\n`;

    for (const conta of emola) {
      texto += `• ${conta.nome}: ${conta.numero}\n`;
    }

    texto += "\n";
  }

  texto += `
📌 Depois do pagamento:
1️⃣ Envie o comprovativo
2️⃣ Envie o número que receberá os megabytes
3️⃣ Aguarde a confirmação

⚠️ Nunca envie PIN ou senha.
`;

  return texto;
}

// ============================================================
// 🛒 COMPRAS
// ============================================================

async function iniciarCompra(sock, jid, pacote, numero) {

  const produto = procurarPacote(pacote);

  if (!produto) {

    await sock.sendMessage(jid, {
      text:
        "❌ Pacote não encontrado.\n\n" +
        gerarTabela()
    });

    return;
  }

  const cliente = salvarCliente(jid);

  const id =
    "CMP" +
    Date.now().toString(36).toUpperCase();

  const compra = {

    id,
    jid,
    nome: cliente.nome,
    pacote: produto.pacote,
    valor: produto.preco,
    numero: normalizarNumero(numero),
    status: "AGUARDANDO_PAGAMENTO",
    criadoEm: new Date().toISOString()
  };

  banco.compras.push(compra);

  banco.fila.push({
    id,
    jid,
    pacote: produto.pacote,
    numero: compra.numero,
    status: "AGUARDANDO_PAGAMENTO"
  });

  salvarBanco();

  await sock.sendMessage(jid, {
    text: `
🛒 *COMPRA CRIADA*

🆔 ID: *${id}*
📦 Pacote: *${produto.pacote}*
💰 Valor: *${formatarMT(produto.preco)}*
📱 Número: *${compra.numero || "NÃO INFORMADO"}*

${gerarPagamento()}

📌 Depois de pagar, envie o comprovativo nesta conversa.

⏳ Status: *AGUARDANDO PAGAMENTO*
`
  });

}

// ============================================================
// 🚀 MACRODROID
// ============================================================

async function enviarParaMacroDroid(compra) {

  if (!WEBHOOK_URL ||
      WEBHOOK_URL.includes("COLE_AQUI")) {

    console.log(
      "⚠️ WEBHOOK_URL ainda não configurado."
    );

    return false;
  }

  try {

    const resposta = await fetch(WEBHOOK_URL, {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({

        tipo: "TRANSFERIR_MEGAS",

        id: compra.id,

        pacote: compra.pacote,

        numero: compra.numero,

        valor: compra.valor,

        cliente: compra.jid,

        timestamp: Date.now()

      })

    });

    console.log(
      "MacroDroid:",
      resposta.status
    );

    return resposta.ok;

  } catch (erro) {

    console.log(
      "Erro MacroDroid:",
      erro.message
    );

    return false;
  }
}

// ============================================================
// ✅ APROVAR COMPRA
// ============================================================

async function aprovarCompra(sock, jid, id) {

  const compra = banco.compras.find(
    c => c.id === id
  );

  if (!compra) {

    await sock.sendMessage(jid, {
      text: "❌ Compra não encontrada."
    });

    return;
  }

  if (compra.status === "CONCLUIDA") {

    await sock.sendMessage(jid, {
      text: "⚠️ Esta compra já foi concluída."
    });

    return;
  }

  const cliente = salvarCliente(compra.jid);

  const mb = converterParaMB(compra.pacote);

  cliente.compras++;
  cliente.totalGasto += Number(compra.valor);
  cliente.pontos += Math.floor(
    Number(compra.valor) / 10
  );
  cliente.mbComprados += mb;
  cliente.ultimaCompra = new Date().toISOString();

  compra.status = "TRANSFERINDO";
  compra.aprovadoEm = new Date().toISOString();

  banco.fila = banco.fila.filter(
    f => f.id !== compra.id
  );

  salvarBanco();

  const enviado = await enviarParaMacroDroid(compra);

  if (enviado) {

    compra.status = "CONCLUIDA";

    salvarBanco();

    const posicao =
      Object.values(banco.clientes)
        .sort((a, b) => b.totalGasto - a.totalGasto)
        .findIndex(c =>
          c === cliente
        ) + 1;

    await sock.sendMessage(compra.jid, {

      text: `
🎉 *COMPRA REGISTRADA COM SUCESSO!* 🎉

🛒 Compra: *${compra.pacote}*
💰 Valor Pago: *${formatarMT(compra.valor)}*
📱 Número Recarregado: *${compra.numero}*

⭐ Pontos Ganhos:
*+${Math.floor(Number(compra.valor) / 10)} pts*

🏆 Posição no Grupo:
*${posicao}º lugar*

📈 Total de Compras:
*${cliente.compras}*

💰 Total Gasto:
*${formatarMT(cliente.totalGasto)}*

🆔 ID:
*${compra.id}*

✅ *Transferência enviada para o sistema automático.*
`
    });

  } else {

    compra.status = "FILA_TRANSFERENCIA";

    salvarBanco();

    await sock.sendMessage(compra.jid, {

      text: `
⚠️ *PAGAMENTO APROVADO*

📦 ${compra.pacote}
📱 ${compra.numero}

⏳ A transferência foi colocada na fila.

🆔 ${compra.id}
`
    });
  }
}

// ============================================================
// 👥 PARTICIPANTE
// ============================================================

function obterAlvo(msg) {

  if (
    msg.message?.extendedTextMessage?.contextInfo
      ?.mentionedJid?.length
  ) {

    return msg.message.extendedTextMessage
      .contextInfo.mentionedJid[0];
  }

  return null;
}

// ============================================================
// 🛡️ PROTEÇÕES
// ============================================================

function textoDaMensagem(msg) {

  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ""
  );
}

function tipoMensagem(msg) {

  if (msg.message?.imageMessage) return "foto";
  if (msg.message?.videoMessage) return "video";
  if (msg.message?.audioMessage) return "audio";
  if (msg.message?.stickerMessage) return "sticker";
  if (msg.message?.documentMessage) return "documento";

  return "texto";
}

const linksRegex =
  /(https?:\/\/|www\.|chat\.whatsapp\.com\/|t\.me\/|bit\.ly\/)/i;

const palavroes = [
  "filho da puta",
  "puta",
  "caralho",
  "porra",
  "merda"
];

// ============================================================
// 👋 BOAS-VINDAS
// ============================================================

async function boasVindas(sock, msg) {

  const grupo = msg.key.remoteJid;

  if (!ehGrupo(grupo)) return;

  const cfg =
    banco.grupos[grupo];

  if (!cfg || cfg.boasvindas === false) return;

  const participantes =
    msg.message?.extendedTextMessage
      ?.contextInfo?.mentionedJid || [];

  if (!participantes.length) return;

  const texto =
    cfg.mensagemBoasVindas ||
    `
🎉 *BEM-VINDO(A)!* 🎉

👋 Olá @${jidNumero(participantes[0])}

🤖 Você está no *BOT AUTOMÁTICO003*.

📋 Digite *.menu*
🛒 Digite *.tabela*
💳 Digite *.pagamento*

Boa estadia! ❤️
`;

  await sock.sendMessage(grupo, {
    text: texto,
    mentions: participantes
  });
}

// ============================================================
// 🧠 NANO
// ============================================================

async function processarNano(sock, jid, texto) {

  const grupo = banco.grupos[jid];

  if (!grupo || grupo.nano === false) return false;

  const nanos =
    banco.nanos[jid] || {};

  const chave =
    texto.toLowerCase().trim();

  if (nanos[chave]) {

    await sock.sendMessage(jid, {
      text: nanos[chave]
    });

    return true;
  }

  return false;
}

// ============================================================
// 🔢 STATUS
// ============================================================

function gerarStatus() {

  const totalCompras =
    banco.compras.length;

  const concluidas =
    banco.compras.filter(
      c => c.status === "CONCLUIDA"
    ).length;

  const pendentes =
    banco.compras.filter(
      c =>
        c.status === "AGUARDANDO_PAGAMENTO" ||
        c.status === "FILA_TRANSFERENCIA"
    ).length;

  const faturamento =
    banco.compras
      .filter(c => c.status === "CONCLUIDA")
      .reduce(
        (s, c) => s + Number(c.valor),
        0
      );

  return `
⚙️ *STATUS DO BOT*

🤖 BOT: *ONLINE*

🛒 Compras: *${totalCompras}*
✅ Concluídas: *${concluidas}*
⏳ Pendentes: *${pendentes}*

👥 Clientes: *${
    Object.keys(banco.clientes).length
  }*

💰 Faturamento:
*${formatarMT(faturamento)}*

📋 Fila:
*${banco.fila.length}*

🔗 MacroDroid:
*${
    WEBHOOK_URL.includes("COLE_AQUI")
      ? "NÃO CONFIGURADO"
      : "CONFIGURADO"
  }*
`;
}

// ============================================================
// 📊 RELATÓRIO
// ============================================================

function gerarRelatorio() {

  const compras =
    banco.compras;

  const total =
    compras.reduce(
      (s, c) => s + Number(c.valor),
      0
    );

  const concluidas =
    compras.filter(
      c => c.status === "CONCLUIDA"
    );

  return `
📊 *RELATÓRIO GERAL*

🛒 Compras:
*${compras.length}*

✅ Concluídas:
*${concluidas.length}*

⏳ Pendentes:
*${
    compras.length -
    concluidas.length
  }*

💰 Movimento:
*${formatarMT(total)}*

👥 Clientes:
*${
    Object.keys(banco.clientes).length
  }*

📦 MB vendidos:
*${
    Object.values(banco.clientes)
      .reduce(
        (s, c) =>
          s + Number(c.mbComprados || 0),
        0
      )
  } MB*
`;
}

// ============================================================
// 📦 STOCK
// ============================================================

function gerarStock() {

  if (!banco.stock.length) {
    return "📦 *STOCK VAZIO*";
  }

  let texto =
    "📦 *STOCK*\n\n";

  banco.stock.forEach(
    (item, i) => {

      texto +=
        `${i + 1}. ${item.quantidade} | ` +
        `${formatarMT(item.custo)} | ` +
        `${item.descricao}\n`;
    }
  );

  return texto;
}

// ============================================================
// 💰 LUCRO
// ============================================================

function gerarLucro() {

  const vendas =
    banco.compras
      .filter(c => c.status === "CONCLUIDA")
      .reduce(
        (s, c) => s + Number(c.valor),
        0
      );

  const custos =
    banco.stock.reduce(
      (s, i) => s + Number(i.custo),
      0
    );

  return `
💰 *LUCRO*

💵 Vendas:
${formatarMT(vendas)}

📦 Custos:
${formatarMT(custos)}

📈 Resultado:
${formatarMT(vendas - custos)}
`;
}

// ============================================================
// 🔄 MULTI-SESSÃO
// ============================================================

const sessoesAtivas = {};

async function iniciarSessao(numero, modo = "qr") {

  numero = normalizarNumero(numero);

  if (!numero) {
    console.log("Número inválido.");
    return;
  }

  const pasta =
    `./sessoes/${numero}`;

  if (!fs.existsSync("./sessoes")) {
    fs.mkdirSync("./sessoes");
  }

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(pasta);

  const {
    version
  } = await fetchLatestBaileysVersion();

  const sock =
    makeWASocket({

      version,

      auth: state,

      logger: pino({
        level: "silent"
      }),

      markOnlineOnConnect: false,

      generateHighQualityLinkPreview: false
    });

  sessoesAtivas[numero] = sock;

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  sock.ev.on(
    "connection.update",
    async update => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      if (
        qr &&
        modo === "qr"
      ) {

        console.log(
          `\n📱 QR DA SESSÃO ${numero}\n`
        );

        qrcode.generate(
          qr,
          { small: true }
        );
      }

      if (
        qr &&
        modo === "pairing" &&
        !state.creds.registered
      ) {

        try {

          const codigo =
            await sock.requestPairingCode(
              numero
            );

          console.log(
            `\n🔑 CÓDIGO DE PAREAMENTO ${numero}: ${codigo}\n`
          );

        } catch (e) {

          console.log(
            "Erro pairing:",
            e.message
          );
        }
      }

      if (connection === "open") {

        console.log(
          `✅ Sessão ${numero} conectada.`
        );

        banco.sessoes[numero] = {
          numero,
          criadaEm:
            banco.sessoes[numero]?.criadaEm ||
            new Date().toISOString(),
          ativa: true
        };

        salvarBanco();
      }

      if (connection === "close") {

        const codigo =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;

        delete sessoesAtivas[numero];

        if (
          codigo !==
          DisconnectReason.loggedOut
        ) {

          setTimeout(
            () => iniciarSessao(numero, modo),
            5000
          );
        }
      }
    }
  );

  return sock;
}

// ============================================================
// 📨 PROCESSADOR PRINCIPAL
// ============================================================

async function processarMensagem(
  sock,
  msg
) {

  if (!msg.message) return;

  if (msg.key.fromMe) return;

  const jid =
    msg.key.remoteJid;

  const remetente =
    msg.key.participant ||
    jid;

  const texto =
    textoDaMensagem(msg).trim();

  const lower =
    texto.toLowerCase();

  const grupo =
    ehGrupo(jid);

  // ========================================
  // 👋 NOVOS MEMBROS
  // ========================================

  if (
    msg.message.groupParticipantsUpdate
  ) {
    await boasVindas(sock, msg);
    return;
  }

  // ========================================
  // 🛡️ PROTEÇÕES
  // ========================================

  if (grupo) {

    if (!banco.grupos[jid]) {
      banco.grupos[jid] = {
        boasvindas: true,
        nano: true,
        antilink: false,
        antilinkhard: false,
        antifoto: false,
        antivideo: false,
        antiaudio: false,
        antisticker: false,
        antidocumento: false,
        antiflood: false
      };

      salvarBanco();
    }

    const cfg =
      banco.grupos[jid];

    const admin =
      await ehAdmin(
        sock,
        jid,
        remetente
      );

    const tipo =
      tipoMensagem(msg);

    if (
      cfg.antilink &&
      linksRegex.test(texto) &&
      !admin
    ) {

      try {
        await sock.sendMessage(
          jid,
          {
            delete: msg.key
          }
        );
      } catch {}

      if (cfg.antilinkhard) {

        try {
          await sock.groupParticipantsUpdate(
            jid,
            [remetente],
            "remove"
          );
        } catch {}
      }

      return;
    }

    const bloqueado =
      (tipo === "foto" && cfg.antifoto) ||
      (tipo === "video" && cfg.antivideo) ||
      (tipo === "audio" && cfg.antiaudio) ||
      (tipo === "sticker" && cfg.antisticker) ||
      (tipo === "documento" && cfg.antidocumento);

    if (
      bloqueado &&
      !admin
    ) {

      try {
        await sock.sendMessage(
          jid,
          {
            delete: msg.key
          }
        );
      } catch {}

      return;
    }

    if (
      palavroes.some(
        p => lower.includes(p)
      ) &&
      !admin
    ) {

      try {
        await sock.sendMessage(
          jid,
          {
            delete: msg.key
          }
        );
      } catch {}

      return;
    }

    if (
      !texto.startsWith(PREFIXO)
    ) {

      await processarNano(
        sock,
        jid,
        texto
      );

      return;
    }
  }

  // ========================================
  // 🔧 COMANDO
  // ========================================

  const partes =
    texto.split(/\s+/);

  const comando =
    partes[0]
      .toLowerCase();

  const args =
    partes.slice(1);

  const argTexto =
    args.join(" ");

  const admin =
    grupo
      ? await ehAdmin(
          sock,
          jid,
          remetente
        )
      : ehDono(remetente);

  // ========================================
  // 📜 MENU
  // ========================================

  if (comando === ".menu") {

    await sock.sendMessage(jid, {
      text:
        admin
          ? menuAdmin()
          : `
👑 *⚡ BOT AUTOMÁTICO003 ⚡*

📋 *.tabela*
💳 *.pagamento*
🛒 *.compra [pacote] [número]*
🎁 *.pontos*
🎉 *.resgatar [pontos]*
🧾 *.compras*
🏓 *.ping*
🕒 *.horas*

━━━━━━━━━━━━━━━━━━
🤖 *BOT AUTOMÁTICO*
`
    });

    return;
  }

  // ========================================
  // 📋 TABELA
  // ========================================

  if (
    comando === ".tabela" ||
    lower === "tabela"
  ) {

    await sock.sendMessage(jid, {
      text: gerarTabela()
    });

    return;
  }

  // ========================================
  // 💳 PAGAMENTO
  // ========================================

  if (
    comando === ".pagamento" ||
    lower === "pagamento"
  ) {

    await sock.sendMessage(jid, {
      text: gerarPagamento()
    });

    return;
  }

  // ========================================
  // 🛒 COMPRA
  // ========================================

  if (comando === ".compra") {

    if (!args[0]) {

      await sock.sendMessage(jid, {
        text:
          "🛒 *COMPRAR*\n\n" +
          gerarTabela() +
          "\nExemplo:\n.compra 810MB 858612623"
      });

      return;
    }

    const produto =
      procurarPacote(args[0]);

    if (!produto) {

      await sock.sendMessage(jid, {
        text:
          "❌ Pacote não encontrado.\n\n" +
          gerarTabela()
      });

      return;
    }

    const numero =
      args[1] ||
      jidNumero(remetente);

    await iniciarCompra(
      sock,
      jid,
      args[0],
      numero
    );

    return;
  }

  // ========================================
  // 🏓 PING
  // ========================================

  if (comando === ".ping") {

    await sock.sendMessage(jid, {
      text: "🏓 *PONG!*\n\n🤖 Bot online."
    });

    return;
  }

  // ========================================
  // 🕒 HORAS
  // ========================================

  if (comando === ".horas") {

    await sock.sendMessage(jid, {
      text:
        "🕒 Hora atual: " +
        new Date().toLocaleString(
          "pt-MZ",
          {
            timeZone:
              "Africa/Maputo"
          }
        )
    });

    return;
  }

  // ========================================
  // 👑 DONO
  // ========================================

  if (comando === ".dono") {

    await sock.sendMessage(jid, {
      text:
        `👑 *DONO DO BOT*\n\n📱 ${jidNumero(DONO)}`
    });

    return;
  }

  // ========================================
  // 🎁 PONTOS
  // ========================================

  if (comando === ".pontos") {

    const cliente =
      salvarCliente(remetente);

    await sock.sendMessage(jid, {
      text: `
🎁 *SEUS PONTOS*

⭐ Pontos: *${cliente.pontos}*
🛒 Compras: *${cliente.compras}*
💰 Total gasto: *${formatarMT(cliente.totalGasto)}*
📦 MB comprados: *${cliente.mbComprados} MB*
`
    });

    salvarBanco();

    return;
  }

  // ========================================
  // 🎉 RESGATAR
  // ========================================

  if (comando === ".resgatar") {

    const pontos =
      Number(args[0]);

    const cliente =
      salvarCliente(remetente);

    if (
      !pontos ||
      pontos <= 0
    ) {

      await sock.sendMessage(jid, {
        text:
          "❌ Informe a quantidade de pontos.\n\nExemplo: .resgatar 10"
      });

      return;
    }

    if (
      cliente.pontos < pontos
    ) {

      await sock.sendMessage(jid, {
        text:
          `❌ Você tem apenas ${cliente.pontos} pontos.`
      });

      return;
    }

    cliente.pontos -= pontos;

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🎉 *RESGATE REGISTRADO!*\n\n⭐ Pontos usados: ${pontos}\n⭐ Pontos restantes: ${cliente.pontos}`
    });

    return;
  }

  // ========================================
  // 🧾 COMPRAS PESSOAIS
  // ========================================

  if (comando === ".compras") {

    if (
      admin &&
      args[0]
    ) {

      const alvo =
        jidNumero(args[0]);

      const compras =
        banco.compras.filter(
          c =>
            jidNumero(c.jid) === alvo
        );

      let resposta =
        `📦 *COMPRAS DE ${alvo}*\n\n`;

      compras.forEach(c => {

        resposta +=
          `🆔 ${c.id}\n` +
          `📦 ${c.pacote}\n` +
          `💰 ${formatarMT(c.valor)}\n` +
          `📱 ${c.numero}\n` +
          `📌 ${c.status}\n\n`;
      });

      await sock.sendMessage(jid, {
        text:
          compras.length
            ? resposta
            : "❌ Nenhuma compra."
      });

      return;
    }

    const compras =
      banco.compras.filter(
        c =>
          c.jid === remetente
      );

    let resposta =
      "🧾 *MEU HISTÓRICO*\n\n";

    compras.slice(-20).forEach(c => {

      resposta +=
        `🆔 ${c.id}\n` +
        `📦 ${c.pacote}\n` +
        `💰 ${formatarMT(c.valor)}\n` +
        `📌 ${c.status}\n\n`;
    });

    await sock.sendMessage(jid, {
      text:
        compras.length
          ? resposta
          : "📭 Você ainda não possui compras."
    });

    return;
  }

  // ========================================
  // 🔒 RESTANTE = ADMIN
  // ========================================

  if (
    [
      ".ban",
      ".kick",
      ".add",
      ".promover",
      ".rebaixar",
      ".mute",
      ".unmute",
      ".abrir",
      ".fechar",
      ".abrirhorario",
      ".fecharhorario",
      ".boasvindas",
      ".nanobemvindo",
      ".delete",
      ".limpar",
      ".nano",
      ".nanoadd",
      ".nanodel",
      ".nanolist",
      ".limparnanos",
      ".antilink",
      ".antilinkhard",
      ".antifoto",
      ".antivideo",
      ".antiaudio",
      ".antisticker",
      ".antidocumento",
      ".antiflood",
      ".aprovar",
      ".recusar",
      ".clientes",
      ".relatorio",
      ".addmpesa",
      ".addemola",
      ".detector",
      ".antiburlador",
      ".estornar",
      ".status",
      ".manutencao",
      ".caixa",
      ".contas",
      ".filasilenciosa",
      ".config",
      ".editarconfig",
      ".removerconfig",
      ".fila",
      ".limparfila",
      ".novasessao",
      ".brinde",
      ".sessoes",
      ".renovarsessao",
      ".encerrarsessao",
      ".cancelarsessao",
      ".addprecobot",
      ".precosbot",
      ".aluguelbot",
      ".setwebhookgrupo",
      ".verwebhookgrupo",
      ".removerwebhookgrupo",
      ".addstock",
      ".stock",
      ".lucro",
      ".resetstock",
      ".alugar",
      ".alugarc",
      ".ativar",
      ".anular",
      ".alugueis"
    ].includes(comando)
    &&
    !admin
  ) {

    await sock.sendMessage(jid, {
      text:
        "⛔ *ACESSO NEGADO*\n\nApenas administradores podem usar este comando."
    });

    return;
  }

  // ========================================
  // 👢 KICK / BAN
  // ========================================

  if (
    comando === ".kick" ||
    comando === ".ban"
  ) {

    const alvo =
      obterAlvo(msg);

    if (!alvo) {

      await sock.sendMessage(jid, {
        text:
          `❌ Marque o usuário.\nExemplo: ${comando} @user`
      });

      return;
    }

    await sock.groupParticipantsUpdate(
      jid,
      [alvo],
      "remove"
    );

    await sock.sendMessage(jid, {
      text:
        `👢 ${mencionar(alvo)} removido.`,
      mentions: [alvo]
    });

    return;
  }

  // ========================================
  // ➕ ADD
  // ========================================

  if (comando === ".add") {

    const numero =
      normalizarNumero(args[0]);

    if (!numero) {

      await sock.sendMessage(jid, {
        text:
          "❌ Exemplo: .add 258841234567"
      });

      return;
    }

    await sock.groupParticipantsUpdate(
      jid,
      [`${numero}@s.whatsapp.net`],
      "add"
    );

    await sock.sendMessage(jid, {
      text:
        `➕ Número adicionado: ${numero}`
    });

    return;
  }

  // ========================================
  // ⬆️ PROMOVER
  // ========================================

  if (comando === ".promover") {

    const alvo =
      obterAlvo(msg);

    if (!alvo) return;

    await sock.groupParticipantsUpdate(
      jid,
      [alvo],
      "promote"
    );

    await sock.sendMessage(jid, {
      text:
        `⬆️ ${mencionar(alvo)} promovido.`,
      mentions: [alvo]
    });

    return;
  }

  // ========================================
  // ⬇️ REBAIXAR
  // ========================================

  if (comando === ".rebaixar") {

    const alvo =
      obterAlvo(msg);

    if (!alvo) return;

    await sock.groupParticipantsUpdate(
      jid,
      [alvo],
      "demote"
    );

    await sock.sendMessage(jid, {
      text:
        `⬇️ ${mencionar(alvo)} rebaixado.`,
      mentions: [alvo]
    });

    return;
  }

  // ========================================
  // 🔓 ABRIR / FECHAR
  // ========================================

  if (comando === ".abrir") {

    await sock.groupSettingUpdate(
      jid,
      "not_announcement"
    );

    await sock.sendMessage(jid, {
      text: "🔓 *GRUPO ABERTO*"
    });

    return;
  }

  if (comando === ".fechar") {

    await sock.groupSettingUpdate(
      jid,
      "announcement"
    );

    await sock.sendMessage(jid, {
      text: "🔒 *GRUPO FECHADO*"
    });

    return;
  }

  // ========================================
  // 👋 BOAS-VINDAS
  // ========================================

  if (comando === ".boasvindas") {

    const valor =
      args[0]?.toLowerCase();

    banco.grupos[jid] ||= {};

    banco.grupos[jid].boasvindas =
      valor === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `👋 Boas-vindas: *${valor === "on" ? "ATIVADAS" : "DESATIVADAS"}*`
    });

    return;
  }

  // ========================================
  // 🤖 NANO ON/OFF
  // ========================================

  if (comando === ".nano") {

    const valor =
      args[0]?.toLowerCase();

    banco.grupos[jid] ||= {};

    banco.grupos[jid].nano =
      valor === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🤖 Nano: *${valor === "on" ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // ➕ NANOADD
  // ========================================

  if (comando === ".nanoadd") {

    const partesNano =
      argTexto.split(",");

    if (partesNano.length < 2) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use:\n.nanoadd gatilho, resposta"
      });

      return;
    }

    const gatilho =
      partesNano.shift()
        .trim()
        .toLowerCase();

    const resposta =
      partesNano.join(",").trim();

    banco.nanos[jid] ||= {};

    banco.nanos[jid][gatilho] =
      resposta;

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `✅ Nano adicionado:\n\n🔹 ${gatilho}\n🔹 ${resposta}`
    });

    return;
  }

  // ========================================
  // ➖ NANO DEL
  // ========================================

  if (comando === ".nanodel") {

    const gatilho =
      args.join(" ")
        .toLowerCase();

    if (
      banco.nanos[jid] &&
      banco.nanos[jid][gatilho]
    ) {

      delete banco.nanos[jid][gatilho];

      salvarBanco();

      await sock.sendMessage(jid, {
        text:
          `🗑️ Nano removido: ${gatilho}`
      });

    } else {

      await sock.sendMessage(jid, {
        text:
          "❌ Nano não encontrado."
      });
    }

    return;
  }

  // ========================================
  // 📋 NANO LIST
  // ========================================

  if (comando === ".nanolist") {

    const nanos =
      banco.nanos[jid] || {};

    let resposta =
      "📋 *NANOS*\n\n";

    for (
      const [gatilho, resp]
      of Object.entries(nanos)
    ) {

      resposta +=
        `🔹 ${gatilho} → ${resp}\n`;
    }

    await sock.sendMessage(jid, {
      text:
        resposta === "📋 *NANOS*\n\n"
          ? resposta + "Nenhum nano."
          : resposta
    });

    return;
  }

  // ========================================
  // 🧹 LIMPAR NANOS
  // ========================================

  if (comando === ".limparnanos") {

    banco.nanos[jid] = {};

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "🧹 Todos os nanos foram apagados."
    });

    return;
  }

  // ========================================
  // 🛡️ PROTEÇÕES
  // ========================================

  const protecoes = {
    ".antilink": "antilink",
    ".antilinkhard": "antilinkhard",
    ".antifoto": "antifoto",
    ".antivideo": "antivideo",
    ".antiaudio": "antiaudio",
    ".antisticker": "antisticker",
    ".antidocumento": "antidocumento",
    ".antiflood": "antiflood"
  };

  if (protecoes[comando]) {

    const valor =
      args[0]?.toLowerCase();

    banco.grupos[jid] ||= {};

    banco.grupos[jid][
      protecoes[comando]
    ] = valor === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🛡️ ${protecoes[comando]}: *${valor === "on" ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 🛒 APROVAR
  // ========================================

  if (comando === ".aprovar") {

    if (!args[0]) {

      await sock.sendMessage(jid, {
        text:
          "❌ Exemplo: .aprovar CMPABC123"
      });

      return;
    }

    await aprovarCompra(
      sock,
      jid,
      args[0]
    );

    return;
  }

  // ========================================
  // ❌ RECUSAR
  // ========================================

  if (comando === ".recusar") {

    const compra =
      banco.compras.find(
        c => c.id === args[0]
      );

    if (!compra) {

      await sock.sendMessage(jid, {
        text: "❌ Compra não encontrada."
      });

      return;
    }

    compra.status = "RECUSADA";

    banco.fila =
      banco.fila.filter(
        f => f.id !== compra.id
      );

    salvarBanco();

    await sock.sendMessage(
      compra.jid,
      {
        text:
          `❌ *COMPRA RECUSADA*\n\n🆔 ${compra.id}\n📦 ${compra.pacote}\n\nEntre em contacto com o administrador.`
      }
    );

    await sock.sendMessage(jid, {
      text:
        "✅ Compra recusada."
    });

    return;
  }

  // ========================================
  // 👥 CLIENTES
  // ========================================

  if (comando === ".clientes") {

    let texto =
      "👥 *CLIENTES*\n\n";

    const clientes =
      Object.entries(
        banco.clientes
      );

    clientes.forEach(
      ([numero, c], i) => {

        texto +=
          `${i + 1}. ${numero}\n` +
          `🛒 ${c.compras}\n` +
          `💰 ${formatarMT(c.totalGasto)}\n` +
          `⭐ ${c.pontos} pts\n\n`;
      }
    );

    await sock.sendMessage(jid, {
      text:
        clientes.length
          ? texto
          : "👥 Nenhum cliente."
    });

    return;
  }

  // ========================================
  // 📊 RELATÓRIO
  // ========================================

  if (comando === ".relatorio") {

    await sock.sendMessage(jid, {
      text:
        gerarRelatorio()
    });

    return;
  }

  // ========================================
  // 💳 ADD MPESA
  // ========================================

  if (comando === ".addmpesa") {

    const numero =
      normalizarNumero(args[0]);

    const nome =
      args.slice(1).join(" ");

    if (!numero || !nome) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use: .addmpesa número nome"
      });

      return;
    }

    banco.pagamentos.mpesa.push({
      numero,
      nome
    });

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `✅ M-PESA adicionado:\n${nome} - ${numero}`
    });

    return;
  }

  // ========================================
  // 💳 ADD EMOLA
  // ========================================

  if (comando === ".addemola") {

    const numero =
      normalizarNumero(args[0]);

    const nome =
      args.slice(1).join(" ");

    if (!numero || !nome) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use: .addemola número nome"
      });

      return;
    }

    banco.pagamentos.emola.push({
      numero,
      nome
    });

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `✅ E-MOLA adicionado:\n${nome} - ${numero}`
    });

    return;
  }

  // ========================================
  // 💳 CONTAS
  // ========================================

  if (comando === ".contas") {

    await sock.sendMessage(jid, {
      text:
        gerarPagamento()
    });

    return;
  }

  // ========================================
  // ⚙️ STATUS
  // ========================================

  if (comando === ".status") {

    await sock.sendMessage(jid, {
      text:
        gerarStatus()
    });

    return;
  }

  // ========================================
  // 🛠️ MANUTENÇÃO
  // ========================================

  if (comando === ".manutencao") {

    banco.config.manutencao =
      args[0]?.toLowerCase() === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🛠️ Manutenção: *${banco.config.manutencao ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 🔎 DETECTOR
  // ========================================

  if (comando === ".detector") {

    banco.config.detector =
      args[0]?.toLowerCase() === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🔎 Detector: *${banco.config.detector ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 🕵️ ANTIBURLADOR
  // ========================================

  if (comando === ".antiburlador") {

    banco.config.antiburlador =
      args[0]?.toLowerCase() === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🕵️ Antiburlador: *${banco.config.antiburlador ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 🔕 FILA SILENCIOSA
  // ========================================

  if (comando === ".filasilenciosa") {

    banco.config.filaSilenciosa =
      args[0]?.toLowerCase() === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🔕 Fila silenciosa: *${banco.config.filaSilenciosa ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 📋 FILA
  // ========================================

  if (comando === ".fila") {

    let resposta =
      "📋 *FILA DE TRANSFERÊNCIAS*\n\n";

    banco.fila.forEach(
      (f, i) => {

        resposta +=
          `${i + 1}. ${f.id}\n` +
          `📦 ${f.pacote}\n` +
          `📱 ${f.numero}\n` +
          `📌 ${f.status}\n\n`;
      }
    );

    await sock.sendMessage(jid, {
      text:
        banco.fila.length
          ? resposta
          : "📭 Fila vazia."
    });

    return;
  }

  // ========================================
  // 🧹 LIMPAR FILA
  // ========================================

  if (comando === ".limparfila") {

    if (args[0] === "tudo") {

      banco.fila = [];

    } else {

      banco.fila =
        banco.fila.filter(
          f =>
            f.numero !==
            normalizarNumero(args[0])
        );
    }

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "🧹 Fila atualizada."
    });

    return;
  }

  // ========================================
  // ⚙️ CONFIG
  // ========================================

  if (comando === ".config") {

    let resposta =
      "⚙️ *CONFIGURAÇÃO ATUAL*\n\n";

    for (
      const [pacote, preco]
      of Object.entries(banco.tabela)
    ) {

      resposta +=
        `📦 ${pacote} → ${preco} MT\n`;
    }

    resposta +=
      "\n✏️ Para editar:\n.editarconfig 810MB - 20";

    await sock.sendMessage(jid, {
      text: resposta
    });

    return;
  }

  // ========================================
  // ✏️ EDITAR CONFIG
  // ========================================

  if (comando === ".editarconfig") {

    const entrada =
      argTexto.split("-");

    if (entrada.length < 2) {

      await sock.sendMessage(jid, {
        text:
          "❌ Exemplo:\n.editarconfig 810MB - 20"
      });

      return;
    }

    const pacote =
      entrada[0].trim();

    const preco =
      Number(entrada[1].trim());

    if (!preco) {

      await sock.sendMessage(jid, {
        text:
          "❌ Preço inválido."
      });

      return;
    }

    banco.tabela[pacote] =
      preco;

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `✅ Tabela atualizada:\n\n📦 ${pacote}\n💰 ${preco} MT`
    });

    return;
  }

  // ========================================
  // 🗑️ REMOVER CONFIG
  // ========================================

  if (comando === ".removerconfig") {

    const pacote =
      args[0];

    if (
      !pacote ||
      !banco.tabela[pacote]
    ) {

      await sock.sendMessage(jid, {
        text:
          "❌ Pacote não encontrado."
      });

      return;
    }

    delete banco.tabela[pacote];

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🗑️ ${pacote} removido da tabela.`
    });

    return;
  }

  // ========================================
  // 📦 STOCK
  // ========================================

  if (comando === ".addstock") {

    const quantidade =
      Number(args[0]);

    const custo =
      Number(args[1]);

    const descricao =
      args.slice(2).join(" ");

    if (
      !quantidade ||
      !custo ||
      !descricao
    ) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use:\n.addstock quantidade custo descrição"
      });

      return;
    }

    banco.stock.push({
      quantidade,
      custo,
      descricao,
      data:
        new Date().toISOString()
    });

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "✅ Stock adicionado."
    });

    return;
  }

  if (comando === ".stock") {

    await sock.sendMessage(jid, {
      text:
        gerarStock()
    });

    return;
  }

  // ========================================
  // 💰 LUCRO
  // ========================================

  if (comando === ".lucro") {

    await sock.sendMessage(jid, {
      text:
        gerarLucro()
    });

    return;
  }

  // ========================================
  // 🧹 RESET STOCK
  // ========================================

  if (comando === ".resetstock") {

    banco.stock = [];

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "🧹 Stock apagado."
    });

    return;
  }

  // ========================================
  // 🔗 WEBHOOK GRUPO
  // ========================================

  if (comando === ".setwebhookgrupo") {

    if (!ehGrupo(jid)) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use este comando dentro do grupo."
      });

      return;
    }

    banco.grupos[jid] ||= {};

    banco.grupos[jid].webhook =
      args[0];

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "🔗 Webhook deste grupo configurado."
    });

    return;
  }

  if (comando === ".verwebhookgrupo") {

    const webhook =
      banco.grupos[jid]?.webhook;

    await sock.sendMessage(jid, {
      text:
        webhook
          ? `🔗 ${webhook}`
          : "❌ Nenhum webhook configurado."
    });

    return;
  }

  if (comando === ".removerwebhookgrupo") {

    if (banco.grupos[jid]) {
      delete banco.grupos[jid].webhook;
    }

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        "❌ Webhook removido."
    });

    return;
  }

  // ========================================
  // 🆔 ID / JID
  // ========================================

  if (
    comando === ".id" ||
    comando === ".jid" ||
    comando === ".meujid"
  ) {

    await sock.sendMessage(jid, {
      text:
        `🆔 *ID/JID*\n\n${remetente}`
    });

    return;
  }

  // ========================================
  // 💵 CAIXA
  // ========================================

  if (comando === ".caixa") {

    const hoje =
      new Date().toISOString()
        .slice(0, 10);

    const comprasHoje =
      banco.compras.filter(
        c =>
          c.status === "CONCLUIDA" &&
          c.criadoEm?.startsWith(hoje)
      );

    const valor =
      comprasHoje.reduce(
        (s, c) =>
          s + Number(c.valor),
        0
      );

    await sock.sendMessage(jid, {
      text:
        `
💵 *CAIXA DO DIA*

📅 ${hoje}

🛒 Compras:
${comprasHoje.length}

💰 Total:
${formatarMT(valor)}
`
    });

    return;
  }

  // ========================================
  // 💲 PREÇOS BOT
  // ========================================

  if (comando === ".addprecobot") {

    const dias =
      Number(args[0]);

    const preco =
      Number(args[1]);

    if (!dias || !preco) {

      await sock.sendMessage(jid, {
        text:
          "❌ Use: .addprecobot dias preço"
      });

      return;
    }

    banco.precosBot[dias] =
      preco;

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `✅ ${dias} dias → ${preco} MT`
    });

    return;
  }

  if (comando === ".precosbot") {

    let resposta =
      "💲 *PREÇOS DO BOT*\n\n";

    for (
      const [dias, preco]
      of Object.entries(
        banco.precosBot
      )
    ) {

      resposta +=
        `📅 ${dias} dias → ${preco} MT\n`;
    }

    await sock.sendMessage(jid, {
      text: resposta
    });

    return;
  }

  if (comando === ".aluguelbot") {

    banco.config.aluguelBot =
      args[0]?.toLowerCase() === "on";

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🔛 Aluguel do bot: *${banco.config.aluguelBot ? "ON" : "OFF"}*`
    });

    return;
  }

  // ========================================
  // 🔌 SESSÕES
  // ========================================

  if (comando === ".novasessao") {

    const numero =
      normalizarNumero(args[0]);

    const modo =
      args[1]?.toLowerCase() ===
      "pairing"
        ? "pairing"
        : "qr";

    if (!numero) {

      await sock.sendMessage(jid, {
        text:
          "❌ Exemplo:\n.novasessao 258841234567 qr"
      });

      return;
    }

    await sock.sendMessage(jid, {
      text:
        `🆕 Criando sessão para ${numero}...\n\n📱 O ${modo === "qr" ? "QR aparecerá no Termux" : "código de pareamento aparecerá no Termux"}.`
    });

    await iniciarSessao(
      numero,
      modo
    );

    return;
  }

  if (comando === ".sessoes") {

    let resposta =
      "📋 *SESSÕES*\n\n";

    for (
      const [numero, sessao]
      of Object.entries(
        banco.sessoes
      )
    ) {

      resposta +=
        `📱 ${numero}\n` +
        `🟢 ${sessao.ativa ? "ATIVA" : "INATIVA"}\n\n`;
    }

    await sock.sendMessage(jid, {
      text:
        resposta
    });

    return;
  }

  if (comando === ".encerrarsessao") {

    const numero =
      normalizarNumero(args[0]);

    const sessao =
      sessoesAtivas[numero];

    if (sessao) {

      try {
        await sessao.logout();
      } catch {}

      delete sessoesAtivas[numero];

    }

    if (banco.sessoes[numero]) {
      banco.sessoes[numero].ativa = false;
    }

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `🔌 Sessão ${numero} encerrada.`
    });

    return;
  }

  // ========================================
  // 📅 ALUGUEL
  // ========================================

  if (comando === ".alugueis") {

    let resposta =
      "📋 *ALUGUÉIS*\n\n";

    for (
      const [id, aluguel]
      of Object.entries(
        banco.alugueis
      )
    ) {

      resposta +=
        `🆔 ${id}\n` +
        `👥 ${aluguel.grupo || "-"}\n` +
        `📅 ${aluguel.dias} dias\n` +
        `⏳ ${aluguel.expiraEm}\n\n`;
    }

    await sock.sendMessage(jid, {
      text:
        resposta
    });

    return;
  }

  // ========================================
  // 🎟️ ALUGAR CÓDIGO
  // ========================================

  if (comando === ".alugarc") {

    const dias =
      Number(args[0]);

    if (!dias) {

      await sock.sendMessage(jid, {
        text:
          "❌ Exemplo: .alugarc 30"
      });

      return;
    }

    const codigo =
      "BOT-" +
      Math.random()
        .toString(36)
        .substring(2, 10)
        .toUpperCase();

    banco.alugueis[codigo] = {
      codigo,
      dias,
      ativado: false,
      criadoEm:
        new Date().toISOString()
    };

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `
🎟️ *CÓDIGO GERADO*

🔑 ${codigo}
📅 ${dias} dias

Envie ao administrador do grupo.
`
    });

    return;
  }

  // ========================================
  // ✅ ATIVAR
  // ========================================

  if (comando === ".ativar") {

    const codigo =
      args[0];

    const aluguel =
      banco.alugueis[codigo];

    if (!aluguel) {

      await sock.sendMessage(jid, {
        text:
          "❌ Código inválido."
      });

      return;
    }

    aluguel.ativado = true;
    aluguel.grupo = jid;
    aluguel.ativadoEm =
      new Date().toISOString();

    const data =
      new Date();

    data.setDate(
      data.getDate() +
      Number(aluguel.dias)
    );

    aluguel.expiraEm =
      data.toISOString();

    salvarBanco();

    await sock.sendMessage(jid, {
      text:
        `
✅ *BOT ATIVADO*

🎟️ Código: ${codigo}
📅 Duração: ${aluguel.dias} dias
⏳ Expira: ${aluguel.expiraEm}
`
    });

    return;
  }

  // ========================================
  // ❌ ANULAR
  // ========================================

  if (comando === ".anular") {

    const ultimo =
      Object.keys(
        banco.alugueis
      ).pop();

    if (ultimo) {

      delete banco.alugueis[
        ultimo
      ];

      salvarBanco();
    }

    await sock.sendMessage(jid, {
      text:
        "❌ Aluguel anulado."
    });

    return;
  }

  // ========================================
  // 🗑️ DELETE
  // ========================================

  if (comando === ".delete") {

    if (
      msg.message?.extendedTextMessage
        ?.contextInfo?.stanzaId
    ) {

      const citado =
        msg.message.extendedTextMessage
          .contextInfo;

      await sock.sendMessage(jid, {
        delete: {
          remoteJid: jid,
          fromMe: false,
          id: citado.stanzaId,
          participant:
            citado.participant
        }
      });

      return;
    }

    await sock.sendMessage(jid, {
      text:
        "❌ Responda à mensagem que deseja apagar."
    });

    return;
  }

  // ========================================
  // 🧹 LIMPAR
  // ========================================

  if (comando === ".limpar") {

    await sock.sendMessage(jid, {
      text:
        "🧹 Use .delete respondendo às mensagens que deseja apagar."
    });

    return;
  }

  // ========================================
  // 🎵 MÚSICA
  // ========================================

  if (comando === ".musica") {

    if (!argTexto) {

      await sock.sendMessage(jid, {
        text:
          "🎵 Exemplo: .musica nome da música"
      });

      return;
    }

    const pesquisa =
      encodeURIComponent(
        argTexto
      );

    await sock.sendMessage(jid, {
      text:
        `🎵 *PESQUISA MUSICAL*\n\n🔎 ${argTexto}\n\nhttps://www.youtube.com/results?search_query=${pesquisa}`
    });

    return;
  }

}

// ============================================================
// 🚀 CONEXÃO PRINCIPAL
// ============================================================

async function iniciarBot() {

  const {
    state,
    saveCreds
  } = await useMultiFileAuthState(
    AUTH_DIR
  );

  const {
    version
  } = await fetchLatestBaileysVersion();

  const sock =
    makeWASocket({

      version,

      auth: state,

      logger: pino({
        level: "silent"
      }),

      markOnlineOnConnect: false,

      generateHighQualityLinkPreview: false
    });

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  sock.ev.on(
    "connection.update",
    async update => {

      const {
        connection,
        lastDisconnect,
        qr
      } = update;

      if (qr) {

        console.log(
          "\n📱 ESCANEIE ESTE QR CODE NO WHATSAPP:\n"
        );

        qrcode.generate(
          qr,
          {
            small: true
          }
        );
      }

      if (connection === "open") {

        console.log(
          "\n================================"
        );

        console.log(
          "🤖 BOT AUTOMÁTICO003 ONLINE"
        );

        console.log(
          "🛒 Sistema de vendas: ONLINE"
        );

        console.log(
          "📊 Banco: ONLINE"
        );

        console.log(
          "🔗 MacroDroid: PRONTO"
        );

        console.log(
          "================================\n"
        );
      }

      if (connection === "close") {

        const codigo =
          new Boom(
            lastDisconnect?.error
          )?.output?.statusCode;

        console.log(
          "Conexão fechada:",
          codigo
        );

        if (
          codigo !==
          DisconnectReason.loggedOut
        ) {

          console.log(
            "🔄 Reconectando..."
          );

          setTimeout(
            iniciarBot,
            3000
          );
        } else {

          console.log(
            "❌ Sessão desconectada."
          );
        }
      }
    }
  );

  sock.ev.on(
    "messages.upsert",
    async ({ messages }) => {

      for (const msg of messages) {

        try {

          await processarMensagem(
            sock,
            msg
          );

        } catch (erro) {

          console.log(
            "Erro processando mensagem:",
            erro
          );
        }
      }
    }
  );

  return sock;
}

// ============================================================
// ▶️ START
// ============================================================

process.on(
  "uncaughtException",
  erro => {
    console.log(
      "Erro:",
      erro.message
    );
  }
);

process.on(
  "unhandledRejection",
  erro => {
    console.log(
      "Promise:",
      erro
    );
  }
);

iniciarBot();
