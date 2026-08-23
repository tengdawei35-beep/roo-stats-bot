const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  getMembersMissingWeeklyStats
} = require("../services/sheets");

const {
  runWeeklyStatsReminder
} = require("../services/weeklyStatsReminder");


module.exports = {

  data:
    new SlashCommandBuilder()

      .setName(
        "statsreminder"
      )

      .setDescription(
        "Send the weekly stats update reminder."
      )

      .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageGuild
      ),


  async execute(
    interaction
  ) {

    await interaction.deferReply({
      ephemeral: true
    });


    try {

      // ======================================================
      // CHECK CURRENT WEEK
      // ======================================================
      //
      // Monday 00:00 → Sunday/current time
      //
      // A player is considered updated if they have submitted
      // at least one /stats submission during the current week.
      // ======================================================

      const missingMembers =
        await getMembersMissingWeeklyStats();


      console.log(

        "[STATS REMINDER] Members requiring update:",

        missingMembers.length

      );


      if (
        missingMembers.length === 0
      ) {

        await interaction.editReply({

          content:

            "✅ **No reminder was sent.**\n\n" +

            "Everyone has submitted their updated stats this week."

        });


        return;

      }


      // ======================================================
      // SEND REMINDER
      // ======================================================

      const result =
        await runWeeklyStatsReminder(
          interaction.client
        );


      await interaction.editReply({

        content:

          "✅ **Weekly stats reminder triggered.**\n\n" +

          `Members requiring an update: **${missingMembers.length}**\n` +

          `Members successfully tagged: **${result.tagged}**\n` +

          `Members not found on Discord: **${result.unresolved}**\n\n` +

          "**Stats period:** Monday → Sunday"

      });


    } catch (
      error
    ) {

      console.error(

        "[STATS REMINDER] Manual reminder failed:",

        error

      );


      try {

        await interaction.editReply({

          content:

            "❌ **Failed to send the stats reminder.**\n\n" +

            "`" +

            String(
              error.message ||
              error
            ) +

            "`"

        });

      } catch (
        replyError
      ) {

        console.error(

          "[STATS REMINDER] Could not update command response:",

          replyError

        );

      }

    }

  }

};