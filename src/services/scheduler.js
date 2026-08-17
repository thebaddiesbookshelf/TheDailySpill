const cron = require('node-cron');
const { getSettings } = require('./store');
const { postNextSpill } = require('./posting');
const { getLocalDateTime, hasScheduledTimePassedToday } = require('../utils/time');

let running = false;

async function attemptScheduledPost(client, { recoverMissed = false } = {}) {
  const settings = getSettings();
  if (settings.paused || !settings.channelId || !settings.postTime || !settings.timezone) return;

  const local = getLocalDateTime(settings.timezone);
  const dueNow = local.time === settings.postTime;
  const missedToday = recoverMissed && hasScheduledTimePassedToday(settings.postTime, settings.timezone);

  if (!dueNow && !missedToday) return;
  if (settings.lastScheduledDate === local.date) return;
  if (running) return;

  running = true;
  try {
    const result = await postNextSpill({ client, scheduledDate: local.date });
    console.log(`☕ Scheduled Edition #${String(result.edition).padStart(3, '0')} posted to #${result.channel.name}.`);
  } catch (error) {
    console.error('Daily Spill scheduled post failed:', error.message || error);
  } finally {
    running = false;
  }
}

function startScheduler(client) {
  console.log('⏰ Daily Spill scheduler started.');
  cron.schedule('* * * * *', () => attemptScheduledPost(client));
  // If the process was offline at the scheduled time, recover today's post on boot.
  attemptScheduledPost(client, { recoverMissed: true }).catch(console.error);
}

module.exports = { startScheduler, attemptScheduledPost };
