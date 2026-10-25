
const {
  AttachmentBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const path = require('node:path');

const {
  getActiveDeck,
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spill')
    .setDescription('Daily Spill utilities and style shortcuts.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

    // ORIGINAL STYLE COMMANDS
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
            .setDescription('Change the active collection thumbnail.')
            .addAttachmentOption((option) =>
              option
                .setName('image')
                .setDescription('Square thumbnail.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('clear-thumbnail')
            .setDescription('Remove the active collection thumbnail.')
        )
    )

    // PERMANENT THUMBNAIL LIBRARY
    .addSubcommandGroup((group) =>
      group
        .setName('thumbnail')
        .setDescription('Manage saved collection thumbnails.')

        .addSubcommand((sub) =>
          sub
            .setName('save')
            .setDescription('Save a reusable thumbnail.')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Example: november')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(48)
            )
            .addAttachmentOption((option) =>
              option
                .setName('image')
                .setDescription('Upload your thumbnail image.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('list')
            .setDescription('List your saved thumbnails.')
        )

        .addSubcommand((sub) =>
          sub
            .setName('select')
            .setDescription('Assign a saved thumbnail to the active collection.')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Name of the saved thumbnail.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('preview')
            .setDescription('Preview a saved thumbnail.')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Name of the saved thumbnail.')
                .setRequired(true)
            )
        )

        .addSubcommand((sub) =>
          sub
            .setName('delete')
            .setDescription('Delete an unused saved thumbnail.')
            .addStringOption((option) =>
              option
                .setName('name')
                .setDescription('Name of the saved thumbnail.')
                .setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName('confirm')
                .setDescription('Type DELETE to confirm.')
                .setRequired(true)
            )
        )
    )

    // ORIGINAL RESET COMMAND
    .addSubcommand((sub) =>
      sub
        .setName('reset-all')
        .setDescription(
          'Reset all cards and Edition #001 for pre-launch testing only.'
        )
        .addStringOption((option) =>
          option
            .setName('confirm')
            .setDescription('Type RESET to confirm.')
            .setRequired(true)
        )
    ),

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

        return interaction.editReply({
          content:
            `♡ Thumbnail \`${savedName}\` saved to the library! ` +
            'Use `/spill thumbnail select` to assign it to your active collection.',
        });
      }

      // LIST
      if (sub === 'list') {
        const names = listThumbnails();

        return interaction.reply({
          content: names.length
            ? `♡ **Saved thumbnails (${names.length})**\n` +
              names.map((name) => `• \`${name}\``).join('\n')
            : '♡ Your thumbnail library is empty. Use `/spill thumbnail save` to add your first image.',
        });
      }

      // SELECT
      if (sub === 'select') {
        const name = interaction.options.getString('name', true);
        const deck = getActiveDeck();

        if (!deck) {
          throw new Error('There is no active collection.');
        }

        const saved = getThumbnail(name);

        await interaction.deferReply();

        const updated = updateDeck(deck.id, {
          thumbnailName: saved.id,
          thumbnailUrl: '',
        });

        const file = attachmentForDeck(updated);

        const embed = new EmbedBuilder()
          .setColor(updated.embedColor)
          .setTitle(
            `THE DAILY SPILL ♡ ${updated.name.toUpperCase()} COLLECTION`
          )
          .setDescription(`♡ Saved thumbnail: \`${saved.id}\``)
          .setThumbnail(thumbnailUrl(updated));

        return interaction.editReply({
          content:
            `♡ \`${saved.id}\` is now the thumbnail for **${updated.name}**!`,
          embeds: [embed],
          files: [file],
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
          .setTitle(`♡ Thumbnail Preview: ${saved.id}`)
          .setImage(`attachment://${attachmentName}`);

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

        return interaction.reply({
          content:
            `♡ Thumbnail \`${saved.id}\` deleted from the library.`,
        });
      }
    }

    // ORIGINAL STYLE HANDLERS
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

        const embed = new EmbedBuilder()
          .setColor(updated.embedColor)
          .setTitle(
            `THE DAILY SPILL ♡ ${updated.name.toUpperCase()} COLLECTION`
          )
          .setDescription('## Style preview')
          .setFooter({
            text: 'The Baddies Bookshelf ♡',
          });

        const imageUrl = thumbnailUrl(updated);
        const thumbnail = attachmentForDeck(updated);

        if (imageUrl) {
          embed.setThumbnail(imageUrl);
        }

        return interaction.reply({
          content:
            `♡ Active collection color changed to \`${updated.embedColor}\`.`,
          embeds: [embed],
          files: thumbnail ? [thumbnail] : [],
        });
      }

      // ORIGINAL THUMBNAIL UPLOAD
      if (sub === 'thumbnail') {
        await interaction.deferReply();

        const image = interaction.options.getAttachment('image', true);

        const savedName = await saveThumbnail(
          `deck-${deck.id}-${Date.now()}`,
          image
        );

        const updated = updateDeck(deck.id, {
          thumbnailName: savedName,
          thumbnailUrl: '',
        });

        return interaction.editReply({
          content:
            `♡ **${updated.name}** thumbnail updated and permanently saved as \`${savedName}\`.`,
        });
      }

      // CLEAR THUMBNAIL
      if (sub === 'clear-thumbnail') {
        updateDeck(deck.id, {
          thumbnailName: '',
          thumbnailUrl: '',
        });

        return interaction.reply({
          content:
            `♡ **${deck.name}** thumbnail removed from the collection. ` +
            'The saved image remains in your library.',
        });
      }
    }

    // ORIGINAL PRE-LAUNCH RESET
    if (sub === 'reset-all') {
      const confirmation = interaction.options.getString(
        'confirm',
        true
      );

      if (confirmation.toUpperCase() !== 'RESET') {
        throw new Error(
          'Reset cancelled. Type `RESET` in the confirmation field.'
        );
      }

      const count = resetAllForLaunch();

      return interaction.reply({
        content:
          `♡ Pre-launch reset complete: Edition #001, ${count} cards Available, scheduler paused. ` +
          'Your decks, themes, channel, time, and timezone were kept.',
      });
    }
  },
};
