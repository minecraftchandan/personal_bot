const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  SlashCommandBuilder,
  ChannelType,
  TextChannel
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const Fuse = require('fuse.js');
const { findImageMessage, extractImageUrl } = require('../utils/findImageMessage');

const configPath = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// --- OCR Function ---
async function extractTextFromImage(imageUrl) {
  try {
    const { data: { text } } = await Tesseract.recognize(imageUrl, 'eng');
    return text.split('\n').map(t => t.trim()).filter(Boolean);
  } catch (err) {
    console.error("OCR error:", err);
    return [];
  }
}

// --- Fuzzy Match Function ---
function fuzzyMatchCardName(cardName, ocrText) {
  const fuse = new Fuse(ocrText, {
    includeScore: true,
    threshold: 0.4
  });

  const result = fuse.search(cardName);
  if (result.length > 0) {
    return result[0].item;
  }
  return null;
}

module.exports = (client) => {
  let configData = loadConfig();

  client.once('ready', async () => {
    if (!client.application?.commands) return;

    await client.application.commands.create(
      new SlashCommandBuilder()
        .setName('setchannel')
        .setDescription('Set the target channel by ID')
        .addStringOption(option =>
          option
            .setName('channelid')
            .setDescription('The channel ID to send alerts to')
            .setRequired(true)
        )
        .toJSON()
    );
    console.log('✅ /setchannel slash command registered.');
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'setchannel') return;

    const channelId = interaction.options.getString('channelid');
    const guildId = interaction.guildId;

    if (!guildId) return await interaction.reply('❌ Use this command inside a server.');

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.type !== ChannelType.GuildText) {
      return await interaction.reply('❌ Invalid text channel.');
    }

    if (!configData[guildId]) configData[guildId] = {};
    configData[guildId].targetChannelId = channelId;
    saveConfig(configData);

    await interaction.reply(`✅ Target channel set to <#${channelId}>`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.id !== '742070928111960155') return;
    const guildId = message.guildId;
    if (!guildId || !configData[guildId]?.targetChannelId) return;

    if (
      message.content.includes('<:noriclock:') &&
      (message.content.includes('You can now **grab**!') || message.content.includes('You can now **drop**!'))
    ) return;

    const lines = message.content.split('\n');
    if (lines.some(line => line.trim().startsWith('0]'))) return;

    for (const line of lines) {
      if (!/^`?[123]\]/.test(line.trim())) continue;

      const heartMatch = line.match(/:heart:\s+`(\d+)\s*`/);
      const gidMatch = line.match(/`ɢ\s*(\d+)\s*`/);
      const nameMatch = line.match(/] (.+?) :heart:/); // extract card name before :heart:

      const hearts = heartMatch ? parseInt(heartMatch[1]) : 0;
      const gid = gidMatch ? parseInt(gidMatch[1]) : null;
      const cardName = nameMatch ? nameMatch[1].trim() : null;

      if (hearts > 99 || (gid !== null && gid < 100)) {
        await handlePog(message, configData[guildId].targetChannelId, cardName);
        return;
      }
    }
  });

  async function handlePog(message, targetChannelId, cardName) {
    if (message.channel.isTextBased()) {
      await message.channel.send(`🎉 ${message.author} Check it out in <#${targetChannelId}>`);
    }

    // Search previous messages for images
    let foundAttachment = null;
    let mentionedUser = null;

    let beforeId = message.id;
    while (!foundAttachment) {
      const fetched = await message.channel.messages.fetch({ limit: 10, before: beforeId });
      if (!fetched.size) break;

      for (const msg of fetched.values()) {
        const imageUrl = extractImageUrl(msg);
        if (!imageUrl) continue;

        const ocrLines = await extractTextFromImage(imageUrl);
        const match = cardName ? fuzzyMatchCardName(cardName, ocrLines) : null;

        if (match) {
          foundAttachment = { imageUrl, msg };
          mentionedUser = msg.mentions.users.first();
          break;
        }
      }

      beforeId = fetched.last().id; // continue scanning upwards
    }

    if (!foundAttachment) {
      console.log("❌ No matching card image found.");
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('<a:AnimeGirljumping:1365978464435441675>𝑷𝑶𝑮𝑮𝑬𝑹𝑺<a:brown_jump:1365979505977458708>')
      .setDescription(`${mentionedUser ? `<@${mentionedUser.id}>` : 'Unknown'} triggered a POG!\n\n${message.content}`)
      .setColor(0x87CEEB)
      .setImage(foundAttachment.imageUrl)
      .setFooter({ text: `Dropped by: ${mentionedUser?.tag || 'Unknown#0000'}` });

    const button = new ButtonBuilder()
      .setLabel('Jump to Message')
      .setStyle(ButtonStyle.Link)
      .setURL(foundAttachment.msg.url);

    const row = new ActionRowBuilder().addComponents(button);

    const targetChannel = await client.channels.fetch(targetChannelId);
    if (targetChannel?.isTextBased()) {
      await targetChannel.send({ embeds: [embed], components: [row] });
    }
  }
};


