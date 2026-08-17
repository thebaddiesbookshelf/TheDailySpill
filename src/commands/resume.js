const { PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { getActiveDeck, getSettings, updateSettings } = require('../services/store');
module.exports = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume automatic Daily Spill posts.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const settings = getSettings();
    if (!settings.channelId) throw new Error('Run `/setup` before resuming automatic posts.');
    if (!getActiveDeck()) throw new Error('Activate an enabled collection before resuming automatic posts.');
    if (!settings.paused) return interaction.reply({ content: 'The Daily Spill is already active.' });
    updateSettings({ paused: false });
    return interaction.reply({ content: `♡ Automatic posting is active again for **${settings.postTime} ${settings.timezone}**.` });
  },
};
