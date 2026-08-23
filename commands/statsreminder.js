const {
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const {
  getMembersMissingStatsBeforeDate
} = require("../services/sheets");

const {
  runStatsReminderBeforeAugust22
} = require("../services/weeklyStatsReminder");


module.exports = {

  data:
    new SlashCommandBuilder()

      .setName(
        "statsreminder"
      )

      .setDescription(
        "Send the stats update reminder."
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
      // TEMPORARY CUTOFF
      // ======================================================

      const cutoff =
        new Date(
          "2026-08-21T16:00:00.000Z"
        );


      console.log(

        "[STATS REMINDER] Temporary cutoff:",

        "2026-08-22 00:00 Malaysia time"

      );


      // ======================================================
      // CHECK MEMBERS
      // ======================================================

      const missingMembers =
        await getMembersMissingStatsBeforeDate(
          cutoff
        );


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

            "Everyone has updated their stats on or after **22 August 2026**."

        });


        return;

      }


      // ======================================================
      // SEND REMINDER
      // ======================================================

      const result =
        await runStatsReminderBeforeAugust22(
          interaction.client
        );


      await interaction.editReply({

        content:

          "✅ **Stats reminder triggered.**\n\n" +

          `Members requiring an update: **${missingMembers.length}**\n` +

          `Members successfully tagged: **${result.tagged}**\n` +

          `Members not found on Discord: **${result.unresolved}**\n\n` +

          "Cutoff: **22 August 2026 00:00 Malaysia time**"

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