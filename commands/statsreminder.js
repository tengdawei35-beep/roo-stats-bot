const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  runWeeklyStatsReminder
} = require("../services/weeklyStatsReminder");

module.exports = {

  data:
    new SlashCommandBuilder()
      .setName("statsreminder")
      .setDescription("Send the weekly stats reminder now.")
      .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
      ),

  async execute(interaction) {

    await interaction.deferReply({
      ephemeral: true
    });

    try {

      await runWeeklyStatsReminder(
        interaction.client
      );

      await interaction.editReply(
        "✅ Weekly stats reminder has been triggered."
      );

    } catch (error) {

      console.error(
        "[WEEKLY STATS] Manual reminder failed:",
        error
      );

      await interaction.editReply(
        "❌ Failed to send the weekly stats reminder.\n\n" +
        "`" +
        error.message +
        "`"
      );

    }

  }

};