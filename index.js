const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// 🔃 Load all feature modules from /features
const featuresPath = path.join(__dirname, 'features');
fs.readdirSync(featuresPath).forEach(file => {
  const feature = require(`./features/${file}`);
  if (typeof feature === 'function') feature(client);
});

client.login(TOKEN);
