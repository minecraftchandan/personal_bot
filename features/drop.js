const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { v4: uuidv4 } = require('uuid');

// Load cards from JSON
const cards = require('../cards.json');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const command = message.content.trim().toLowerCase();
    if (!['md', 'mdrop'].includes(command)) return;

    // Reply with loading message
    const reply = await message.reply('🕐 Generating card drop...');

    // 🎴 Pick 3 unique random cards
    const shuffled = cards.sort(() => 0.5 - Math.random());
    const selectedCards = shuffled.slice(0, 3);

    // 🖼️ Create merged image
    const canvas = createCanvas(900, 400);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < selectedCards.length; i++) {
      const img = await loadImage(selectedCards[i].imageUrl);

      ctx.drawImage(
        img,
        0, 0, img.width, img.height,
        i * 300, 0, 300, 400
      );
    }

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'drop.png' });

    // 🔘 Initial claim buttons (all blue)
    let row = new ActionRowBuilder().addComponents(
      selectedCards.map((card, idx) =>
        new ButtonBuilder()
          .setCustomId(`claim_${card.id}`)
          .setLabel(`Claim ${idx + 1}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    await reply.edit({
      content: '🎴 A wild card drop appears! Click to claim!',
      files: [attachment],
      components: [row]
    });

    const collector = reply.channel.createMessageComponentCollector({
      time: 20000,
      filter: i => i.user.id === message.author.id
    });

    collector.on('collect', async i => {
      const claimedCardId = i.customId.split('_')[1];
      const card = selectedCards.find(c => c.id === claimedCardId);
      if (!card) return i.reply({ content: '❌ Invalid card.', ephemeral: true });

      const uniqueCode = uuidv4().slice(0, 8);
      const inventoryDir = path.join(__dirname, '..', 'inventory');
      const userFile = path.join(inventoryDir, `${i.user.username}.json`);

      if (!fs.existsSync(inventoryDir)) {
        fs.mkdirSync(inventoryDir);
      }

      let inventory = [];
      if (fs.existsSync(userFile)) {
        inventory = JSON.parse(fs.readFileSync(userFile));
      }

      inventory.push({ ...card, code: uniqueCode });
      fs.writeFileSync(userFile, JSON.stringify(inventory, null, 2));

      await i.reply({
        content: `🎉 You claimed card **${claimedCardId}** with code \`${uniqueCode}\`!`,
        ephemeral: false
      });

      // 🔒 Disable the clicked button only
      row = new ActionRowBuilder().addComponents(
        row.components.map(btn =>
          ButtonBuilder.from(btn).setDisabled(btn.data.custom_id === i.customId)
        )
      );

      await reply.edit({
        components: [row]
      });

      collector.stop();
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        reply.channel.send({ content: '⏱️ Time\'s up! No card claimed.' });
      }
    });
  });
};
