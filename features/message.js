const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { db } = require('../firebase');

module.exports = async function (client) {
  const prefix = 'm';

  client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(prefix) || message.author.bot) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command !== 'ms') return;

    const allowedUserId = '587709425708695552';
    if (message.author.id !== allowedUserId) {
      return message.reply('🚫 WHALES NOT ALLOWED.');
    }

    const snapshot = await db.collection('contact').orderBy('timestamp', 'desc').get();
    const allMessages = snapshot.docs.map(doc => doc.data());

    let page = 0;
    const perPage = 5;
    const totalPages = Math.ceil(allMessages.length / perPage);

    // ✅ Correct IST formatting using toLocaleString
    function formatIST(timestamp) {
      try {
        const date = typeof timestamp?.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).replace(',', ' |');
      } catch (e) {
        console.error('Timestamp parse error:', e);
        return 'Invalid Timestamp';
      }
    }

    function generateEmbed(page) {
      const start = page * perPage;
      const messages = allMessages.slice(start, start + perPage);
      const embed = new EmbedBuilder()
        .setTitle('📩 Contact Messages')
        .setColor('#5865F2')
        .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

      for (const msg of messages) {
        embed.addFields({
          name: msg.username,
          value: formatIST(msg.timestamp),
          inline: false
        });
      }

      return embed;
    }

    function generateSelectMenu(page) {
      const start = page * perPage;
      const messages = allMessages.slice(start, start + perPage);
      return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`select_user_${page}`)
          .setPlaceholder('Select a user to view full message')
          .addOptions(
            messages.map((msg, i) => ({
              label: msg.username,
              description: formatIST(msg.timestamp),
              value: `${start + i}`
            }))
          )
      );
    }

    function generateButtons() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('first').setLabel('⏮️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('last').setLabel('⏭️').setStyle(ButtonStyle.Secondary)
      );
    }

    function generateBackButton() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('back_to_page').setLabel('🔙 Back').setStyle(ButtonStyle.Primary)
      );
    }

    const sentMsg = await message.reply({
      embeds: [generateEmbed(page)],
      components: [generateSelectMenu(page), generateButtons()]
    });

    const collector = sentMsg.createMessageComponentCollector({ time: 5 * 60_000 });

    collector.on('collect', async i => {
      if (i.user.id !== message.author.id) {
        return i.reply({ content: 'Not for you.', ephemeral: true });
      }

      if (i.customId.startsWith('select_user_')) {
        const index = parseInt(i.values[0], 10);
        const data = allMessages[index];

        await i.update({
          embeds: [
            new EmbedBuilder()
              .setTitle(`📨 Message from ${data.username}`)
              .setDescription(data.message)
              .setColor('Green')
              .setFooter({ text: formatIST(data.timestamp) })
          ],
          components: [generateBackButton()]
        });

      } else if (i.customId === 'back_to_page') {
        await i.update({
          embeds: [generateEmbed(page)],
          components: [generateSelectMenu(page), generateButtons()]
        });

      } else {
        if (i.customId === 'first') page = 0;
        if (i.customId === 'prev' && page > 0) page--;
        if (i.customId === 'next' && page < totalPages - 1) page++;
        if (i.customId === 'last') page = totalPages - 1;

        await i.update({
          embeds: [generateEmbed(page)],
          components: [generateSelectMenu(page), generateButtons()]
        });
      }
    });
  });
};
