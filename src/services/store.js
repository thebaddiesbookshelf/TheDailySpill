const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { cleanCardText } = require('../utils/formatting');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', '..', 'data');

const DATA_FILE = path.join(DATA_DIR, 'spills.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 5;

const DEFAULT_DATA = {
  version: 2,

  settings: {
    channelId: '',
    postTime: '10:00',
    timezone: 'America/Chicago',
    activeDeckId: '',
    edition: 1,
    paused: true,
    lastScheduledDate: null,
    lastPostedAt: null,
  },

  decks: [],
  cards: [],
};

function ensureStorage() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(DEFAULT_DATA, null, 2),
      'utf8'
    );
  }
}

function normalizeDeckId(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function migrate(raw) {
  const oldSettings = raw?.settings ?? {};

  const settings = {
    ...DEFAULT_DATA.settings,
    channelId: oldSettings.channelId ?? '',
    postTime: oldSettings.postTime ?? '10:00',
    timezone: oldSettings.timezone ?? 'America/Chicago',
    activeDeckId: oldSettings.activeDeckId ?? '',
    edition:
      Number.isInteger(oldSettings.edition) &&
      oldSettings.edition > 0
        ? oldSettings.edition
        : 1,
    paused: oldSettings.paused !== false,
    lastScheduledDate:
      oldSettings.lastScheduledDate ?? null,
    lastPostedAt:
      oldSettings.lastPostedAt ??
      oldSettings.lastPostedDate ??
      null,
  };

  const decks = Array.isArray(raw?.decks)
    ? raw.decks.map((deck) => ({
        id:
          deck.id ||
          normalizeDeckId(deck.name || 'collection'),
        name: String(
          deck.name || 'Untitled Collection'
        ).trim(),
        description: String(
          deck.description || ''
        ).trim(),
        enabled: deck.enabled !== false,
        embedColor:
          deck.embedColor ||
          oldSettings.embedColor ||
          '#D97706',
        thumbnailUrl:
          deck.thumbnailUrl &&
          !deck.thumbnailUrl.includes(
            'YOUR_CURRENT_THUMBNAIL_URL'
          )
            ? deck.thumbnailUrl
            : '',
        createdAt:
          deck.createdAt ?? new Date().toISOString(),
      }))
    : [];

  const cards = Array.isArray(raw?.cards)
    ? raw.cards.map((card, index) => ({
        id: card.id || createId('card'),
        deckId: card.deckId,
        text: String(
          card.text ?? card.question ?? ''
        ).trim(),
        posted:
          typeof card.posted === 'boolean'
            ? card.posted
            : Boolean(card.used),
        order: Number.isFinite(card.order)
          ? card.order
          : index + 1,
        createdAt:
          card.createdAt ?? new Date().toISOString(),
        lastPostedAt: card.lastPostedAt ?? null,
      }))
    : [];

  const activeDeck = decks.find(
    (deck) => deck.id === settings.activeDeckId
  );

  if (!activeDeck || activeDeck.enabled === false) {
    settings.activeDeckId = '';
  }

  return {
    version: 2,
    settings,
    decks,
    cards,
  };
}

function readData() {
  ensureStorage();

  try {
    const parsed = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8')
    );

    return migrate(parsed);
  } catch (error) {
    console.error(
      'Could not read Daily Spill data:',
      error
    );

    throw new Error(
      'The Daily Spill data file could not be read.'
    );
  }
}

function createBackup() {
  ensureStorage();

  if (!fs.existsSync(DATA_FILE)) {
    return;
  }

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-');

  const backupPath = path.join(
    BACKUP_DIR,
    `spills-${stamp}.json`
  );

  fs.copyFileSync(DATA_FILE, backupPath);

  const backups = fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .reverse();

  for (const oldBackup of backups.slice(MAX_BACKUPS)) {
    fs.unlinkSync(
      path.join(BACKUP_DIR, oldBackup)
    );
  }
}

function writeData(data) {
  ensureStorage();

  const normalized = migrate(data);
  const tempPath = `${DATA_FILE}.tmp`;

  try {
    createBackup();

    fs.writeFileSync(
      tempPath,
      JSON.stringify(normalized, null, 2),
      'utf8'
    );

    fs.renameSync(tempPath, DATA_FILE);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    console.error(
      'Could not save Daily Spill data:',
      error
    );

    throw new Error(
      'The Daily Spill data could not be saved.'
    );
  }

  return normalized;
}

function getSettings() {
  return readData().settings;
}

function getDecks() {
  return readData().decks;
}

function getCards(deckId = null) {
  const cards = readData().cards;

  return deckId
    ? cards.filter((card) => card.deckId === deckId)
    : cards;
}

function getDeckById(deckId) {
  return (
    getDecks().find((deck) => deck.id === deckId) ??
    null
  );
}

function getCardById(cardId) {
  return (
    getCards().find((card) => card.id === cardId) ??
    null
  );
}

function getActiveDeck() {
  const data = readData();

  return (
    data.decks.find(
      (deck) =>
        deck.id === data.settings.activeDeckId &&
        deck.enabled
    ) ?? null
  );
}

function updateSettings(changes) {
  const data = readData();

  data.settings = {
    ...data.settings,
    ...changes,
  };

  return writeData(data).settings;
}

function createDeck({
  name,
  description = '',
  embedColor = '#D97706',
  thumbnailUrl = '',
}) {
  const data = readData();
  const id = normalizeDeckId(name);

  if (!id) {
    throw new Error(
      'Please provide a valid collection name.'
    );
  }

  if (
    data.decks.some(
      (deck) =>
        deck.id === id ||
        deck.name.toLowerCase() ===
          name.trim().toLowerCase()
    )
  ) {
    throw new Error(
      `A collection named "${name.trim()}" already exists.`
    );
  }

  const deck = {
    id,
    name: name.trim(),
    description: description.trim(),
    enabled: true,
    embedColor,
    thumbnailUrl,
    createdAt: new Date().toISOString(),
  };

  data.decks.push(deck);
  writeData(data);

  return deck;
}

function updateDeck(deckId, changes) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  Object.assign(deck, changes);
  writeData(data);

  return deck;
}

function setDeckEnabled(deckId, enabled) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  if (
    !enabled &&
    data.settings.activeDeckId === deckId
  ) {
    throw new Error(
      'You cannot disable the active collection. Activate another collection first or pause the bot while preparing decks.'
    );
  }

  deck.enabled = enabled;
  writeData(data);

  return deck;
}

function activateDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  if (!deck.enabled) {
    throw new Error(
      'That collection is disabled. Enable it first.'
    );
  }

  data.settings.activeDeckId = deck.id;
  writeData(data);

  return deck;
}

function deleteDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  if (data.settings.activeDeckId === deckId) {
    throw new Error(
      'You cannot delete the active collection. Activate another collection first.'
    );
  }

  const cardCount = data.cards.filter(
    (card) => card.deckId === deckId
  ).length;

  data.decks = data.decks.filter(
    (item) => item.id !== deckId
  );

  data.cards = data.cards.filter(
    (card) => card.deckId !== deckId
  );

  writeData(data);

  return {
    deck,
    cardCount,
  };
}

function getDeckStats(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  const cards = data.cards.filter(
    (card) => card.deckId === deckId
  );

  const posted = cards.filter(
    (card) => card.posted
  ).length;

  return {
    deck,
    total: cards.length,
    posted,
    available: cards.length - posted,
    active: data.settings.activeDeckId === deckId,
  };
}

function addCard(deckId, text) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  const cleaned = cleanCardText(text);

  if (!cleaned) {
    throw new Error(
      'The card cannot be empty.'
    );
  }

  if (
    data.cards.some(
      (card) =>
        card.deckId === deckId &&
        card.text.toLowerCase() ===
          cleaned.toLowerCase()
    )
  ) {
    throw new Error(
      'That card already exists in this collection.'
    );
  }

  const maxOrder = data.cards
    .filter((card) => card.deckId === deckId)
    .reduce(
      (max, card) =>
        Math.max(max, card.order || 0),
      0
    );

  const card = {
    id: createId('card'),
    deckId,
    text: cleaned,
    posted: false,
    order: maxOrder + 1,
    createdAt: new Date().toISOString(),
    lastPostedAt: null,
  };

  data.cards.push(card);
  writeData(data);

  return card;
}

function updateCard(cardId, changes) {
  const data = readData();

  const card = data.cards.find(
    (item) => item.id === cardId
  );

  if (!card) {
    throw new Error(
      'That card does not exist.'
    );
  }

  if (typeof changes.text === 'string') {
    changes.text = cleanCardText(changes.text);
  }

  Object.assign(card, changes);
  writeData(data);

  return card;
}

function deleteCard(cardId) {
  const data = readData();

  const card = data.cards.find(
    (item) => item.id === cardId
  );

  if (!card) {
    throw new Error(
      'That card does not exist.'
    );
  }

  data.cards = data.cards.filter(
    (item) => item.id !== cardId
  );

  writeData(data);

  return card;
}

function moveCard(cardId, destinationDeckId) {
  const data = readData();

  const card = data.cards.find(
    (item) => item.id === cardId
  );

  const destination = data.decks.find(
    (item) => item.id === destinationDeckId
  );

  if (!card) {
    throw new Error(
      'That card does not exist.'
    );
  }

  if (!destination) {
    throw new Error(
      'The destination collection does not exist.'
    );
  }

  if (card.deckId === destinationDeckId) {
    throw new Error(
      'That card is already in the selected collection.'
    );
  }

  const maxOrder = data.cards
    .filter(
      (item) => item.deckId === destinationDeckId
    )
    .reduce(
      (max, item) =>
        Math.max(max, item.order || 0),
      0
    );

  card.deckId = destinationDeckId;
  card.order = maxOrder + 1;
  card.posted = false;
  card.lastPostedAt = null;

  writeData(data);

  return {
    card,
    destination,
  };
}

function setCardPosted(cardId, posted) {
  return updateCard(cardId, {
    posted,
    lastPostedAt: posted
      ? new Date().toISOString()
      : null,
  });
}

function getNextAvailableCard(deckId) {
  return (
    getCards(deckId)
      .filter((card) => !card.posted)
      .sort(
        (a, b) =>
          (a.order || 0) - (b.order || 0)
      )[0] ?? null
  );
}

function shuffleDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  const cards = data.cards.filter(
    (card) => card.deckId === deckId
  );

  const shuffled = [...cards].sort(
    () => Math.random() - 0.5
  );

  shuffled.forEach((card, index) => {
    card.order = index + 1;
  });

  writeData(data);

  return cards.length;
}

function resetDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (item) => item.id === deckId
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.'
    );
  }

  const cards = data.cards.filter(
    (card) => card.deckId === deckId
  );

  for (const card of cards) {
    card.posted = false;
    card.lastPostedAt = null;
  }

  writeData(data);

  return cards.length;
}

function resetAllForLaunch() {
  const data = readData();

  data.settings.edition = 1;
  data.settings.lastScheduledDate = null;
  data.settings.lastPostedAt = null;
  data.settings.paused = true;

  for (const card of data.cards) {
    card.posted = false;
    card.lastPostedAt = null;
  }

  writeData(data);

  return data.cards.length;
}

module.exports = {
  DATA_DIR,
  DATA_FILE,
  readData,
  writeData,
  getSettings,
  updateSettings,
  getDecks,
  getDeckById,
  getActiveDeck,
  createDeck,
  updateDeck,
  setDeckEnabled,
  activateDeck,
  deleteDeck,
  getDeckStats,
  getCards,
  getCardById,
  addCard,
  updateCard,
  deleteCard,
  moveCard,
  setCardPosted,
  getNextAvailableCard,
  shuffleDeck,
  resetDeck,
  resetAllForLaunch,
};