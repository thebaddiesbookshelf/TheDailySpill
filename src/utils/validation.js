function isValidTime(time) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time ?? '').trim());
}

function isValidHexColor(color) {
  return /^#?[0-9a-fA-F]{6}$/.test(String(color ?? '').trim());
}

function normalizeHexColor(color) {
  const cleaned = String(color).trim().toUpperCase();
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

function assertValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error('That timezone is not valid. Try something like `America/Chicago`.');
  }
}

module.exports = {
  isValidTime,
  isValidHexColor,
  normalizeHexColor,
  assertValidTimezone,
};
