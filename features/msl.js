const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  ComponentType
} = require('discord.js');

module.exports = (client) => {
  const OWNER_ID = '587709425708695552'; // your Discord ID

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.author.id !== OWNER_ID) return;

    if (message.content.trim().toLowerCase() === 'msl') {
      const guilds = [...client.guilds.cache.values()];
      const perPage = 5;
      let page = 0;
      const totalPages = Math.ceil(guilds.length / perPage);

      const generateEmbed = async (pageIndex) => {
        const start = pageIndex * perPage;
        const end = start + perPage;
        const embed = new EmbedBuilder()
          .setTitle('🧭 Servers the Bot is In')
          .setColor(Math.floor(Math.random() * 0xffffff))
          .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` });

        const slice = guilds.slice(start, end);

        for (let i = 0; i < slice.length; i++) {
          const guild = slice[i];
          let invite = '❌ No invite could be created';

          try {
            const channels = guild.channels.cache.filter(c =>
              c.isTextBased() &&
              c.permissionsFor(guild.members.me)?.has(PermissionsBitField.Flags.CreateInstantInvite)
            );

            for (const [_, channel] of channels) {
              try {
                const inviteObj = await channel.createInvite({
                  maxAge: 0,
                  maxUses: 0,
                  reason: 'Auto-generated for bot owner'
                });
                invite = `[link](${inviteObj.url})`;
                break; // ✅ Stop after first successful invite
              } catch {
                // try next channel
              }
            }
          } catch {
            invite = '❌ Failed to fetch invite';
          }

          embed.addFields({
            name: `${start + i + 1}. ${guild.name}`,
            value: `🆔 ${guild.id}\n🔗 ${invite}`,
            inline: false
          });
        }

        return embed;
      };

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('⬅ Previous')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Next ➡')
          .setStyle(ButtonStyle.Primary)
      );

      const embed = await generateEmbed(page);
      const reply = await message.reply({ embeds: [embed], components: [row] });

      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== OWNER_ID) {
          return interaction.reply({
            content: '❌ SOJA BRO',
            ephemeral: true
          });
        }

        try {
          if (interaction.customId === 'prev') {
            page = page > 0 ? page - 1 : totalPages - 1;
          } else if (interaction.customId === 'next') {
            page = (page + 1) % totalPages;
          }

          const newEmbed = await generateEmbed(page);
          await interaction.update({ embeds: [newEmbed], components: [row] });
        } catch (err) {
          console.error('Pagination update failed:', err);
          await interaction.deferUpdate().catch(() => {});
        }
      });

      collector.on('end', () => {
        reply.edit({ components: [] }).catch(() => {});
      });
    }
  });
};

