const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

function getHelpEmbed() {
  return new EmbedBuilder()
    .setTitle('📜 Available Commands')
    .setColor(Math.floor(Math.random() * 0xFFFFFF))
    .setThumbnail('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMm5sNmVoMHRzMHU0ejFpNDUxeHJ2bGZvaWhpaW9ka3NxNHEzdTdiayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lrDAgsYq0eomhwoESZ/giphy.gif')
    .setDescription('Here are all the available commands you can use:')
    .addFields(
      { name: '`mdrop`', value: '🎴 Drop a card to claim!(prototype)' },
      { name: '`mguess`', value: '🧠 Start a "Guess the Genshin Character" game.' },
      { name: '`/message`', value: '📩 Send a private message to the bot owner.' }
    )
    .setFooter({ text: 'Have fun! :)' });
}

function registerHelp(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const command = message.content.trim().toLowerCase();

    if (command === 'mhelp') {
      const embed = getHelpEmbed();
      message.reply({ embeds: [embed] });
    }
  });

  // Slash command registration
  client.once('ready', async () => {
    if (!client.application?.commands) return;

    await client.application.commands.create(
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands')
        .toJSON()
    );
  });

  // Slash command handler
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'help') {
      const embed = getHelpEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: false });
    }
  });
}

module.exports = registerHelp;
