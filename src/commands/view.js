
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const {
  getCardById,
  getCards,
  getDeckById,
  getDecks,
  getDeckStats,
} = require('../services/store');

const {
  attachmentForDeck,
  thumbnailUrl,
} = require('../services/thumbnailLibrary');

const { shorten } = require('../utils/formatting');

const PER_PAGE = 8;

function buildCardsPage(deckId, requestedPage) {
  const deck = getDeckById(deckId);

  if (!deck) {
    return null;
  }

  const cards = getCards(deck.id).sort(
    (a, b) => a.order - b.order
  );

  if (!cards.length) {
    return { empty: true, deck };
  }

  const totalPages = Math.ceil(cards.length / PER_PAGE);
  const page = Math.max(
    1,
    Math.min(Number(requestedPage) || 1, totalPages)
  );

  const start = (page - 1) * PER_PAGE;

  const description = cards
    .slice(start, start + PER_PAGE)
    .map(
      (card, index) =>
        `**${start + index + 1}.** ${card.text}\n` +
        `*♡ ${card.posted ? 'Posted' : 'Available'}*`
    )
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setColor(deck.embedColor || '#DFA0BC')
    .setTitle(
      `THE DAILY SPILL ♡ ${deck.name.toUpperCase()} CARDS`
    )
    .setDescription(description)
    .setFooter({
      text: `Page ${page} of ${totalPages} ♡ ${cards.length} cards`,
    });

  const files = [];
  const imageUrl = thumbnailUrl(deck);

  if (imageUrl) {
    embed.setThumbnail(imageUrl);

    const image = attachmentForDeck(deck);
    if (image) files.push(image);
  }

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`viewcards:first:${deck.id}`)
      .setEmoji('⏮️')
      .setLabel('First')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),

    new ButtonBuilder()
      .setCustomId(`viewcards:prev:${deck.id}:${page}`)
      .setEmoji('◀️')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),

    new ButtonBuilder()
      .setCustomId(`viewcards:next:${deck.id}:${page}`)
      .setEmoji('▶️')
      .setLabel('Next')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === totalPages),

    new ButtonBuilder()
      .setCustomId(`viewcards:last:${deck.id}`)
      .setEmoji('⏭️')
      .setLabel('Last')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages)
  );

  return {
    embeds: [embed],
    files,
    components: totalPages > 1 ? [buttons] : [],
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view')
    .setDescription('View Daily Spill decks and cards.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    .addSubcommand((sub) =>
      sub
        .setName('decks')
        .setDescription('View all collections.')
    )

    .addSubcommand((sub) =>
      sub
        .setName('cards')
        .setDescription('View cards in a collection.')
        .addStringOption((option) =>
          option
            .setName('collection')
            .setDescription('Collection.')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName('page')
            .setDescription('Page number.')
            .setRequired(false)
            .setMinValue(1)
        )
    )

    .addSubcommand((sub) =>
      sub
        .setName('card')
        .setDescription('Preview a specific card.')
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

    if (focused.name === 'collection') {
      const choices = getDecks()
        .filter((deck) =>
          deck.name.toLowerCase().includes(search)
        )
        .slice(0, 25)
        .map((deck) => ({
          name: deck.name,
          value: deck.id,
        }));

      return interaction.respond(choices);
    }

    if (focused.name === 'card') {
      const choices = getCards()
        .filter((card) =>
          card.text.toLowerCase().includes(search)
        )
        .slice(0, 25)
        .map((card) => ({
          name: shorten(card.text, 100),
          value: card.id,
        }));

      return interaction.respond(choices);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'decks') {
      const decks = getDecks();

      if (!decks.length) {
        return interaction.reply({
          content: 'There are no collections yet.',
        });
      }

      const lines = decks.map((deck) => {
        const stats = getDeckStats(deck.id);
        const state = stats.active
          ? 'Active'
          : deck.enabled
            ? 'Enabled'
            : 'Disabled';

        return (
          `**${deck.name}** — ${state}\n` +
          `${stats.total} cards • ${stats.available} available • ${stats.posted} posted`
        );
      });

      const embed = new EmbedBuilder()
        .setColor('#DFA0BC')
        .setTitle('THE DAILY SPILL ♡ COLLECTIONS')
        .setDescription(lines.join('\n\n'))
        .setFooter({
          text: 'The Baddies Bookshelf ♡',
        });

      return interaction.reply({
        embeds: [embed],
      });
    }

    if (sub === 'cards') {
      const deckId = interaction.options.getString(
        'collection',
        true
      );

      const page = interaction.options.getInteger('page') || 1;
      const result = buildCardsPage(deckId, page);

      if (!result) {
        throw new Error('That collection does not exist.');
      }

      if (result.empty) {
        return interaction.reply({
          content: `♡ **${result.deck.name}** does not have any cards yet.`,
        });
      }

      await interaction.reply(result);

      // Collect button clicks for this particular list.
      const message = await interaction.fetchReply();

      const collector = message.createMessageComponentCollector({
        filter: (buttonInteraction) =>
          buttonInteraction.customId.startsWith('viewcards:'),
        time: 15 * 60 * 1000,
      });

      collector.on('collect', async (buttonInteraction) => {
        try {
          // Only the person who opened the list can navigate.
          if (buttonInteraction.user.id !== interaction.user.id) {
            return buttonInteraction.reply({
              content:
                '♡ This question list belongs to someone else. ' +
                'Use `/view cards` to open your own!',
              ephemeral: true,
            });
          }

          const parts = buttonInteraction.customId.split(':');
          const action = parts[1];
          const targetDeckId = parts[2];
          const currentPage = Number(parts[3]) || 1;

          const currentCards = getCards(targetDeckId);
          const totalPages = Math.max(
            1,
            Math.ceil(currentCards.length / PER_PAGE)
          );

          let nextPage = currentPage;

          if (action === 'first') nextPage = 1;
          if (action === 'prev') nextPage = currentPage - 1;
          if (action === 'next') nextPage = currentPage + 1;
          if (action === 'last') nextPage = totalPages;

          const updated = buildCardsPage(
            targetDeckId,
            nextPage
          );

          if (!updated || updated.empty) {
            return buttonInteraction.reply({
              content:
                '♡ This collection no longer has any cards.',
              ephemeral: true,
            });
          }

          await buttonInteraction.update(updated);
        } catch (error) {
          console.error('Daily Spill pagination error:', error);

          if (!buttonInteraction.replied &&
              !buttonInteraction.deferred) {
            await buttonInteraction.reply({
              content:
                '♡ Something went wrong turning the page.',
              ephemeral: true,
            }).catch(() => {});
          }
        }
      });

      collector.on('end', async () => {
        try {
          const finalMessage = await interaction.fetchReply();

          if (!finalMessage.components.length) return;

          const disabledRows = finalMessage.components.map(
            (row) =>
              new ActionRowBuilder().addComponents(
                row.components.map((button) =>
                  ButtonBuilder.from(button).setDisabled(true)
                )
              )
          );

          await interaction.editReply({
            components: disabledRows,
          });
        } catch (error) {
          console.error(
            'Could not disable expired pagination buttons:',
            error.message
          );
        }
      });

      return;
    }

    if (sub === 'card') {
      const card = getCardById(
        interaction.options.getString('card', true)
      );

      if (!card) {
        throw new Error('That card does not exist.');
      }

      const deck = getDeckById(card.deckId);

      const embed = new EmbedBuilder()
        .setColor(deck?.embedColor || '#DFA0BC')
        .setTitle('THE DAILY SPILL ♡ CARD')
        .setDescription(`## ${card.text}`)
        .addFields(
          {
            name: '♡ Collection',
            value: deck?.name || 'Unknown',
            inline: true,
          },
          {
            name: '♡ Status',
            value: card.posted ? 'Posted' : 'Available',
            inline: true,
          },
          {
            name: '♡ Order',
            value: String(card.order),
            inline: true,
          }
        )
        .setFooter({
          text: 'The Baddies Bookshelf ♡',
        });

      const files = [];

      if (deck) {
        const imageUrl = thumbnailUrl(deck);

        if (imageUrl) {
          embed.setThumbnail(imageUrl);

          const image = attachmentForDeck(deck);
          if (image) files.push(image);
        }
      }

      return interaction.reply({
        embeds: [embed],
        files,
      });
    }
  },
};
