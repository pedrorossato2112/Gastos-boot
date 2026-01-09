require('dotenv').config()

const { Client, GatewayIntentBits } = require('discord.js')


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
})

client.once('ready', () => {
    console.log('Bot ligado com sucesso')
})

client.on('messageCreate', message => {
    if (message.author.bot) return

    if (message.content.startsWith('!gasto')) {
        const partes = message.content.split(' ')
        const valor = partes[1]
        const descricao = partes[2]
        const tipo = partes[3]

        message.reply(
            `Gasto registrado:\n💰 R$${valor}\n📌 ${descricao}\n📂 ${tipo}`
        )
    }
})

client.login(process.env.TOKEN)

const http = require('http')

http.createServer((req, res) => {
  res.writeHead(200)
  res.end('Bot online')
}).listen(process.env.PORT || 3000)



