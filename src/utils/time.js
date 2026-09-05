function getZonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
}

function getLocalDateTime(
  timezone,
  date = new Date()
) {
  const parts = getZonedParts(date, timezone);

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function getNextPostTimestamp(
  postTime,
  timezone,
  now = new Date()
) {
  if (!postTime || !timezone) {
    return null;
  }

  const roundedStart =
    Math.floor(now.getTime() / 60000) * 60000 +
    60000;

  for (
    let offset = 0;
    offset < 60 * 48;
    offset += 1
  ) {
    const candidate = new Date(
      roundedStart + offset * 60000
    );

    const parts = getZonedParts(
      candidate,
      timezone
    );

    if (
      `${parts.hour}:${parts.minute}` === postTime
    ) {
      return Math.floor(
        candidate.getTime() / 1000
      );
    }
  }

  return null;
}

function hasScheduledTimePassedToday(
  postTime,
  timezone,
  now = new Date()
) {
  const local = getLocalDateTime(timezone, now);

  return local.time >= postTime;
}

module.exports = {
  getLocalDateTime,
  getNextPostTimestamp,
  hasScheduledTimePassedToday,
};