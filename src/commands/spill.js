const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { getActiveDeck, resetAllForLaunch, updateDeck } = require('../services/store');
const { isValidHexColor, normalizeHexColor } = require('../utils/validation');

module.exports = {
  data: new SlashCommandBuilder().setName('spill').setDescription('Daily Spill utilities and style shortcuts.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) => group.setName('style').setDescription('Edit the active collection style.')
      .addSubcommand((sub) => sub.setName('color').setDescription('Change the active collection embed color.').addStringOption((o) => o.setName('hex').setDescription('Hex color.').setRequired(true).setMinLength(6).setMaxLength(7)))
      .addSubcommand((sub) => sub.setName('thumbnail').setDescription('Change the active collection thumbnail.').addAttachmentOption((o) => o.setName('image').setDescription('Square thumbnail.').setRequired(true)))
      .addSubcommand((sub) => sub.setName('clear-thumbnail').setDescription('Remove the active collection thumbnail.')))
    .addSubcommand((sub) => sub.setName('reset-all').setDescription('Reset all cards and Edition #001 for pre-launch testing only.').addStringOption((o) => o.setName('confirm').setDescription('Type RESET to confirm.').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'style') {
      const deck = getActiveDeck();
      if (!deck) throw new Error('There is no active collection to style.');
      if (sub === 'color') {
        const hex = interaction.options.getString('hex', true);
        if (!isValidHexColor(hex)) throw new Error('Please enter a six-digit hex color, such as `#D97706`.');
        const updated = updateDeck(deck.id, { embedColor: normalizeHexColor(hex) });
        const embed = new EmbedBuilder().setColor(updated.embedColor).setTitle(`THE DAILY SPILL ♡ ${updated.name.toUpperCase()} COLLECTION`).setDescription('## Style preview').setFooter({ text: 'The Baddies Bookshelf ♡' });
        if (updated.thumbnailUrl) embed.setThumbnail(updated.thumbnailUrl);
        return interaction.reply({ content: `♡ Active collection color changed to \`${updated.embedColor}\`.`, embeds: [embed] });
      }
      if (sub === 'thumbnail') {
        const image = interaction.options.getAttachment('image', true);
        if (image.contentType && !image.contentType.startsWith('image/')) throw new Error('Please upload an image file.');
        const updated = updateDeck(deck.id, { thumbnailUrl: image.url });
        return interaction.reply({ content: `♡ **${updated.name}** thumbnail updated.` });
      }
      if (sub === 'clear-thumbnail') {
        updateDeck(deck.id, { thumbnailUrl: '' });
        return interaction.reply({ content: `♡ **${deck.name}** thumbnail removed.` });
      }
    }

    if (sub === 'reset-all') {
      if (interaction.options.getString('confirm', true).toUpperCase() !== 'RESET') throw new Error('Reset cancelled. Type `RESET` in the confirmation field.');
      const count = resetAllForLaunch();
      return interaction.reply({ content: `♡ Pre-launch reset complete: Edition #001, ${count} cards Available, scheduler paused. Your decks, themes, channel, time, and timezone were kept.` });
    }
  },
};
