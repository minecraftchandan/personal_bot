const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
  // Register the /message command when bot is ready
  client.once('ready', async () => {
    if (!client.application?.commands) return;

    await client.application.commands.create(
      new SlashCommandBuilder()
        .setName('message')
        .setDescription('Send a private message to the bot owner')
        .addStringOption(option =>
          option.setName('text')
            .setDescription('The message to send')
            .setRequired(true)
        )
        .toJSON()
    );

    console.log('✅ /message command registered');
  });

  // Handle /message interaction
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'message') return;

    const userMsg = interaction.options.getString('text');
    const user = interaction.user;

    const botOwnerId = '587709425708695552'; // Replace with your actual Discord ID

    try {
      // ✅ Defer the interaction immediately
      await interaction.deferReply({ ephemeral: true });

      const ownerUser = await client.users.fetch(botOwnerId);

      const embed = new EmbedBuilder()
        .setTitle('📩 New Message Received')
        .setDescription(`**${user.tag}** said:\n> ${userMsg}`)
        .setColor(Math.floor(Math.random() * 0xffffff)) // Random embed color
        .setFooter({ text: `User ID: ${user.id}` })
        .setTimestamp();

      // DM to owner
      await ownerUser.send({ embeds: [embed] });

      // ✅ Use editReply to complete the deferred interaction
      await interaction.editReply({ content: '✅ Your message was sent to the bot owner!' });

    } catch (err) {
      console.error('❌ Failed to forward message:', err);

      // Catch all failures
      try {
        await interaction.editReply({
          content: '❌ Failed to send your message. Try again later.'
        });
      } catch (editErr) {
        console.error('⚠️ Failed to edit reply:', editErr);
      }
    }
  });
};
