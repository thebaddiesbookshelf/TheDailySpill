
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const {
  addCard,
  deleteCard,
  getCardById,
  getCards,
  getDeckById,
  getDecks,
  moveCard,
  setCardPosted,
  updateCard,
} = require('../services/store');

const { shorten } = require('../utils/formatting');

const pendingBatches = new Map();
const BATCH_LIFETIME = 10 * 60 * 1000;
const MAX_BATCH = 40;

function buildModal(customId, title, text = '') {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title);

  const input = new TextInputBuilder()
    .setCustomId('text')
    .setLabel('What should the card say?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(1000)
    .setPlaceholder('Type the Daily Spill card here...');

  if (text) input.setValue(text);

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return modal;
}

function buildBulkModal(deck) {
  const modal = new ModalBuilder()
    .setCustomId(`card:bulk:${deck.id}`)
    .setTitle('The Daily Spill ♡ Bulk Add');

  const input = new TextInputBuilder()
    .setCustomId('questions')
    .setLabel('Questions — separate with a blank line')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(4000)
    .setPlaceholder(
      'First question goes here.\n' +
      'This line is still part of question one.\n\n' +
      'Second question goes here.'
    );

  modal.addComponents(
    new ActionRowBuilder().addComponents(input)
  );

  return modal;
}

function buildDeckChoices(search) {
  return getDecks()
    .filter((deck) =>
      deck.name.toLowerCase().includes(search)
    )
    .slice(0, 25)
    .map((deck) => ({
      name: deck.name,
      value: deck.id,
    }));
}

function buildCardChoices(search) {
  return getCards()
    .filter((card) =>
      card.text.toLowerCase().includes(search)
    )
    .slice(0, 25)
    .map((card) => ({
      name: shorten(
        `${card.text} — ${getDeckById(card.deckId)?.name || 'Unknown'}`,
        100
      ),
      value: card.id,
    }));
}

function parseQuestions(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n[ \t]*\n+/)
    .map((question) => question.trim())
    .filter(Boolean);
}

function previewEmbed(deck, questions) {
  const lines = questions.map((question, index) => {
    return `**${index + 1}.** ${question}`;
  });

  let description = '';
  let displayed = 0;

  for (const line of lines) {
    const addition = (description ? '\n\n' : '') + line;

    if ((description + addition).length > 3600) {
      break;
    }

    description += addition;
    displayed++;
  }

  if (displayed < questions.length) {
    description +=
      `\n\n*♡ ${questions.length - displayed} more question(s) ` +
      'not shown here. All were validated.*';
  }

  return new EmbedBuilder()
    .setColor(deck.embedColor || '#DFA0BC')
    .setTitle('THE DAILY SPILL ♡ BULK QUESTION PREVIEW')
    .setDescription(
      `**Collection:** ${deck.name}\n` +
      `**Questions detected:** ${questions.length}\n\n` +
      'Review the questions below before saving.\n\n' +
      description
    )
    .setFooter({
      text: 'Nothing has been saved yet ♡',
    });
}

function confirmationButtons(batchId, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`cardbulk:save:${batchId}`)
        .setLabel('♡ Save All')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(`cardbulk:cancel:${batchId}`)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('card')
    .setDescription('Manage Daily Spill cards.')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )

    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a card to a collection.')
        .addStringOption((option) =>
          option
            .setName('collection')
            .setDescription('Collection.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('bulk-add')
        .setDescription('Add multiple questions at once.')
        .addStringOption((option) =>
          option
            .setName('collection')
            .setDescription('Collection to add questions to.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit a card’s text.')
        .addStringOption((option) =>
          option
            .setName('card')
            .setDescription('Card.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Mark a card posted or available.')
        .addStringOption((option) =>
          option
            .setName('card')
            .setDescription('Card.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('New status.')
            .setRequired(true)
            .addChoices(
              { name: 'Available', value: 'available' },
              { name: 'Posted', value: 'posted' }
            )
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('move')
        .setDescription('Move a card to another collection.')
        .addStringOption((option) =>
          option
            .setName('card')
            .setDescription('Card.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('destination')
            .setDescription('Destination collection.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a card.')
        .addStringOption((option) =>
          option
            .setName('card')
            .setDescription('Card.')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const search = String(focused.value).toLowerCase();

    if (
      focused.name === 'collection' ||
      focused.name === 'destination'
    ) {
      return interaction.respond(buildDeckChoices(search));
    }

    if (focused.name === 'card') {
      return interaction.respond(buildCardChoices(search));
    }

    return interaction.respond([]);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add' || sub === 'bulk-add') {
      const deck = getDeckById(
        interaction.options.getString('collection', true)
      );

      if (!deck) {
        throw new Error('That collection does not exist.');
      }

      if (sub === 'bulk-add') {
        return interaction.showModal(buildBulkModal(deck));
      }

      return interaction.showModal(
        buildModal(
          `card:add:${deck.id}`,
          `Add to ${shorten(deck.name, 35)}`
        )
      );
    }

    if (sub === 'edit') {
      const card = getCardById(
        interaction.options.getString('card', true)
      );

      if (!card) {
        throw new Error('That card does not exist.');
      }

      return interaction.showModal(
        buildModal(
          `card:edit:${card.id}`,
          'Edit Daily Spill Card',
          card.text
        )
      );
    }

    const card = getCardById(
      interaction.options.getString('card', true)
    );

    if (!card) {
      throw new Error('That card does not exist.');
    }

    if (sub === 'set') {
      const posted =
        interaction.options.getString('status', true) === 'posted';

      setCardPosted(card.id, posted);

      return interaction.reply({
        content:
          `♡ Card marked **${posted ? 'Posted' : 'Available'}**.`,
      });
    }

    if (sub === 'move') {
      const result = moveCard(
        card.id,
        interaction.options.getString('destination', true)
      );

      return interaction.reply({
        content:
          `♡ Card moved to **${result.destination.name}** ` +
          'and marked Available.',
      });
    }

    if (sub === 'delete') {
      const deck = getDeckById(card.deckId);

      deleteCard(card.id);

      return interaction.reply({
        content:
          `♡ Card deleted from ` +
          `**${deck?.name || 'its collection'}**:\n> ${card.text}`,
      });
    }
  },

  async handleModal(interaction) {
    const [, action, targetId] = interaction.customId.split(':');

    if (action === 'bulk') {
      const deck = getDeckById(targetId);

      if (!deck) {
        throw new Error('That collection no longer exists.');
      }

      const raw = interaction.fields.getTextInputValue(
        'questions'
      );

      const questions = parseQuestions(raw);

      if (!questions.length) {
        throw new Error('No questions were detected.');
      }

      if (questions.length > MAX_BATCH) {
        throw new Error(
          `Please submit no more than ${MAX_BATCH} ` +
          'questions at a time.'
        );
      }

      const invalidIndex = questions.findIndex(
        (question) =>
          question.length < 3 || question.length > 1000
      );

      if (invalidIndex !== -1) {
        throw new Error(
          `Question ${invalidIndex + 1} must be ` +
          'between 3 and 1,000 characters.'
        );
      }

      // Keep previews private and separate for each user.
      const batchId = require('node:crypto')
        .randomBytes(12)
        .toString('hex');

      pendingBatches.set(batchId, {
        userId: interaction.user.id,
        deckId: deck.id,
        questions,
        expiresAt: Date.now() + BATCH_LIFETIME,
        processing: false,
      });

      return interaction.reply({
        embeds: [previewEmbed(deck, questions)],
        components: confirmationButtons(batchId),
        flags: MessageFlags.Ephemeral,
      });
    }

    const text = interaction.fields.getTextInputValue('text');

    if (action === 'add') {
      const deck = getDeckById(targetId);

      if (!deck) {
        throw new Error('That collection no longer exists.');
      }

      const card = addCard(deck.id, text);

      return interaction.reply({
        content:
          `♡ Card added to **${deck.name}**:\n> ${card.text}`,
      });
    }

    if (action === 'edit') {
      const card = updateCard(targetId, { text });

      return interaction.reply({
        content: `♡ Card updated:\n> ${card.text}`,
      });
    }
  },

  async handleButton(interaction) {
    const [, action, batchId] = interaction.customId.split(':');
    const batch = pendingBatches.get(batchId);

    if (!batch || Date.now() > batch.expiresAt) {
      pendingBatches.delete(batchId);

      return interaction.update({
        content:
          '♡ This preview expired. Run `/card bulk-add` again.',
        embeds: [],
        components: [],
      });
    }

    if (interaction.user.id !== batch.userId) {
      return interaction.reply({
        content: '♡ This bulk preview belongs to someone else.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (batch.processing) {
      return interaction.reply({
        content: '♡ This batch is already being processed.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (action === 'cancel') {
      pendingBatches.delete(batchId);

      return interaction.update({
        content: '♡ Bulk addition cancelled. No cards were added.',
        embeds: [],
        components: [],
      });
    }

    if (action !== 'save') {
      return interaction.reply({
        content: 'Unknown bulk action.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const deck = getDeckById(batch.deckId);

    if (!deck) {
      pendingBatches.delete(batchId);
      throw new Error('That collection no longer exists.');
    }

    batch.processing = true;

    await interaction.deferUpdate();

    let savedCount = 0;

    try {
      for (const question of batch.questions) {
        addCard(deck.id, question);
        savedCount++;
      }

      pendingBatches.delete(batchId);

      const embed = new EmbedBuilder()
        .setColor(deck.embedColor || '#DFA0BC')
        .setTitle('THE DAILY SPILL ♡ QUESTIONS ADDED')
        .setDescription(
          'Your collection just got a little more interesting. ☕♡\n\n' +
          `**♡ Collection:** ${deck.name}\n` +
          `**♡ Questions Added:** ${savedCount}\n` +
          '**♡ Status:** All Available\n\n' +
          'Your new questions are ready for their Daily Spill debut!'
        )
        .setFooter({
          text: 'The Baddies Bookshelf ♡',
        });

      return interaction.editReply({
        embeds: [embed],
        components: [],
      });
    } catch (error) {
      pendingBatches.delete(batchId);

      await interaction.editReply({
        content:
          `♡ The import stopped after ${savedCount} question(s). ` +
          'Please check `/view cards` before trying again.\n\n' +
          `Error: ${error.message}`,
        embeds: [],
        components: [],
      });
    }
  },
};
