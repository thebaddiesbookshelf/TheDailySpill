const { EmbedBuilder } = require('discord.js');

const { formatEdition } = require('./formatting');

const { thumbnailUrl } = require('../services/thumbnailLibrary');

function buildSpillEmbed({ deck, card, edition }) {
  if (!deck) {
    throw new Error('No active collection is set.');
  }

  if (!card) {
    throw new Error('No card was provided.');
  }

  const embed = new EmbedBuilder()
    .setColor(deck.embedColor || '#D97706')
    .setTitle(
      `THE DAILY SPILL ♡ ${deck.name.toUpperCase()} COLLECTION`
    )
    .setDescription(`## ${card.text}`)
    .setFooter({
      text: `Edition #${formatEdition(edition)} ♡ The Baddies Bookshelf`,
    });

  const imageUrl = thumbnailUrl(deck);

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

function buildMilestoneEmbed({ deck, edition }) {
  const embed = new EmbedBuilder()
    .setColor(deck?.embedColor || '#D97706')
    .setTitle(
      `THE DAILY SPILL ♡ ${edition} EDITIONS`
    )
    .setDescription(
      [
        `## We just reached Edition #${edition}!`,
        '',
        'Thank you all for sharing your stories, opinions,',
        'hot takes, and everything in between! We love you Baddies!',
      ].join('\n')
    )
    .setFooter({
      text: 'Here’s to the next hundred ♡ The Baddies Bookshelf',
    });

  const imageUrl = thumbnailUrl(deck);

  if (imageUrl) {
    embed.setThumbnail(imageUrl);
  }

  return embed;
}

module.exports = {
  buildSpillEmbed,
  buildMilestoneEmbed,
};