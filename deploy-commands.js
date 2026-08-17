require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const required = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'src', 'commands');
const commands = fs.readdirSync(commandsDir).filter((name) => name.endsWith('.js')).map((file) => require(path.join(commandsDir, file)).data.toJSON());
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`☕ Deploying ${commands.length} Daily Spill commands...`);
    await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    console.log('✅ Daily Spill commands deployed!');
  } catch (error) {
    console.error('❌ Command deployment failed:', error);
    process.exitCode = 1;
  }
})();
