const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/\s+/);
    const command = args[0].toLowerCase();

    const inventoryPath = path.join(__dirname, '..', 'inventory', `${message.author.username}.json`);

    // 🗂️ View all codes
    if (command === 'mc') {
      if (!fs.existsSync(inventoryPath)) {
        return message.reply('📭 You have no cards in your collection.');
      }

      const inventory = JSON.parse(fs.readFileSync(inventoryPath));
      if (inventory.length === 0) {
        return message.reply('📭 Your collection is empty.');
      }

      const codes = inventory.map(card => `🔹 \`${card.code}\``).join('\n');
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${message.author.username}'s Collection`)
            .setDescription(codes)
            .setColor(0x3498db)
        ]
      });
    }

    // 🔍 View a specific card by code
    if (command === 'mv') {
      const codeToFind = args[1];
      if (!codeToFind) {
        return message.reply('❌ Please provide a card code. Example: `mv abcd1234`');
      }

      if (!fs.existsSync(inventoryPath)) {
        return message.reply('❌ You have no inventory yet.');
      }

      const inventory = JSON.parse(fs.readFileSync(inventoryPath));
      const card = inventory.find(c => c.code === codeToFind);

      if (!card) {
        return message.reply(`❌ No card found with code \`${codeToFind}\`.`);
      }

      // 🎴 Send embed with image
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`Card Code: ${codeToFind}`)
            .setImage(card.imageUrl)
            .setColor(0x00bcd4)
            .setFooter({ text: `${message.author.username}'s Card` })
        ]
      });
    }
  });
};
