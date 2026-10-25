
const {
  AttachmentBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const path = require('node:path');

const {
  getActiveDeck,
  getDeckById,
  getDecks,
  resetAllForLaunch,
  updateDeck,
} = require('../services/store');

const {
  isValidHexColor,
  normalizeHexColor,
} = require('../utils/validation');

const {
  save: saveThumbnail,
  get: getThumbnail,
  list: listThumbnails,
  remove: removeThumbnail,
  attachmentForDeck,
  thumbnailUrl,
} = require('../services/thumbnailLibrary');

// Convert internal names into pretty display names.
// Example: october---haunted-hollow -> October — Haunted Hollow
function prettyName(name) {
  return String(name || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function thumbnailChoiceName(name) {
  return prettyName(name).slice(0, 100);
}

function collectionOption(option) {
  return option
    .setName('collection')
    .setDescription('Choose the collection to update.')
    .setRequired(true)
    .setAutocomplete(true);
}

function thumbnailOption(option) {
  return option
    .setName('name')
    .setDescription('Choose a saved thumbnail.')
    .setRequired(true)
    .setAutocomplete(true);
}

function makeThumbnailEmbed({
  title,
  description,
  deck = null,
  name = null,
  showImage = false,
}) {
  const embed = new EmbedBuilder()
    .setColor(deck?.embedColor || '#DFA0BC')
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: 'The Baddies Bookshelf ♡',
    });

  const files = [];

  if (deck) {
    embed.addFields({
      name: '♡ Collection',
      value: deck.name,
      inline: true,
    });
  }

  if (name) {
    embed.addFields({
      name: '♡ Thumbnail',
      value: prettyName(name),
      inline: true,
    });
  }

  if (showImage && deck?.thumbnailName) {
    const image = attachmentForDeck(deck);

    if (image) {
      embed.setThumbnail(thumbnailUrl(deck));
      files.push(image);
    }
  }

  return { embed, files };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spill')
    .setDescription('Daily Spill utilities and collection styling.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // STYLE COMMANDS
    .addSubcommandGroup((group) =>
      group
        .setName('style')
        .setDescription('Edit the active collection style.')

        .addSubcommand((sub) =>
          sub
            .setName('color')
            .setDescription('Change the active collection embed color.')
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
            .setDescription('Upload a thumbnail for the active collection.')
            .addAttachmentOption((option) =>
              option
                .setName('image')
                .setDescription('Square thumbnail image.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('clear-thumbnail')
            .setDescription('Remove the active collection thumbnail.')
        )
    )

    // THUMBNAIL LIBRARY
    .addSubcommandGroup((group) =>
      group
        .setName('thumbnail')
        .setDescription('Manage your permanent thumbnail library.')

        .addSubcommand((sub) =>
          sub
            .setName('save')
            .setDescription('Save a reusable thumbnail.')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Example: november haunted hollow')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(48)
            )
            .addAttachmentOption((option) =>
              option
                .setName('image')
                .setDescription('Upload your thumbnail.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('View your saved thumbnails.')
        )

        .addSubcommand((sub) =>
          sub
            .setName('select')
            .setDescription('Assign a saved thumbnail to any collection.')
            .addStringOption(thumbnailOption)
            .addStringOption(collectionOption)
        )

        .addSubcommand((sub) =>
          sub
            .setName('preview')
            .setDescription('Preview a saved thumbnail.')
            .addStringOption(thumbnailOption)
        )

        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Delete an unused saved thumbnail.')
            .addStringOption(thumbnailOption)
            .addStringOption((option) =>
              option
                .setName('confirm')
                .setDescription('Type DELETE to confirm.')
                .setRequired(true)
            )
        )
    )

    // PRE-LAUNCH RESET
    .addSubcommand((sub) =>
      sub
        .setName('reset-all')
        .setDescription(
          'Reset all cards and Edition #001 for pre-launch testing.'
        )
        .addStringOption((option) =>
          option
            .setName('confirm')
            .setDescription('Type RESET to confirm.')
            .setRequired(true)
        )
    ),

  // AUTOCOMPLETE
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const search = String(focused.value || '').toLowerCase();

    if (focused.name === 'collection') {
      const choices = getDecks()
        .filter((deck) =>
          deck.name.toLowerCase().includes(search)
        )
        .slice(0, 25)
        .map((deck) => ({
          name: `${deck.name}${deck.enabled ? '' : ' — Disabled'}`,
          value: deck.id,
        }));

      return interaction.respond(choices);
    }

    if (focused.name === 'name') {
      const choices = listThumbnails()
        .filter((name) =>
          prettyName(name).toLowerCase().includes(search) ||
          name.toLowerCase().includes(search)
        )
        .slice(0, 25)
        .map((name) => ({
          name: thumbnailChoiceName(name),
          value: name,
        }));

      return interaction.respond(choices);
    }

    return interaction.respond([]);
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup(false);

    // THUMBNAIL LIBRARY HANDLERS
    if (group === 'thumbnail') {

      // SAVE
      if (sub === 'save') {
        await interaction.deferReply();

        const name = interaction.options.getString('name', true);
        const image = interaction.options.getAttachment('image', true);

        const savedName = await saveThumbnail(name, image);

        const { embed } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ THUMBNAIL SAVED',
          description:
            'A little something pretty for the collection. ♡\n\n' +
            'Your new thumbnail is tucked safely into the library, ' +
            'ready whenever you need her.',
          name: savedName,
        });

        return interaction.editReply({
          embeds: [embed],
        });
      }

      // LIST
      if (sub === 'list') {
        const names = listThumbnails();

        const description = names.length
          ? names
              .map((name) => `♡ ${prettyName(name)}`)
              .join('\n')
              .slice(0, 4000)
          : 'No thumbnails saved yet, darling. ♡\n\n' +
            'Use `/spill thumbnail save` to add your first one.';

        const embed = new EmbedBuilder()
          .setColor('#DFA0BC')
          .setTitle('THE DAILY SPILL ♡ THUMBNAIL LIBRARY')
          .setDescription(description)
          .setFooter({
            text: `${names.length} saved ♡ The Baddies Bookshelf`,
          });

        return interaction.reply({
          embeds: [embed],
        });
      }

      // SELECT FOR ANY COLLECTION
      if (sub === 'select') {
        const name = interaction.options.getString('name', true);
        const deckId = interaction.options.getString(
          'collection',
          true
        );

        const deck = getDeckById(deckId);

        if (!deck) {
          throw new Error('That collection does not exist.');
        }

        const saved = getThumbnail(name);

        await interaction.deferReply();

        const updated = updateDeck(deck.id, {
          thumbnailName: saved.id,
          thumbnailUrl: '',
        });

        const { embed, files } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ THUMBNAIL UPDATED',
          description:
            'A little makeover for the collection. ♡\n\n' +
            'She is dressed and ready for her next spill.',
          deck: updated,
          name: saved.id,
          showImage: true,
        });

        return interaction.editReply({
          embeds: [embed],
          files,
        });
      }

      // PREVIEW
      if (sub === 'preview') {
        const name = interaction.options.getString('name', true);
        const saved = getThumbnail(name);

        await interaction.deferReply();

        const attachmentName =
          `spill-preview${path.extname(saved.file)}`;

        const embed = new EmbedBuilder()
          .setColor('#DFA0BC')
          .setTitle('THE DAILY SPILL ♡ THUMBNAIL PREVIEW')
          .setDescription(
            `♡ **${prettyName(saved.id)}**\n\n` +
            'Just a little sneak peek, darling.'
          )
          .setImage(`attachment://${attachmentName}`)
          .setFooter({
            text: 'The Baddies Bookshelf ♡',
          });

        return interaction.editReply({
          embeds: [embed],
          files: [
            new AttachmentBuilder(saved.file, {
              name: attachmentName,
            }),
          ],
        });
      }

      // DELETE
      if (sub === 'delete') {
        const name = interaction.options.getString('name', true);
        const confirmation = interaction.options.getString(
          'confirm',
          true
        );

        if (confirmation !== 'DELETE') {
          throw new Error(
            'Deletion cancelled. Type `DELETE` to confirm.'
          );
        }

        const saved = getThumbnail(name);

        removeThumbnail(saved.id, getDecks());

        const { embed } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ THUMBNAIL REMOVED',
          description:
            'Out with the old, in with the new. ♡\n\n' +
            'That thumbnail has been removed from your library.',
          name: saved.id,
        });

        return interaction.reply({
          embeds: [embed],
        });
      }
    }

    // ORIGINAL STYLE COMMANDS
    if (group === 'style') {
      const deck = getActiveDeck();

      if (!deck) {
        throw new Error(
          'There is no active collection to style.'
        );
      }

      // COLOR
      if (sub === 'color') {
        const hex = interaction.options.getString('hex', true);

        if (!isValidHexColor(hex)) {
          throw new Error(
            'Please enter a six-digit hex color, such as `#D97706`.'
          );
        }

        const updated = updateDeck(deck.id, {
          embedColor: normalizeHexColor(hex),
        });

        const { embed, files } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ STYLE UPDATED',
          description:
            'A fresh coat of color for the collection. ♡',
          deck: updated,
          showImage: true,
        });

        embed.addFields({
          name: '♡ New Color',
          value: `\`${updated.embedColor}\``,
          inline: true,
        });

        return interaction.reply({
          embeds: [embed],
          files,
        });
      }

      // UPLOAD TO ACTIVE COLLECTION
      if (sub === 'thumbnail') {
        await interaction.deferReply();

        const deck = getActiveDeck();
        const image = interaction.options.getAttachment('image', true);

        const savedName = await saveThumbnail(
          `deck-${deck.id}-${Date.now()}`,
          image
        );

        const updated = updateDeck(deck.id, {
          thumbnailName: savedName,
          thumbnailUrl: '',
        });

        const { embed, files } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ THUMBNAIL UPDATED',
          description:
            'New thumbnail, who dis? ♡',
          deck: updated,
          name: savedName,
          showImage: true,
        });

        return interaction.editReply({
          embeds: [embed],
          files,
        });
      }

      // CLEAR ACTIVE THUMBNAIL
      if (sub === 'clear-thumbnail') {
        updateDeck(deck.id, {
          thumbnailName: '',
          thumbnailUrl: '',
        });

        const { embed } = makeThumbnailEmbed({
          title: 'THE DAILY SPILL ♡ THUMBNAIL CLEARED',
          description:
            'A clean slate for this collection. ♡\n\n' +
            'Your saved images are still safe in the library.',
          deck,
        });

        return interaction.reply({
          embeds: [embed],
        });
      }
    }

    // ORIGINAL RESET COMMAND
    if (sub === 'reset-all') {
      const confirmation = interaction.options.getString(
        'confirm',
        true
      );

      if (confirmation.toUpperCase() !== 'RESET') {
        throw new Error(
          'Reset cancelled. Type `RESET` to confirm.'
        );
      }

      const count = resetAllForLaunch();

      return interaction.reply({
        content:
          `♡ Pre-launch reset complete: Edition #001, ` +
          `${count} cards Available, scheduler paused. ` +
          'Your decks, themes, channel, time, and timezone were kept.',
      });
    }
  },
};
