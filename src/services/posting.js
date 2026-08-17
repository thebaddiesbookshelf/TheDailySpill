const {
  getActiveDeck,
  getNextAvailableCard,
  getSettings,
  setCardPosted,
  updateSettings,
} = require('./store');
const { buildMilestoneEmbed, buildSpillEmbed } = require('../utils/embeds');

async function resolveTargetChannel(client, channelOverride = null) {
  if (channelOverride) return channelOverride;
  const settings = getSettings();
  if (!settings.channelId) throw new Error('No Daily Spill posting channel is configured. Run `/setup` first.');
  const channel = await client.channels.fetch(settings.channelId);
  if (!channel?.isTextBased()) throw new Error('The configured Daily Spill channel is not text-based.');
  return channel;
}

function prepareNextSpill() {
  const settings = getSettings();
  const deck = getActiveDeck();
  if (!deck) throw new Error('There is no active enabled collection.');
  const card = getNextAvailableCard(deck.id);
  if (!card) throw new Error(`There are no available cards left in **${deck.name}**. Use \`/deck reset\` or activate another collection.`);
  return { settings, deck, card };
}

async function previewNextSpill() {
  const { settings, deck, card } = prepareNextSpill();
  return {
    embed: buildSpillEmbed({ deck, card, edition: settings.edition }),
    settings,
    deck,
    card,
  };
}

async function postNextSpill({ client, channel = null, scheduledDate = null }) {
  const { settings, deck, card } = prepareNextSpill();
  const target = await resolveTargetChannel(client, channel);
  const edition = settings.edition;

  await target.send({ embeds: [buildSpillEmbed({ deck, card, edition })] });

  // State changes only after Discord accepts the message.
  setCardPosted(card.id, true);
  updateSettings({
    edition: edition + 1,
    lastPostedAt: new Date().toISOString(),
    ...(scheduledDate ? { lastScheduledDate: scheduledDate } : {}),
  });

  if (edition % 100 === 0) {
    await target.send({ embeds: [buildMilestoneEmbed({ deck, edition })] });
  }

  return { edition, deck, card, channel: target };
}

module.exports = {
  previewNextSpill,
  postNextSpill,
};
