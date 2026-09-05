function formatEdition(edition) {
  return String(edition).padStart(3, '0');
}

function shorten(text, maxLength = 90) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(
    0,
    Math.max(0, maxLength - 3)
  )}...`;
}

function cleanCardText(text) {
  let cleaned = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (!cleaned) {
    return '';
  }

  cleaned =
    cleaned.charAt(0).toUpperCase() +
    cleaned.slice(1);

  if (!/[?.!]$/.test(cleaned)) {
    cleaned += '?';
  }

  return cleaned;
}

module.exports = {
  formatEdition,
  shorten,
  cleanCardText,
};