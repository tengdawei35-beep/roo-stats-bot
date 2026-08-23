const {
  SlashCommandBuilder,
  MessageFlags
} = require("discord.js");

const {
  findMemberByDiscordUsername,
  getLatestStatsForPlayer
} = require("../services/sheets");


// ============================================================
// COMMAND
// ============================================================

const data =
  new SlashCommandBuilder()

    .setName("check")

    .setDescription(
      "View your most recently submitted stats."
    );


// ============================================================
// HELPERS
// ============================================================

function isFilled(value) {

  return (
    value !== null &&
    value !== undefined &&
    String(value).trim() !== ""
  );

}


function value(value) {

  if (
    !isFilled(value)
  ) {

    return "N/A";

  }

  return String(value);

}


function percent(value) {

  if (
    !isFilled(value)
  ) {

    return "N/A";

  }

  return String(value) + "%";

}


// ============================================================
// TIMESTAMP
// ============================================================

function formatTimestamp(
  timestamp
) {

  if (
    !timestamp
  ) {

    return "Unknown";

  }


  const date =
    new Date(
      timestamp
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(
      timestamp
    );

  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {

      timeZone:
        "Asia/Kuala_Lumpur",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false

    }
  ).format(
    date
  );

}


// ============================================================
// GET HEADER VALUE
// ============================================================
//
// Your sheets.js returns a flat object using the actual
// Google Sheet header names as keys.
//
// This helper allows us to support multiple possible headers.
// ============================================================

function getField(
  stats,
  aliases
) {

  if (
    !Array.isArray(
      aliases
    )
  ) {

    aliases = [
      aliases
    ];

  }


  for (
    const alias of aliases
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        stats,
        alias
      )
    ) {

      const value =
        stats[alias];


      if (
        isFilled(value)
      ) {

        return value;

      }

    }

  }


  return null;

}


// ============================================================
// BUILD RESPONSE
// ============================================================

function buildStatsMessage(
  stats,
  playerName
) {

  const jobClass =
    getField(
      stats,
      [
        "Job Class (First Choice)",
        "Job Class",
        "Main Class"
      ]
    );


  const timestamp =
    getField(
      stats,
      [
        "Timestamp"
      ]
    );


  const hp =
    getField(
      stats,
      [
        "HP"
      ]
    );


  const patk =
    getField(
      stats,
      [
        "PATK",
        "PATK "
      ]
    );


  const matk =
    getField(
      stats,
      [
        "MATK",
        "MATK "
      ]
    );


  const pdef =
    getField(
      stats,
      [
        "PDEF (w/o buffs)",
        "PDEF",
        "Raw PDEF"
      ]
    );


  const mdef =
    getField(
      stats,
      [
        "MDEF (w/o buffs)",
        "MDEF",
        "Raw MDEF"
      ]
    );


  const pdmg =
    getField(
      stats,
      [
        "PDMG %",
        "PDMG"
      ]
    );


  const mdmg =
    getField(
      stats,
      [
        "MDMG %",
        "MDMG"
      ]
    );


  const pdmgReduction =
    getField(
      stats,
      [
        "PDMG Reduction %",
        "PDMG Reduction",
        "PDMG-R",
        "PDMG.R"
      ]
    );


  const mdmgReduction =
    getField(
      stats,
      [
        "MDMG Reduction %",
        "MDMG Reduction",
        "MDMG-R",
        "MDMG.R"
      ]
    );


  const critRes =
    getField(
      stats,
      [
        "Crit RES",
        "Crit Res"
      ]
    );


  const ignorePDEF =
    getField(
      stats,
      [
        "Ignore PDEF"
      ]
    );


  const ignoreMDEF =
    getField(
      stats,
      [
        "Ignore MDEF"
      ]
    );


  const pvpBonus =
    getField(
      stats,
      [
        "PvP Bonus",
        "PVP Bonus",
        "PVP Dmg Bonus",
        "PvP Dmg Bonus",
        "PVP DMG Bonus",
        "PvP DMG Bonus"
      ]
    );


  const pvpReduction =
    getField(
      stats,
      [
        "PvP Reduction",
        "PVP Reduction",
        "PVP Dmg Reduction",
        "PvP Dmg Reduction",
        "PVP DMG Reduction",
        "PvP DMG Reduction"
      ]
    );


  const mediumDamage =
    getField(
      stats,
      [
        "Medium Damage",
        "DMG vs Medium Enemies",
        "DMG vs MEDIUM ENEMIES"
      ]
    );


  const mediumReduction =
    getField(
      stats,
      [
        "Medium Reduction",
        "DMG Reduction vs Medium Enemies",
        "DMG REDUCTION vs MEDIUM ENEMIES"
      ]
    );


  const demiDamage =
    getField(
      stats,
      [
        "Demi Damage",
        "Demi-Human Damage",
        "DMG vs Demi-Human",
        "DMG vs DEMI-HUMAN"
      ]
    );


  const demiReduction =
    getField(
      stats,
      [
        "Demi Reduction",
        "Demi-Human Reduction",
        "DMG Reduction vs Demi-Human",
        "DMG REDUCTION vs DEMI-HUMAN"
      ]
    );


  const equipmentPDEF =
    getField(
      stats,
      [
        "Equipment PDEF",
        "Equipment PDEF %"
      ]
    );


  const equipmentMDEF =
    getField(
      stats,
      [
        "Equipment MDEF",
        "Equipment MDEF %"
      ]
    );


  return (

    "## 📊 Your Latest ROOC Stats\n\n" +

    "**Name:** " +
    value(playerName) +

    "\n" +

    "**Class:** " +
    value(jobClass) +

    "\n" +

    "**Last Updated:** " +
    formatTimestamp(timestamp) +

    "\n\n" +

    "### General\n" +

    "HP: **" +
    value(hp) +

    "** | PATK: **" +
    value(patk) +

    "** | MATK: **" +
    value(matk) +

    "**\n\n" +

    "### Defense\n" +

    "PDEF: **" +
    value(pdef) +

    "** | MDEF: **" +
    value(mdef) +

    "**\n\n" +

    "### Combat\n" +

    "PDMG: **" +
    percent(pdmg) +

    "** | MDMG: **" +
    percent(mdmg) +

    "**\n" +

    "PDMG-R: **" +
    percent(pdmgReduction) +

    "** | MDMG-R: **" +
    percent(mdmgReduction) +

    "**\n" +

    "Crit RES: **" +
    value(critRes) +

    "**\n" +

    "Ignore PDEF: **" +
    value(ignorePDEF) +

    "** | Ignore MDEF: **" +
    value(ignoreMDEF) +

    "**\n\n" +

    "### PvP\n" +

    "Bonus: **" +
    value(pvpBonus) +

    "** | Reduction: **" +
    value(pvpReduction) +

    "**\n\n" +

    "### Target Damage\n" +

    "Medium: **" +
    percent(mediumDamage) +

    " / " +

    percent(mediumReduction) +

    "**\n" +

    "Demi-Human: **" +
    percent(demiDamage) +

    " / " +

    percent(demiReduction) +

    "**\n\n" +

    "### Equipment\n" +

    "PDEF: **" +
    percent(equipmentPDEF) +

    "** | MDEF: **" +
    percent(equipmentMDEF) +

    "**"

  );

}


// ============================================================
// EXECUTE
// ============================================================

async function execute(
  interaction
) {

  console.log(

    "[CHECK] /check:",

    interaction.user.tag,

    "| ID:",

    interaction.user.id

  );


  // ==========================================================
  // ACKNOWLEDGE IMMEDIATELY
  // ==========================================================

  await interaction.deferReply({

    flags:
      MessageFlags.Ephemeral

  });


  try {

    // ========================================================
    // FIND PLAYER
    // ========================================================

    const member =
      await findMemberByDiscordUsername(
        interaction.user.username
      );


    if (
      !member
    ) {

      await interaction.editReply({

        content:

          "❌ **Your Discord account is not linked to a player.**\n\n" +

          "Please contact an administrator to have your Discord username added to the Members List."

      });


      return;

    }


    console.log(

      "[CHECK] Linked player:",

      member.name

    );


    // ========================================================
    // GET LATEST SUBMISSION
    // ========================================================

    const latestStats =
      await getLatestStatsForPlayer(
        member.name
      );


    if (
      !latestStats
    ) {

      await interaction.editReply({

        content:

          "📊 **No stats submission found.**\n\n" +

          "You have not submitted your stats yet.\n\n" +

          "Use `/stats` to submit your current stats."

      });


      return;

    }


    console.log(

      "[CHECK] Latest submission found:",

      member.name

    );


    // ========================================================
    // BUILD RESPONSE
    // ========================================================

    const content =
      buildStatsMessage(
        latestStats,
        member.name
      );


    // ========================================================
    // PRIVATE RESPONSE
    // ========================================================

    await interaction.editReply({

      content

    });


  } catch (
    error
  ) {

    console.error(
      "[CHECK] Error:",
      error
    );


    try {

      await interaction.editReply({

        content:

          "❌ **Unable to retrieve your stats.**\n\n" +

          "Please try again later."

      });

    } catch (
      replyError
    ) {

      console.error(

        "[CHECK] Could not update response:",

        replyError

      );

    }

  }

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  data,

  execute

};