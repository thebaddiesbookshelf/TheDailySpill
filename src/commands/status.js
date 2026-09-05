const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getActiveDeck,
  getDeckStats,
  getSettings,
} = require('../services/store');

const { formatEdition } = require('../utils/formatting');
const { getNextPostTimestamp } = require('../utils/time');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('View The Daily Spill status.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const settings = getSettings();
    const deck = getActiveDeck();
    const stats = deck ? getDeckStats(deck.id) : null;

    const next =
      settings.postTime && settings.timezone
        ? getNextPostTimestamp(
            settings.postTime,
            settings.timezone
          )
        : null;

    const embed = new EmbedBuilder()
      .setColor(deck?.embedColor || '#D97706')
      .setTitle('THE DAILY SPILL ♡ STATUS')
      .addFields(
        {
          name: 'Posting Status',
          value: settings.paused ? 'Paused' : 'Active',
          inline: true,
        },
        {
          name: 'Collection',
          value: deck?.name || 'None selected',
          inline: true,
        },
        {
          name: 'Next Edition',
          value: `#${formatEdition(settings.edition)}`,
          inline: true,
        },
        {
          name: 'Channel',
          value: settings.channelId
            ? `<#${settings.channelId}>`
            : 'Not configured',
          inline: true,
        },
        {
          name: 'Timezone',
          value: settings.timezone || 'Not configured',
          inline: true,
        },
        {
          name: 'Available Cards',
          value: String(stats?.available ?? 0),
          inline: true,
        },
        {
          name: 'Posted Cards',
          value: String(stats?.posted ?? 0),
          inline: true,
        },
        {
          name: 'Next Scheduled Post',
          value: next
            ? `${
                settings.paused
                  ? '**Paused** — would post '
                  : ''
              }<t:${next}:F>\n<t:${next}:R>`
            : 'Not configured',
          inline: false,
        }
      )
      .setFooter({
        text: 'The Baddies Bookshelf ♡',
      });

    if (deck?.thumbnailUrl) {
      embed.setThumbnail(deck.thumbnailUrl);
    }

    await interaction.reply({
      embeds: [embed],
    });
  },
};