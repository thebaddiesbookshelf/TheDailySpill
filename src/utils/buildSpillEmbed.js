const { EmbedBuilder } = require('discord.js');

function formatEdition(edition) {
  return String(edition).padStart(3, '0');
}

function buildSpillEmbed({
  deck,
  card,
  settings,
}) {
  if (!deck) {
    throw new Error('No active collection is set.');
  }

  if (!card) {
    throw new Error('No question was provided.');
  }

  const embed = new EmbedBuilder()
    .setColor(settings.embedColor)
    .setTitle(
      `THE DAILY SPILL ♡ ${deck.name.toUpperCase()} COLLECTION`,
    )
    .setDescription(`## ${card.question}`)
    .setFooter({
      text:
        `Edition #${formatEdition(settings.edition)} ` +
        '♡ The Baddies Bookshelf',
    });

  if (settings.thumbnailUrl) {
    embed.setThumbnail(settings.thumbnailUrl);
  }

  return embed;
}

function buildMilestoneEmbed({
  edition,
  settings,
}) {
  const embed = new EmbedBuilder()
    .setColor(settings.embedColor)
    .setTitle(
      `THE DAILY SPILL ♡ ${edition} EDITIONS`,
    )
    .setDescription(
      [
        `## We just reached Edition #${edition}!`,
        '',
        'Thank you all for sharing your stories, opinions,',
        'hot takes, and everything in between! We love you Baddies!',
      ].join('\n'),
    )
    .setFooter({
      text: 'Here’s to the next hundred ♡ The Baddies Bookshelf',
    });

  if (settings.thumbnailUrl) {
    embed.setThumbnail(settings.thumbnailUrl);
  }

  return embed;
}

module.exports = {
  buildSpillEmbed,
  buildMilestoneEmbed,
};