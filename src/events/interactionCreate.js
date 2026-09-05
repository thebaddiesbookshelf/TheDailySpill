const {
  Events,
  MessageFlags,
} = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (interaction.isModalSubmit()) {
      const commandName = interaction.customId.startsWith('card:')
        ? 'card'
        : null;

      if (!commandName) {
        return;
      }

      const command =
        interaction.client.commands.get(commandName);

      try {
        await command?.handleModal?.(interaction);
      } catch (error) {
        console.error(
          `Modal error for ${interaction.customId}:`,
          error
        );

        const payload = {
          content:
            error.message ||
            'Something spilled behind the scenes.',
          flags: MessageFlags.Ephemeral,
        };

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload);
        } else {
          await interaction.reply(payload);
        }
      }

      return;
    }

    if (interaction.isAutocomplete()) {
      const command =
        interaction.client.commands.get(
          interaction.commandName
        );

      try {
        await command?.autocomplete?.(interaction);
      } catch (error) {
        console.error(
          `Autocomplete error for /${interaction.commandName}:`,
          error
        );
      }

      return;
    }

    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command =
      interaction.client.commands.get(
        interaction.commandName
      );

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `Error while running /${interaction.commandName}:`,
        error
      );

      const payload = {
        content:
          error.message ||
          'Something spilled behind the scenes. Please try again.',
        flags: MessageFlags.Ephemeral,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  },
};