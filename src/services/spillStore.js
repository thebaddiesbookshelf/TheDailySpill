const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dataFilePath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'spills.json',
);

const defaultData = {
  settings: {
    channelId: '',
    postTime: '10:00',
    timezone: 'America/Chicago',
    activeDeckId: '',
    embedColor: '#D97706',
    thumbnailUrl: '',
    edition: 1,
    paused: false,
    lastPostedDate: null,
    lastScheduledDate: null,
  },
  decks: [],
  cards: [],
};

function ensureDataFile() {
  const dataDirectory = path.dirname(dataFilePath);

  if (!fs.existsSync(dataDirectory)) {
    fs.mkdirSync(dataDirectory, {
      recursive: true,
    });
  }

  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(
      dataFilePath,
      JSON.stringify(defaultData, null, 2),
      'utf8',
    );
  }
}

function readData() {
  ensureDataFile();

  try {
    const rawData = fs.readFileSync(dataFilePath, 'utf8');
    const parsedData = JSON.parse(rawData);

    const settings = {
      ...defaultData.settings,
      ...parsedData.settings,
    };

    const decks = Array.isArray(parsedData.decks)
      ? parsedData.decks.map((deck) => ({
          ...deck,
          enabled: deck.enabled !== false,
          embedColor:
            deck.embedColor ??
            settings.embedColor ??
            '#D97706',
          thumbnailUrl:
            deck.thumbnailUrl ?? '',
        }))
      : [];

    return {
      settings,
      decks,
      cards: Array.isArray(parsedData.cards)
        ? parsedData.cards
        : [],
    };
  } catch (error) {
    console.error('Could not read Daily Spill data:', error);

    throw new Error(
      'The Daily Spill data file could not be read.',
    );
  }
}

function writeData(data) {
  ensureDataFile();

  const temporaryFilePath = `${dataFilePath}.tmp`;

  try {
    fs.writeFileSync(
      temporaryFilePath,
      JSON.stringify(data, null, 2),
      'utf8',
    );

    fs.renameSync(temporaryFilePath, dataFilePath);
  } catch (error) {
    console.error('Could not save Daily Spill data:', error);

    if (fs.existsSync(temporaryFilePath)) {
      fs.unlinkSync(temporaryFilePath);
    }

    throw new Error(
      'The Daily Spill data could not be saved.',
    );
  }
}

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeDeckId(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function getSettings() {
  return readData().settings;
}

function updateSettings(changes) {
  const data = readData();

  data.settings = {
    ...data.settings,
    ...changes,
  };

  writeData(data);

  return data.settings;
}

function getDecks() {
  return readData().decks;
}

function getDeckById(deckId) {
  const data = readData();

  return data.decks.find(
    (deck) => deck.id === deckId,
  ) ?? null;
}

function getActiveDeck() {
  const data = readData();

  return data.decks.find(
    (deck) => deck.id === data.settings.activeDeckId,
  ) ?? null;
}

function createDeck(
  name,
  description = '',
  theme = {},
) {
  const data = readData();
  const deckId = normalizeDeckId(name);

  if (!deckId) {
    throw new Error(
      'Please provide a valid collection name.',
    );
  }

  const existingDeck = data.decks.find(
    (deck) =>
      deck.id === deckId ||
      deck.name.toLowerCase() ===
        name.trim().toLowerCase(),
  );

  if (existingDeck) {
    throw new Error(
      `A collection named "${existingDeck.name}" already exists.`,
    );
  }

  const deck = {
    id: deckId,
    name: name.trim(),
    description: description.trim(),
    enabled: true,
    embedColor:
      theme.embedColor ??
      data.settings.embedColor ??
      '#D97706',
    thumbnailUrl:
      theme.thumbnailUrl ?? '',
    createdAt: new Date().toISOString(),
  };

  data.decks.push(deck);

  if (!data.settings.activeDeckId) {
    data.settings.activeDeckId = deck.id;
    data.settings.embedColor = deck.embedColor;
    data.settings.thumbnailUrl =
      deck.thumbnailUrl;
  }

  writeData(data);

  return deck;
}

function activateDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error(
      'That collection does not exist.',
    );
  }

  if (deck.enabled === false) {
    throw new Error(
      'That collection is disabled. Enable it before activating it.',
    );
  }

  data.settings.activeDeckId = deck.id;

  // Applying the collection also applies its saved theme.
  data.settings.embedColor =
    deck.embedColor ??
    data.settings.embedColor;

  data.settings.thumbnailUrl =
    deck.thumbnailUrl ?? '';

  writeData(data);

  return deck;
}

function getCards(deckId = null) {
  const data = readData();

  if (!deckId) {
    return data.cards;
  }

  return data.cards.filter(
    (card) => card.deckId === deckId,
  );
}

function cleanQuestion(question) {
  let cleaned = question
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return cleaned;
  }

  cleaned =
    cleaned.charAt(0).toUpperCase() +
    cleaned.slice(1);

  const endingPunctuation = /[?.!]$/;

  if (!endingPunctuation.test(cleaned)) {
    cleaned += '?';
  }

  return cleaned;
}

function addCard(deckId, question) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error('That collection does not exist.');
  }

  const cleanedQuestion = cleanQuestion(question);

  if (!cleanedQuestion) {
    throw new Error('The question cannot be empty.');
  }

  const duplicateCard = data.cards.find(
    (card) =>
      card.deckId === deckId &&
      card.question.toLowerCase() ===
        cleanedQuestion.toLowerCase(),
  );

  if (duplicateCard) {
    throw new Error(
      'That question already exists in this collection.',
    );
  }

  const card = {
    id: createId('card'),
    deckId,
    question: cleanedQuestion,
    used: false,
    createdAt: new Date().toISOString(),
    lastPostedAt: null,
  };

  data.cards.push(card);
  writeData(data);

  return card;
}

function getRandomUnusedCard(deckId) {
  const data = readData();

  const unusedCards = data.cards.filter(
    (card) =>
      card.deckId === deckId &&
      card.used === false,
  );

  if (unusedCards.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(
    Math.random() * unusedCards.length,
  );

  return unusedCards[randomIndex];
}

function markCardUsed(cardId) {
  const data = readData();
  const card = data.cards.find(
    (candidate) => candidate.id === cardId,
  );

  if (!card) {
    throw new Error('That card does not exist.');
  }

  card.used = true;
  card.lastPostedAt = new Date().toISOString();

  writeData(data);

  return card;
}

function resetDeckCards(deckId) {
  const data = readData();

  const matchingCards = data.cards.filter(
    (card) => card.deckId === deckId,
  );

  for (const card of matchingCards) {
    card.used = false;
    card.lastPostedAt = null;
  }

  writeData(data);

  return matchingCards.length;
}

function updateDeck(deckId, changes) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error('That collection does not exist.');
  }

  Object.assign(deck, changes);

  writeData(data);

  return deck;
}

function deleteDeck(deckId) {
  const data = readData();

  const deckIndex = data.decks.findIndex(
    (deck) => deck.id === deckId,
  );

  if (deckIndex === -1) {
    throw new Error('That collection does not exist.');
  }

  const deck = data.decks[deckIndex];

  if (data.settings.activeDeckId === deckId) {
    throw new Error(
      'You cannot delete the active collection. Activate another collection first.',
    );
  }

  const deletedCardCount = data.cards.filter(
    (card) => card.deckId === deckId,
  ).length;

  data.decks.splice(deckIndex, 1);

  data.cards = data.cards.filter(
    (card) => card.deckId !== deckId,
  );

  writeData(data);

  return {
    deck,
    deletedCardCount,
  };
}

function setDeckEnabled(deckId, enabled) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error('That collection does not exist.');
  }

  if (
    enabled === false &&
    data.settings.activeDeckId === deckId
  ) {
    throw new Error(
      'You cannot disable the active collection. Activate another collection first.',
    );
  }

  deck.enabled = enabled;

  writeData(data);

  return deck;
}

function shuffleDeck(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error('That collection does not exist.');
  }

  const cards = data.cards.filter(
    (card) => card.deckId === deckId,
  );

  for (const card of cards) {
    card.used = false;
    card.lastPostedAt = null;
  }

  writeData(data);

  return {
    deck,
    cardCount: cards.length,
  };
}

function getDeckStats(deckId) {
  const data = readData();

  const deck = data.decks.find(
    (candidate) => candidate.id === deckId,
  );

  if (!deck) {
    throw new Error('That collection does not exist.');
  }

  const cards = data.cards.filter(
    (card) => card.deckId === deckId,
  );

  const usedCards = cards.filter(
    (card) => card.used,
  ).length;

  return {
    deck,
    totalCards: cards.length,
    usedCards,
    unusedCards: cards.length - usedCards,
    isActive: data.settings.activeDeckId === deckId,
  };
}

function getCardById(cardId) {
  const data = readData();

  return data.cards.find(
    (card) => card.id === cardId,
  ) ?? null;
}

function updateCard(cardId, changes) {
  const data = readData();

  const card = data.cards.find(
    (candidate) => candidate.id === cardId,
  );

  if (!card) {
    throw new Error('That card does not exist.');
  }

  Object.assign(card, changes);

  writeData(data);

  return card;
}

function removeCard(cardId) {
  const data = readData();

  const cardIndex = data.cards.findIndex(
    (card) => card.id === cardId,
  );

  if (cardIndex === -1) {
    throw new Error('That card does not exist.');
  }

  const [removedCard] = data.cards.splice(cardIndex, 1);

  writeData(data);

  return removedCard;
}

function moveCard(cardId, destinationDeckId) {
  const data = readData();

  const card = data.cards.find(
    (candidate) => candidate.id === cardId,
  );

  if (!card) {
    throw new Error('That card does not exist.');
  }

  const destinationDeck = data.decks.find(
    (deck) => deck.id === destinationDeckId,
  );

  if (!destinationDeck) {
    throw new Error(
      'The destination collection does not exist.',
    );
  }

  if (card.deckId === destinationDeckId) {
    throw new Error(
      'That card is already in the selected collection.',
    );
  }

  card.deckId = destinationDeckId;
  card.used = false;
  card.lastPostedAt = null;

  writeData(data);

  return {
    card,
    destinationDeck,
  };
}

module.exports = {
  readData,
  writeData,
  getSettings,
  updateSettings,
  getDecks,
  getDeckById,
  getActiveDeck,
  createDeck,
  updateDeck,
  deleteDeck,
  setDeckEnabled,
  activateDeck,
  shuffleDeck,
  getDeckStats,
  getCards,
  getCardById,
  addCard,
  updateCard,
  removeCard,
  moveCard,
  getRandomUnusedCard,
  markCardUsed,
  resetDeckCards,
};