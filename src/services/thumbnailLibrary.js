
const fs = require('node:fs');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');

const root = path.resolve(
  process.env.DATA_DIR || path.join(__dirname, '../../data')
);

const dir = path.join(root, 'thumbnails');
const index = path.join(dir, 'library.json');

const key = name =>
  String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 48);

function library() {
  fs.mkdirSync(dir, { recursive: true });

  return fs.existsSync(index)
    ? JSON.parse(fs.readFileSync(index, 'utf8'))
    : {};
}

function persist(data) {
  fs.mkdirSync(dir, { recursive: true });

  const tmp = index + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, index);
}

async function save(name, attachment) {
  const id = key(name);

  if (!id) {
    throw new Error('Choose a thumbnail name.');
  }

  const ext = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }[attachment.contentType];

  if (!ext) {
    throw new Error('Use a PNG, JPEG, GIF or WebP image.');
  }

  if (attachment.size > 8 * 1024 * 1024) {
    throw new Error('Thumbnail must be 8 MB or smaller.');
  }

  const data = library();

  if (data[id]) {
    throw new Error(
      'That thumbnail name already exists. Delete it first or use a different name.'
    );
  }

  const response = await fetch(attachment.url);

  if (!response.ok) {
    throw new Error('Could not download the uploaded image.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Thumbnail exceeds 8 MB.');
  }

  const magic =
    ext === 'png'
      ? buffer.subarray(0, 8).equals(
          Buffer.from('89504e470d0a1a0a', 'hex')
        )
      : ext === 'jpg'
        ? buffer[0] === 255 && buffer[1] === 216
        : ext === 'gif'
          ? buffer.toString('ascii', 0, 3) === 'GIF'
          : buffer.toString('ascii', 0, 4) === 'RIFF' &&
            buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!magic) {
    throw new Error('Uploaded file is not a valid image of the selected type.');
  }

  const file = `${id}.${ext}`;

  fs.writeFileSync(path.join(dir, file), buffer, {
    flag: 'wx',
  });

  data[id] = {
    file,
    savedAt: new Date().toISOString(),
  };

  persist(data);

  return id;
}

function get(name) {
  const id = key(name);
  const item = library()[id];

  if (!item) {
    throw new Error(`Thumbnail ${id} was not found.`);
  }

  const file = path.join(dir, item.file);

  if (!fs.existsSync(file)) {
    throw new Error(
      `Thumbnail file ${id} is missing from persistent storage.`
    );
  }

  return { id, file };
}

function attachmentForDeck(deck) {
  if (!deck?.thumbnailName) return null;

  const { file } = get(deck.thumbnailName);

  return new AttachmentBuilder(file, {
    name: 'spill-thumbnail' + path.extname(file),
  });
}

function thumbnailUrl(deck) {
  if (deck?.thumbnailName) {
    const { file } = get(deck.thumbnailName);

    return 'attachment://spill-thumbnail' + path.extname(file);
  }

  return deck?.thumbnailUrl || '';
}

function remove(name, decks) {
  const { id, file } = get(name);

  if (decks.some(d => d.thumbnailName === id)) {
    throw new Error(
      'This thumbnail is assigned to a collection. Change that collection first.'
    );
  }

  const data = library();
  delete data[id];

  persist(data);
  fs.unlinkSync(file);
}

module.exports = {
  save,
  get,
  list: () => Object.keys(library()).sort(),
  remove,
  attachmentForDeck,
  thumbnailUrl,
};
