const {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  activateDeck,
  createDeck,
  deleteDeck,
  getDeckById,
  getDecks,
  getDeckStats,
  resetDeck,
  setDeckEnabled,
  shuffleDeck,
  updateDeck,
} = require('../services/store');

const {
  isValidHexColor,
  normalizeHexColor,
} = require('../utils/validation');

function deckOption(option, description = 'Choose a collection.') {
  return option
    .setName('collection')
    .setDescription(description)
    .setRequired(true)
    .setAutocomplete(true);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deck')
    .setDescription('Manage Daily Spill collections.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName('new')
        .setDescription('Create a new collection.')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('Collection name.')
            .setRequired(true)
            .setMaxLength(50)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Optional admin description.')
            .setRequired(false)
            .setMaxLength(200)
        )
        .addStringOption((option) =>
          option
            .setName('color')
            .setDescription('Embed color, e.g. #D97706.')
            .setRequired(false)
            .setMinLength(6)
            .setMaxLength(7)
        )
        .addAttachmentOption((option) =>
          option
            .setName('thumbnail')
            .setDescription('Square monthly thumbnail.')
            .setRequired(false)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('settings')
        .setDescription('View a collection’s settings.')
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommandGroup((group) =>
      group
        .setName('edit')
        .setDescription('Edit a collection.')

        .addSubcommand((sub) =>
          sub
            .setName('name')
            .setDescription('Rename a collection.')
            .addStringOption((option) => deckOption(option))
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('New name.')
                .setRequired(true)
                .setMaxLength(50)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('color')
            .setDescription('Change a collection’s embed color.')
            .addStringOption((option) => deckOption(option))
            .addStringOption((option) =>
              option
                .setName('hex')
                .setDescription('Hex color.')
                .setRequired(true)
                .setMinLength(6)
                .setMaxLength(7)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('thumbnail')
            .setDescription('Change a collection’s thumbnail.')
            .addStringOption((option) => deckOption(option))
            .addAttachmentOption((option) =>
              option
                .setName('image')
                .setDescription('New thumbnail.')
                .setRequired(true)
            )
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable a collection.')
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable a collection.')
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommand((sub) =>
      sub
        .setName('activate')
        .setDescription('Make a collection the active monthly collection.')
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommand((sub) =>
      sub
        .setName('shuffle')
        .setDescription(
          'Shuffle card order without changing posted states or edition.'
        )
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription(
          'Mark every card in a collection available again.'
        )
        .addStringOption((option) => deckOption(option))
    )

    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a collection and all of its cards.')
        .addStringOption((option) => deckOption(option))
        .addStringOption((option) =>
          option
            .setName('confirm')
            .setDescription('Type DELETE to confirm.')
            .setRequired(true)
        )
    ),

  async autocomplete(interaction) {
    const search = interaction.options.getFocused().toLowerCase();

    const choices = getDecks()
      .filter((deck) => deck.name.toLowerCase().includes(search))
      .slice(0, 25)
      .map((deck) => ({
        name: `${deck.name}${deck.enabled ? '' : ' — Disabled'}`,
        value: deck.id,
      }));

    await interaction.respond(choices);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    if (!group && sub === 'new') {
      const suppliedColor = interaction.options.getString('color');

      if (suppliedColor && !isValidHexColor(suppliedColor)) {
        throw new Error(
          'Please enter a six-digit hex color, such as `#D97706`.'
        );
      }

      const thumbnail = interaction.options.getAttachment('thumbnail');

      if (
        thumbnail?.contentType &&
        !thumbnail.contentType.startsWith('image/')
      ) {
        throw new Error('The thumbnail must be an image file.');
      }

      const deck = createDeck({
        name: interaction.options.getString('name', true),
        description: interaction.options.getString('description') || '',
        embedColor: suppliedColor
          ? normalizeHexColor(suppliedColor)
          : '#D97706',
        thumbnailUrl: thumbnail?.url || '',
      });

      return interaction.reply({
        content: `♡ **${deck.name}** created. Color: \`${deck.embedColor}\` • Thumbnail: ${
          deck.thumbnailUrl ? 'Saved' : 'None'
        }`,
      });
    }

    const deckId = interaction.options.getString('collection', true);
    const deck = getDeckById(deckId);

    if (!deck) {
      throw new Error('That collection does not exist.');
    }

    if (!group && sub === 'settings') {
      const stats = getDeckStats(deck.id);

      const embed = new EmbedBuilder()
        .setColor(deck.embedColor)
        .setTitle(`THE DAILY SPILL ♡ ${deck.name.toUpperCase()}`)
        .setDescription(deck.description || '*No description.*')
        .addFields(
          {
            name: 'Status',
            value: stats.active
              ? 'Active'
              : deck.enabled
                ? 'Enabled'
                : 'Disabled',
            inline: true,
          },
          {
            name: 'Cards',
            value: String(stats.total),
            inline: true,
          },
          {
            name: 'Available',
            value: String(stats.available),
            inline: true,
          },
          {
            name: 'Posted',
            value: String(stats.posted),
            inline: true,
          },
          {
            name: 'Color',
            value: `\`${deck.embedColor}\``,
            inline: true,
          },
          {
            name: 'Thumbnail',
            value: deck.thumbnailUrl ? 'Saved' : 'None',
            inline: true,
          }
        );

      if (deck.thumbnailUrl) {
        embed.setThumbnail(deck.thumbnailUrl);
      }

      return interaction.reply({
        embeds: [embed],
      });
    }

    if (group === 'edit' && sub === 'name') {
      const updated = updateDeck(deck.id, {
        name: interaction.options.getString('name', true).trim(),
      });

      return interaction.reply({
        content: `♡ Collection renamed to **${updated.name}**.`,
      });
    }

    if (group === 'edit' && sub === 'color') {
      const hex = interaction.options.getString('hex', true);

      if (!isValidHexColor(hex)) {
        throw new Error(
          'Please enter a six-digit hex color, such as `#D97706`.'
        );
      }

      const updated = updateDeck(deck.id, {
        embedColor: normalizeHexColor(hex),
      });

      return interaction.reply({
        content: `♡ **${updated.name}** now uses \`${updated.embedColor}\`.`,
      });
    }

    if (group === 'edit' && sub === 'thumbnail') {
      const image = interaction.options.getAttachment('image', true);

      if (
        image.contentType &&
        !image.contentType.startsWith('image/')
      ) {
        throw new Error('Please upload an image file.');
      }

      updateDeck(deck.id, {
        thumbnailUrl: image.url,
      });

      return interaction.reply({
        content: `♡ **${deck.name}** thumbnail updated.`,
      });
    }

    if (!group && sub === 'enable') {
      setDeckEnabled(deck.id, true);

      return interaction.reply({
        content: `♡ **${deck.name}** enabled.`,
      });
    }

    if (!group && sub === 'disable') {
      setDeckEnabled(deck.id, false);

      return interaction.reply({
        content: `♡ **${deck.name}** disabled.`,
      });
    }

    if (!group && sub === 'activate') {
      activateDeck(deck.id);

      return interaction.reply({
        content: `♡ **${deck.name}** is now the active collection. Its saved color and thumbnail will be used automatically.`,
      });
    }

    if (!group && sub === 'shuffle') {
      const count = shuffleDeck(deck.id);

      return interaction.reply({
        content: `♡ **${deck.name}** shuffled. ${count} cards reordered; posted states and edition were untouched.`,
      });
    }

    if (!group && sub === 'reset') {
      const count = resetDeck(deck.id);

      return interaction.reply({
        content: `♡ **${deck.name}** reset. ${count} cards are available again; edition was untouched.`,
      });
    }

    if (!group && sub === 'delete') {
      const confirmation = interaction.options.getString('confirm', true);

      if (confirmation.toUpperCase() !== 'DELETE') {
        throw new Error(
          'Deletion cancelled. Type `DELETE` in the confirmation field.'
        );
      }

      const result = deleteDeck(deck.id);

      return interaction.reply({
        content: `♡ **${result.deck.name}** deleted with ${result.cardCount} cards.`,
      });
    }
  },
};