const { ActionRowBuilder, EmbedBuilder, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { addCard, deleteCard, getCardById, getCards, getDeckById, getDecks, moveCard, setCardPosted, updateCard } = require('../services/store');
const { shorten } = require('../utils/formatting');

function buildModal(customId, title, text = '') {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
  const input = new TextInputBuilder().setCustomId('text').setLabel('What should the card say?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(1000).setPlaceholder('Type the Daily Spill card here...');
  if (text) input.setValue(text);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card').setDescription('Manage Daily Spill cards.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName('add').setDescription('Add a card to a collection.').addStringOption((o) => o.setName('collection').setDescription('Collection.').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('edit').setDescription('Edit a card’s text.').addStringOption((o) => o.setName('card').setDescription('Card.').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('set').setDescription('Mark a card posted or available.').addStringOption((o) => o.setName('card').setDescription('Card.').setRequired(true).setAutocomplete(true)).addStringOption((o) => o.setName('status').setDescription('New status.').setRequired(true).addChoices({ name: 'Available', value: 'available' }, { name: 'Posted', value: 'posted' })))
    .addSubcommand((sub) => sub.setName('move').setDescription('Move a card to another collection.').addStringOption((o) => o.setName('card').setDescription('Card.').setRequired(true).setAutocomplete(true)).addStringOption((o) => o.setName('destination').setDescription('Destination collection.').setRequired(true).setAutocomplete(true)))
    .addSubcommand((sub) => sub.setName('delete').setDescription('Delete a card.').addStringOption((o) => o.setName('card').setDescription('Card.').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const search = String(focused.value).toLowerCase();
    if (focused.name === 'collection' || focused.name === 'destination') {
      return interaction.respond(getDecks().filter((deck) => deck.name.toLowerCase().includes(search)).slice(0, 25).map((deck) => ({ name: deck.name, value: deck.id })));
    }
    if (focused.name === 'card') {
      return interaction.respond(getCards().filter((card) => card.text.toLowerCase().includes(search)).slice(0, 25).map((card) => ({
        name: shorten(`${card.text} — ${getDeckById(card.deckId)?.name || 'Unknown'}`, 100),
        value: card.id,
      })));
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const deck = getDeckById(interaction.options.getString('collection', true));
      if (!deck) throw new Error('That collection does not exist.');
      return interaction.showModal(buildModal(`card:add:${deck.id}`, `Add to ${shorten(deck.name, 35)}`));
    }
    if (sub === 'edit') {
      const card = getCardById(interaction.options.getString('card', true));
      if (!card) throw new Error('That card does not exist.');
      return interaction.showModal(buildModal(`card:edit:${card.id}`, 'Edit Daily Spill Card', card.text));
    }

    const card = getCardById(interaction.options.getString('card', true));
    if (!card) throw new Error('That card does not exist.');

    if (sub === 'set') {
      const posted = interaction.options.getString('status', true) === 'posted';
      setCardPosted(card.id, posted);
      return interaction.reply({ content: `♡ Card marked **${posted ? 'Posted' : 'Available'}**.` });
    }
    if (sub === 'move') {
      const result = moveCard(card.id, interaction.options.getString('destination', true));
      return interaction.reply({ content: `♡ Card moved to **${result.destination.name}** and marked Available.` });
    }
    if (sub === 'delete') {
      const deck = getDeckById(card.deckId);
      deleteCard(card.id);
      return interaction.reply({ content: `♡ Card deleted from **${deck?.name || 'its collection'}**:\n> ${card.text}` });
    }
  },

  async handleModal(interaction) {
    const [, action, targetId] = interaction.customId.split(':');
    const text = interaction.fields.getTextInputValue('text');
    if (action === 'add') {
      const deck = getDeckById(targetId);
      if (!deck) throw new Error('That collection no longer exists.');
      const card = addCard(deck.id, text);
      return interaction.reply({ content: `♡ Card added to **${deck.name}**:\n> ${card.text}` });
    }
    if (action === 'edit') {
      const card = updateCard(targetId, { text });
      return interaction.reply({ content: `♡ Card updated:\n> ${card.text}` });
    }
  },
};
