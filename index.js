const { Client, GatewayIntentBits, Partials } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const cron = require("node-cron");
require("dotenv").config();

// Configura cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Cria ou abre banco de dados
const db = new sqlite3.Database("./db.sqlite");

// Cria tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    descricao TEXT,
    valor REAL,
    data TEXT
  )
`);

// Função para data/hora local
function dataAtualLocal() {
  const agora = new Date();
  return agora.toLocaleString("pt-BR", { hour12: false });
}

// Map de canais
const canais = {
  "🎮gasto-pessoal": "gasto-pessoal",
  "🏦investimentos-empresa": "investimentos-empresa",
  "🏦investimentos-pessoal": "investimentos-pessoal",
  "💸ganhos": "ganhos",
};

// Captura mensagens para registrar
client.on("messageCreate", (msg) => {
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
    (err) => {
      if (err) console.error("Erro ao registrar:", err);
      else msg.reply(`✅ Registrado: ${descricao} - R$ ${valor.toFixed(2)}`);
    }
  );
});

// Cron semanal: todo sábado às 10h
cron.schedule("0 10 * * 6", async () => {
  db.all(
    `SELECT tipo, SUM(valor) AS total
     FROM registros
     WHERE date(data) >= date('now','-7 days')
     GROUP BY tipo`,
    [],
    async (err, rows) => {
      if (err) {
        console.error("Erro ao gerar relatório:", err);
        return;
      }

      if (!rows || rows.length === 0) return;

      let texto = "📊 **Relatório Semanal**\n\n";
      rows.forEach((r) => {
        let emoji = "";
        switch (r.tipo) {
          case "gasto-pessoal":
            emoji = "🎮";
            break;
          case "ganhos":
            emoji = "💸";
            break;
          case "investimentos-empresa":
            emoji = "🏦 (Empresa)";
            break;
          case "investimentos-pessoal":
            emoji = "🏦 (Pessoal)";
            break;
        }
        texto += `${emoji} ${r.tipo.replace(/-/g, " ")}: **R$ ${r.total.toFixed(
          2
        )}**\n`;
      });

      // Envia para os canais do Discord
      client.guilds.cache.forEach((guild) => {
        Object.keys(canais).forEach((nomeCanal) => {
          const canal = guild.channels.cache.find((c) => c.name === nomeCanal);
          if (canal) canal.send(texto);
        });
      });

      // Envia direto para você
      const user = await client.users.fetch(process.env.USER_ID);
      if (user) user.send(texto);
    }
  );
});

client.login(process.env.DISCORD_TOKEN);
