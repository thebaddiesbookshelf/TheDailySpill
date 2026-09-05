const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const { previewNextSpill } = require('../services/posting');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription(
      'Preview the next Daily Spill without consuming it.'
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const { embed } = await previewNextSpill();

    await interaction.reply({
      embeds: [embed],
    });
  },
};