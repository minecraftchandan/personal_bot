const { EmbedBuilder } = require('discord.js');
const sharp = require('sharp');
const axios = require('axios');
const data = require('../data.json');

const cooldowns = new Map();
const COOLDOWN_TIME = 2000;

module.exports = client => {
  client.on('messageCreate', async message => {
    if (message.author.bot || message.content.toLowerCase() !== 'mguess') return;

    const userId = message.author.id;
    const now = Date.now();

    if (cooldowns.has(userId)) {
      const expiration = cooldowns.get(userId);
      if (now < expiration) {
        const remaining = Math.ceil((expiration - now) / 1000);
        return message.reply(`⏳ Please wait **${remaining} second(s)** before guessing again.`);
      }
    }
    cooldowns.set(userId, now + COOLDOWN_TIME);
    const names = Object.keys(data);
    const correctName = names[Math.floor(Math.random() * names.length)];
    const imageUrl = data[correctName];
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      
      const buffer = Buffer.from(response.data, 'binary');
      const metadata = await sharp(buffer).metadata();
      const { width, height } = metadata;

      const cropWidth = Math.min(200, Math.floor(width * 0.3));
      const cropHeight = Math.min(200, Math.floor(height * 0.3));

      if (cropWidth <= 0 || cropHeight <= 0) throw new Error('Image too small to crop.');

      const left = Math.floor(Math.random() * (width - cropWidth));
      const top = Math.floor(Math.random() * (height - cropHeight));

      const shouldBlur = Math.random() < 0.5;
      let processed = sharp(buffer).extract({ left, top, width: cropWidth, height: cropHeight });
      if (shouldBlur) processed = processed.blur(8);
      const croppedBuffer = await processed.toBuffer();

      const puzzleEmbed = new EmbedBuilder()
        .setTitle('🧠 Guess the Character')
        .setDescription(`You have **20 seconds** to guess the character!`)
        .setImage('attachment://puzzle.png')
        .setColor('#5865F2')
        .setFooter({ text: 'First correct answer wins!' });

      const puzzleMessage = await message.channel.send({
        embeds: [puzzleEmbed],
        files: [{ attachment: croppedBuffer, name: 'puzzle.png' }]
      });

      console.log(`✅ Sent ${shouldBlur ? 'blurred' : 'cropped'} puzzle for ${correctName}`);

      const fullEmbed = new EmbedBuilder()
        .setTitle(`🎯 It was: ${correctName}`)
        .setImage('attachment://full.png')
        .setColor('#1ABC9C')
        .setFooter({ text: 'Thanks for playing! 🔍' });

      let answeredCorrectly = false;

      const filter = m => !m.author.bot;
      const collector = message.channel.createMessageCollector({ filter, time: 20000 });

      collector.on('collect', async m => {
        if (m.content.toLowerCase().includes(correctName.toLowerCase())) {
          answeredCorrectly = true;
          collector.stop();
          await puzzleMessage.reply(`🎉 <@${m.author.id}> guessed it right! It was **${correctName}**!`);
          await puzzleMessage.edit({
            embeds: [fullEmbed],
            files: [{ attachment: buffer, name: 'full.png' }]
          });
        }
      });

      collector.on('end', async () => {
        if (!answeredCorrectly) {
          await puzzleMessage.reply(`⏰ Time's up! The correct answer was **${correctName}**.`);
          await puzzleMessage.edit({
            embeds: [fullEmbed],
            files: [{ attachment: buffer, name: 'full.png' }]
          });
        }
      });

    } catch (err) {
      console.error('❌ Error:', err.message);
      message.reply('Error loading character. Please try again!');
      cooldowns.delete(userId);
    }
  });
};
