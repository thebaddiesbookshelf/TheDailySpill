const { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { getCardById, getCards, getDeckById, getDecks, getDeckStats } = require('../services/store');
const { shorten } = require('../utils/formatting');

module.exports = {
  data: new SlashCommandBuilder().setName('view').setDescription('View Daily Spill decks and cards.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('decks').setDescription('View all collections.'))
    .addSubcommand((sub) => sub.setName('cards').setDescription('View cards in a collection.').addStringOption((o) => o.setName('collection').setDescription('Collection.').setRequired(true).setAutocomplete(true)).addIntegerOption((o) => o.setName('page').setDescription('Page number.').setRequired(false).setMinValue(1)))
    .addSubcommand((sub) => sub.setName('card').setDescription('Preview a specific card.').addStringOption((o) => o.setName('card').setDescription('Card.').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const search = String(focused.value).toLowerCase();
    if (focused.name === 'collection') return interaction.respond(getDecks().filter((deck) => deck.name.toLowerCase().includes(search)).slice(0, 25).map((deck) => ({ name: deck.name, value: deck.id })));
    if (focused.name === 'card') return interaction.respond(getCards().filter((card) => card.text.toLowerCase().includes(search)).slice(0, 25).map((card) => ({ name: shorten(card.text, 100), value: card.id })));
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'decks') {
      const decks = getDecks();
      if (!decks.length) return interaction.reply({ content: 'There are no collections yet.' });
      const lines = decks.map((deck) => {
        const stats = getDeckStats(deck.id);
        const state = stats.active ? 'Active' : deck.enabled ? 'Enabled' : 'Disabled';
        return `**${deck.name}** — ${state}\n${stats.total} cards • ${stats.available} available • ${stats.posted} posted`;
      });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor('#D97706').setTitle('THE DAILY SPILL ♡ COLLECTIONS').setDescription(lines.join('\n\n'))] });
    }

    if (sub === 'cards') {
      const deck = getDeckById(interaction.options.getString('collection', true));
      if (!deck) throw new Error('That collection does not exist.');
      const cards = getCards(deck.id).sort((a, b) => a.order - b.order);
      if (!cards.length) return interaction.reply({ content: `**${deck.name}** does not have any cards yet.` });
      const perPage = 8;
      const totalPages = Math.ceil(cards.length / perPage);
      const page = Math.min(interaction.options.getInteger('page') || 1, totalPages);
      const start = (page - 1) * perPage;
      const description = cards.slice(start, start + perPage).map((card, index) => `**${start + index + 1}.** ${card.text}\n*${card.posted ? 'Posted' : 'Available'}*`).join('\n\n');
      const embed = new EmbedBuilder().setColor(deck.embedColor).setTitle(`THE DAILY SPILL ♡ ${deck.name.toUpperCase()} CARDS`).setDescription(description).setFooter({ text: `Page ${page} of ${totalPages} ♡ ${cards.length} cards` });
      if (deck.thumbnailUrl) embed.setThumbnail(deck.thumbnailUrl);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'card') {
      const card = getCardById(interaction.options.getString('card', true));
      if (!card) throw new Error('That card does not exist.');
      const deck = getDeckById(card.deckId);
      const embed = new EmbedBuilder().setColor(deck?.embedColor || '#D97706').setTitle('THE DAILY SPILL ♡ CARD').setDescription(`## ${card.text}`).addFields(
        { name: 'Collection', value: deck?.name || 'Unknown', inline: true },
        { name: 'Status', value: card.posted ? 'Posted' : 'Available', inline: true },
        { name: 'Order', value: String(card.order), inline: true },
      );
      if (deck?.thumbnailUrl) embed.setThumbnail(deck.thumbnailUrl);
      return interaction.reply({ embeds: [embed] });
    }
  },
};
