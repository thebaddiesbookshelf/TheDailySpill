const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getSettings,
  updateSettings,
} = require('../services/store');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause automatic Daily Spill posts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (getSettings().paused) {
      return interaction.reply({
        content: 'The Daily Spill is already paused.',
      });
    }

    updateSettings({ paused: true });

    return interaction.reply({
      content:
        '♡ Automatic Daily Spill posting is paused. Manual `/test` and `/post` still work.',
    });
  },
};