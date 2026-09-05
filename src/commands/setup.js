const {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getActiveDeck,
  getSettings,
  updateSettings,
} = require('../services/store');

const {
  isValidTime,
  assertValidTimezone,
} = require('../utils/validation');

const { formatEdition } = require('../utils/formatting');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up The Daily Spill posting schedule.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Where Daily Spills should post.')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addStringOption((option) =>
      option
        .setName('time')
        .setDescription('Daily posting time in 24-hour HH:MM format.')
        .setRequired(true)
        .setMinLength(5)
        .setMaxLength(5)
    )

    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('IANA timezone, such as America/Chicago.')
        .setRequired(false)
        .setMaxLength(100)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel', true);
    const time = interaction.options.getString('time', true).trim();
    const current = getSettings();

    const timezone = (
      interaction.options.getString('timezone') ||
      current.timezone ||
      'America/Chicago'
    ).trim();

    if (!isValidTime(time)) {
      throw new Error(
        'The posting time must use `HH:MM`, such as `08:30` or `19:00`.'
      );
    }

    assertValidTimezone(timezone);

    const settings = updateSettings({
      channelId: channel.id,
      postTime: time,
      timezone,
      paused: false,
      lastScheduledDate: null,
    });

    const deck = getActiveDeck();

    const embed = new EmbedBuilder()
      .setColor(deck?.embedColor || '#D97706')
      .setTitle('THE DAILY SPILL ♡ SETUP COMPLETE')
      .addFields(
        {
          name: 'Channel',
          value: `<#${settings.channelId}>`,
          inline: true,
        },
        {
          name: 'Daily Time',
          value: settings.postTime,
          inline: true,
        },
        {
          name: 'Timezone',
          value: settings.timezone,
          inline: true,
        },
        {
          name: 'Active Collection',
          value: deck?.name || 'None',
          inline: true,
        },
        {
          name: 'Next Edition',
          value: `#${formatEdition(settings.edition)}`,
          inline: true,
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