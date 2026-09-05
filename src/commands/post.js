const {
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const { postNextSpill } = require('../services/posting');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('post')
    .setDescription('Force the next Daily Spill to post now.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    const result = await postNextSpill({
      client: interaction.client,
    });

    await interaction.editReply(
      `♡ Edition #${String(result.edition).padStart(3, '0')} posted in <#${result.channel.id}>.`
    );
  },
};