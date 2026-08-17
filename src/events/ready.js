const { Events } = require('discord.js');
const { startScheduler } = require('../services/scheduler');
module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`☕ The Daily Spill is online as ${client.user.tag}!`);
    client.user.setPresence({ activities: [{ name: "Brewing Today's Spill ☕" }], status: 'online' });
    startScheduler(client);
  },
};
