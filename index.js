import { Client, GatewayIntentBits, Partials } from "discord.js"
import sqlite3 from "sqlite3"
import cron from "node-cron"
import dotenv from "dotenv"

dotenv.config()

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
})

const db = new sqlite3.Database("./db.sqlite")

db.run(`
  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    descricao TEXT,
    valor REAL,
    data TEXT
  )
`)

const canais = {
  "🎮gasto-pessoal": "gasto-pessoal",
  "🏦investimentos-empresa": "investimentos-empresa",
  "🏦investimentos-pessoal": "investimentos-pessoal",
  "💸ganhos": "ganhos"
}

client.on("messageCreate", msg => {
  if (msg.author.bot) return
  if (msg.author.id !== process.env.USER_ID) return

  const tipo = canais[msg.channel.name]
  if (!tipo) return

  const numeros = msg.content.match(/\d+(\.\d+)?/g)
  if (!numeros) return

  const valor = parseFloat(numeros[numeros.length - 1])
  const descricao = msg.content.replace(valor, "").trim()

  db.run(
    `INSERT INTO registros (tipo, descricao, valor, data) VALUES (?, ?, ?, ?)`,
    [tipo, descricao, valor, new Date().toISOString()]
  )
})

cron.schedule("0 10 * * 6", async () => {
  for (const tipo of Object.values(canais)) {
    db.all(
      `SELECT valor FROM registros WHERE tipo = ? AND date(data) >= date('now','-7 days')`,
      [tipo],
      async (err, rows) => {
        if (!rows?.length) return

        const total = rows.reduce((s, r) => s + r.valor, 0).toFixed(2)

        const texto = `📊 **Relatório semanal – ${tipo}**
Total: **R$ ${total}**`

        const guilds = client.guilds.cache
        guilds.forEach(guild => {
          const canal = guild.channels.cache.find(c => canais[c.name] === tipo)
          if (canal) canal.send(texto)
        })

        const user = await client.users.fetch(process.env.USER_ID)
        user.send(texto)
      }
    )
  }
})

client.login(process.env.DISCORD_TOKEN)
