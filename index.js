const { Client, GatewayIntentBits, Partials } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const cron = require("node-cron");
const dotenv = require("dotenv");

dotenv.config();

// Configurando bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// Abrindo ou criando banco
const db = new sqlite3.Database("./db.sqlite", (err) => {
  if (err) return console.error(err.message);
  console.log("Conectado ao banco db.sqlite");
});

// Criando tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    descricao TEXT,
    valor REAL,
    data TEXT
  )
`);

// Canais mapeados
const canais = {
  "🎮gasto-pessoal": "gasto-pessoal",
  "🏦investimentos-empresa": "investimentos-empresa",
  "🏦investimentos-pessoal": "investimentos-pessoal",
  "💸ganhos": "ganhos"
};

// Função para pegar data/hora de Brasília
function dataAtualLocal() {
  return new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour12: false
  });
}

// Captura mensagens do usuário
client.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;
  if (msg.author.id !== process.env.USER_ID) return;

  const tipo = canais[msg.channel.name];
  if (!tipo) return;

  const numeros = msg.content.match(/\d+(\.\d+)?/g);
  if (!numeros) return;

  const valor = parseFloat(numeros[numeros.length - 1]);
  const descricao = msg.content.replace(valor, "").trim();

  db.run(
    `INSERT INTO registros (tipo, descricao, valor, data) VALUES (?, ?, ?, ?)`,
    [tipo, descricao, valor, dataAtualLocal()],
    async (err) => {
      if (err) {
        console.error(err.message);
        await msg.reply("❌ Ocorreu um erro ao registrar o gasto.");
      } else {
        console.log(`Registro inserido: ${tipo} | ${descricao} | R$${valor}`);
        await msg.reply(`✅ Gasto registrado: **${descricao} – R$${valor}**`);
      }
    }
  );
});



// Cron semanal sábado às 10h
cron.schedule("* * * * *", async () => { // Mudar para "* * * * *" só pra teste
  const agora = new Date();
  const seteDiasAtras = new Date();
  seteDiasAtras.setDate(agora.getDate() - 7);

  for (const [nomeCanal, tipo] of Object.entries(canais)) {
    db.all(
      `SELECT valor FROM registros WHERE tipo = ? AND datetime(data) >= datetime(?)`,
      [tipo, seteDiasAtras.toISOString()],
      async (err, rows) => {
        if (err) return console.error(err);
        if (!rows?.length) return; // sem registros

        const total = rows.reduce((s, r) => s + r.valor, 0).toFixed(2);

        const texto = `📊 **Relatório semanal – ${tipo}**
Total: **R$ ${total}**`;

        // Envia para todos os guilds e canais corretos
        client.guilds.cache.forEach(guild => {
          const canal = guild.channels.cache.find(c => c.name === nomeCanal);
          if (canal) canal.send(texto);
        });

        // Envia no privado
        const user = await client.users.fetch(process.env.USER_ID);
        user.send(texto);
      }
    );
  }
});


client.login(process.env.DISCORD_TOKEN);
