const {
  findMemberByDiscordUsername,
  submitStats
} = require("../services/sheets");

const {
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  MessageFlags
} = require("discord.js");

const {
  JOB_CLASSES
} = require("../data/jobClasses");

const {
  extractStats
} = require("../services/ocr");


// ============================================================
// COMMAND
// ============================================================

const data =
  new SlashCommandBuilder()
    .setName("stats")
    .setDescription(
      "Submit your ROO player stats"
    );


// ============================================================
// REQUIRED STATS
// ============================================================
//
// Cards are intentionally NOT included.
//
// Cards are automatically written as "2-star" by sheets.js.
//
// ============================================================

const REQUIRED_STATS = [

  {
    key: "pdef",
    label: "PDEF (w/o buffs)"
  },

  {
    key: "mdef",
    label: "MDEF (w/o buffs)"
  },

  {
    key: "pvpBonus",
    label: "PVP Dmg Bonus"
  },

  {
    key: "pvpReduction",
    label: "PVP Dmg Reduction"
  },

  {
    key: "pdmg",
    label: "PDMG %"
  },

  {
    key: "mdmg",
    label: "MDMG %"
  },

  {
    key: "pdmgReduction",
    label: "PDMG Reduction %"
  },

  {
    key: "mdmgReduction",
    label: "MDMG Reduction %"
  },

  {
    key: "critRes",
    label: "Crit RES"
  },

  {
    key: "ignorePDEF",
    label: "Ignore PDEF"
  },

  {
    key: "ignoreMDEF",
    label: "Ignore MDEF"
  },

  {
    key: "mediumDamage",
    label: "DMG vs Medium Enemies"
  },

  {
    key: "mediumReduction",
    label: "DMG Reduction vs Medium Enemies"
  },

  {
    key: "demiDamage",
    label: "DMG vs Demi-Human"
  },

  {
    key: "demiReduction",
    label: "DMG Reduction vs Demi-Human"
  },

  {
    key: "equipmentPDEF",
    label: "Equipment PDEF %"
  },

  {
    key: "equipmentMDEF",
    label: "Equipment MDEF %"
  },

  {
    key: "patk",
    label: "PATK"
  },

  {
    key: "matk",
    label: "MATK"
  },

  {
    key: "hp",
    label: "HP"
  }

];


// ============================================================
// VALUE HELPERS
// ============================================================

function isFilled(value) {

  if (value === 0) {
    return true;
  }

  if (
    value === null ||
    value === undefined
  ) {
    return false;
  }

  if (
    typeof value === "string" &&
    value.trim() === ""
  ) {
    return false;
  }

  return true;
}


function getMissingStats(stats) {

  return REQUIRED_STATS
    .filter(
      function(field) {

        return !isFilled(
          stats[field.key]
        );

      }
    )
    .map(
      function(field) {

        return field.label;

      }
    );

}


function formatValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "❓ Missing";

  }

  return String(value);

}


function safeDiscordContent(content) {

  const MAX_LENGTH = 1900;

  if (
    content.length <= MAX_LENGTH
  ) {

    return content;

  }

  return (
    content.substring(
      0,
      MAX_LENGTH - 100
    ) +
    "\n\n⚠️ Some information has been shortened."
  );

}


function parseManualNumber(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }

  const text =
    String(value)
      .trim()
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();

  if (!text) {
    return null;
  }

  const number =
    Number(text);

  if (
    !Number.isFinite(number)
  ) {

    return null;

  }

  return number;

}


// ============================================================
// JOB CLASS MENU
// ============================================================

function buildJobClassMenu() {

  const options =
    JOB_CLASSES
      .slice(0, 25)
      .map(
        function(jobClass) {

          return new StringSelectMenuOptionBuilder()

            .setLabel(
              String(jobClass).slice(0, 100)
            )

            .setValue(
              String(jobClass).slice(0, 100)
            );

        }
      );


  return new StringSelectMenuBuilder()

    .setCustomId(
      "stats_job_class"
    )

    .setPlaceholder(
      "Select your job class"
    )

    .setMinValues(1)

    .setMaxValues(1)

    .addOptions(
      options
    );

}


// ============================================================
// CONFIRMATION BUTTONS
// ============================================================

function buildConfirmationButtons(token) {

  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()

        .setCustomId(
          "stats_confirm_" +
          token
        )

        .setLabel(
          "Confirm"
        )

        .setStyle(
          ButtonStyle.Success
        ),

      new ButtonBuilder()

        .setCustomId(
          "stats_edit_" +
          token
        )

        .setLabel(
          "Edit"
        )

        .setStyle(
          ButtonStyle.Secondary
        )

    );

}


// ============================================================
// EDIT MENU
// ============================================================

function buildStatsEditMenu(
  token,
  stats
) {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "stats_edit_field_" +
        token
      )

      .setPlaceholder(
        "Select a stat to edit"
      );


  REQUIRED_STATS.forEach(
    function(field) {

      const value =
        stats[field.key];


      const description =
        isFilled(value)

          ? "Current: " +
            String(value).slice(0, 45)

          : "Currently missing";


      menu.addOptions(

        new StringSelectMenuOptionBuilder()

          .setLabel(
            field.label.slice(0, 100)
          )

          .setDescription(
            description.slice(0, 100)
          )

          .setValue(
            field.key
          )

      );

    }
  );


  return new ActionRowBuilder()
    .addComponents(
      menu
    );

}


// ============================================================
// FIND FIELD
// ============================================================

function findStatField(key) {

  return REQUIRED_STATS.find(
    function(field) {

      return field.key === key;

    }
  );

}


// ============================================================
// CONFIRMATION MESSAGE
// ============================================================

function buildConfirmationText(
  stats,
  playerName,
  selectedClass,
  missingStats
) {

  let content =

    "## 🔍 ROOC Stats Confirmation\n\n" +

    "**Name:** " +
    formatValue(playerName) +
    " **Class:** " +
    formatValue(selectedClass) +
    "\n\n" +

    "### General\n" +

    "HP: **" +
    formatValue(stats.hp) +
    "** | PATK: **" +
    formatValue(stats.patk) +
    "** | MATK: **" +
    formatValue(stats.matk) +
    "**\n\n" +

    "### Defense\n" +

    "PDEF: **" +
    formatValue(stats.pdef) +
    "** | MDEF: **" +
    formatValue(stats.mdef) +
    "**\n\n" +

    "### Combat\n" +

    "PDMG: **" +
    formatValue(stats.pdmg) +
    "%** | MDMG: **" +
    formatValue(stats.mdmg) +
    "%**\n" +

    "PDMG-R: **" +
    formatValue(stats.pdmgReduction) +
    "%** | MDMG-R: **" +
    formatValue(stats.mdmgReduction) +
    "%**\n" +

    "Crit RES: **" +
    formatValue(stats.critRes) +
    "**\n" +

    "Ignore PDEF: **" +
    formatValue(stats.ignorePDEF) +
    "** | Ignore MDEF: **" +
    formatValue(stats.ignoreMDEF) +
    "**\n\n" +

    "### PvP\n" +

    "Bonus: **" +
    formatValue(stats.pvpBonus) +
    "** | Reduction: **" +
    formatValue(stats.pvpReduction) +
    "**\n\n" +

    "### Target Damage\n" +

    "Medium: **" +
    formatValue(stats.mediumDamage) +
    "% / " +
    formatValue(stats.mediumReduction) +
    "%**\n" +

    "Demi-Human: **" +
    formatValue(stats.demiDamage) +
    "% / " +
    formatValue(stats.demiReduction) +
    "%**\n\n" +

    "### Equipment\n" +

    "PDEF: **" +
    formatValue(stats.equipmentPDEF) +
    "%** | MDEF: **" +
    formatValue(stats.equipmentMDEF) +
    "%**\n\n";


  if (
    missingStats.length === 0
  ) {

    content +=

      "### ✅ Ready to Submit\n\n" +

      "All required stats have been filled.\n\n" +

      "Cards will automatically be recorded as **2-star**.\n\n" +

      "Press **Confirm** to submit.\n" +

      "Press **Edit** to correct any values.";

  } else {

    content +=

      "### ⚠️ Missing Information\n\n" +

      "**Stats:**\n" +

      missingStats
        .map(
          function(field) {

            return "• " + field;

          }
        )
        .join("\n") +

      "\n\n" +

      "❌ **Submission is blocked until every required stat has a value.**\n\n" +

      "Press **Edit** to enter the missing values.";

  }


  return content;

}


// ============================================================
// FINAL REFRESHED MESSAGE
// ============================================================

function buildFinalMessage(
  stats,
  refreshedPlayer,
  playerName,
  selectedClass,
  refreshSucceeded,
  refreshError
) {

  const profile =
    refreshedPlayer || {};


  function profileValue(
    aliases,
    fallback
  ) {

    const keys =
      Object.keys(profile);


    for (
      const alias of aliases
    ) {

      const normalizedAlias =
        String(alias)
          .trim()
          .toLowerCase();


      const matchingKey =
        keys.find(
          function(key) {

            return (
              String(key)
                .trim()
                .toLowerCase() ===
              normalizedAlias
            );

          }
        );


      if (
        matchingKey !== undefined &&
        profile[matchingKey] !== ""
      ) {

        return profile[matchingKey];

      }

    }


    return fallback;

  }


  const hp =
    profileValue(
      ["HP"],
      stats.hp
    );

  const patk =
    profileValue(
      ["PATK"],
      stats.patk
    );

  const matk =
    profileValue(
      ["MATK"],
      stats.matk
    );

  const pdef =
    profileValue(
      ["PDEF (w/o buffs)", "PDEF"],
      stats.pdef
    );

  const mdef =
    profileValue(
      ["MDEF (w/o buffs)", "MDEF"],
      stats.mdef
    );

  const pdmg =
    profileValue(
      ["PDMG %", "PDMG"],
      stats.pdmg
    );

  const mdmg =
    profileValue(
      ["MDMG %", "MDMG"],
      stats.mdmg
    );

  const pdmgReduction =
    profileValue(
      ["PDMG Reduction", "PDMG Reduction %"],
      stats.pdmgReduction
    );

  const mdmgReduction =
    profileValue(
      ["MDMG Reduction", "MDMG Reduction %"],
      stats.mdmgReduction
    );

  const critRes =
    profileValue(
      ["Crit RES", "Crit Res"],
      stats.critRes
    );

  const ignorePDEF =
    profileValue(
      ["Ignore PDEF"],
      stats.ignorePDEF
    );

  const ignoreMDEF =
    profileValue(
      ["Ignore MDEF"],
      stats.ignoreMDEF
    );

  const pvpBonus =
    profileValue(
      [
        "PVP Dmg Bonus",
        "PvP Dmg Bonus",
        "PVP DMG Bonus",
        "PvP DMG Bonus"
      ],
      stats.pvpBonus
    );

  const pvpReduction =
    profileValue(
      [
        "PVP Dmg Reduction",
        "PvP Dmg Reduction",
        "PVP DMG Reduction",
        "PvP DMG Reduction"
      ],
      stats.pvpReduction
    );

  const mediumDamage =
    profileValue(
      [
        "Medium Damage",
        "DMG vs Medium Enemies"
      ],
      stats.mediumDamage
    );

  const mediumReduction =
    profileValue(
      [
        "Medium Reduction",
        "DMG Reduction vs Medium Enemies"
      ],
      stats.mediumReduction
    );

  const demiDamage =
    profileValue(
      [
        "Demi-Human Damage",
        "DMG vs Demi-Human"
      ],
      stats.demiDamage
    );

  const demiReduction =
    profileValue(
      [
        "Demi-Human Reduction",
        "DMG Reduction vs Demi-Human"
      ],
      stats.demiReduction
    );

  const equipmentPDEF =
    profileValue(
      [
        "Equipment PDEF",
        "Equipment PDEF %"
      ],
      stats.equipmentPDEF
    );

  const equipmentMDEF =
    profileValue(
      [
        "Equipment MDEF",
        "Equipment MDEF %"
      ],
      stats.equipmentMDEF
    );


  let content =

    "## ✅ ROOC Stats Updated\n\n" +

    "**Name:** " +
    playerName +
    " **Class:** " +
    selectedClass +
    "\n\n" +

    "### General\n" +

    "HP: **" +
    formatValue(hp) +
    "** | PATK: **" +
    formatValue(patk) +
    "** | MATK: **" +
    formatValue(matk) +
    "**\n\n" +

    "### Defense\n" +

    "PDEF: **" +
    formatValue(pdef) +
    "** | MDEF: **" +
    formatValue(mdef) +
    "**\n\n" +

    "### Combat\n" +

    "PDMG: **" +
    formatValue(pdmg) +
    "%** | MDMG: **" +
    formatValue(mdmg) +
    "%**\n" +

    "PDMG-R: **" +
    formatValue(pdmgReduction) +
    "%** | MDMG-R: **" +
    formatValue(mdmgReduction) +
    "%**\n" +

    "Crit RES: **" +
    formatValue(critRes) +
    "**\n" +

    "Ignore PDEF: **" +
    formatValue(ignorePDEF) +
    "** | Ignore MDEF: **" +
    formatValue(ignoreMDEF) +
    "**\n\n" +

    "### PvP\n" +

    "Bonus: **" +
    formatValue(pvpBonus) +
    "** | Reduction: **" +
    formatValue(pvpReduction) +
    "**\n\n" +

    "### Target Damage\n" +

    "Medium: **" +
    formatValue(mediumDamage) +
    "% / " +
    formatValue(mediumReduction) +
    "%**\n" +

    "Demi-Human: **" +
    formatValue(demiDamage) +
    "% / " +
    formatValue(demiReduction) +
    "%**\n\n" +

    "### Equipment\n" +

    "PDEF: **" +
    formatValue(equipmentPDEF) +
    "%** | MDEF: **" +
    formatValue(equipmentMDEF) +
    "%**\n\n";


  if (
    refreshSucceeded
  ) {

    content +=

      "✅ **Stats Submission updated**\n" +
      "✅ **Reports refreshed**\n" +
      "✅ **Cards set to 2-star**";

  } else {

    content +=

      "⚠️ **Stats were submitted, but the reports could not be refreshed.**\n\n" +
      "Please contact an administrator.";

    if (
      refreshError
    ) {

      content +=

        "\n\n`" +
        String(
          refreshError
        ).slice(0, 300) +
        "`";

    }

  }


  return safeDiscordContent(
    content
  );

}


// ============================================================
// EXECUTE
// ============================================================

async function execute(
  interaction
) {

  // ==========================================================
  // JOB CLASS
  // ==========================================================

  const jobRow =
    new ActionRowBuilder()
      .addComponents(
        buildJobClassMenu()
      );


  await interaction.reply({

    content:

      "## 📊 ROO Stats Submission\n\n" +

      "Select your **main job class**.\n\n" +

      "This will be recorded as your **Job Class (First Choice)**.",

    components: [
      jobRow
    ],

    flags:
      MessageFlags.Ephemeral

  });


  // ==========================================================
  // WAIT FOR JOB CLASS
  // ==========================================================

  let selection;

  try {

    selection =
      await interaction.channel.awaitMessageComponent({

        componentType:
          ComponentType.StringSelect,

        time:
          120000,

        filter:
          function(componentInteraction) {

            return (
              componentInteraction.user.id ===
              interaction.user.id &&

              componentInteraction.customId ===
              "stats_job_class"
            );

          }

      });

  } catch (error) {

    await interaction.editReply({

      content:
        "⏱️ Job class selection timed out.\n\n" +
        "Please run `/stats` again.",

      components: []

    });

    return;

  }


  const selectedClass =
    selection.values[0];


  // ==========================================================
  // ASK FOR SCREENSHOTS
  // ==========================================================

  await selection.update({

    content:

      "## 📊 ROO Stats Submission\n\n" +

      "**Job Class:** " +
      selectedClass +
      "\n\n" +

      "### 📸 Upload your screenshots\n\n" +

      "Send **one new message** containing your ROO stat screenshots.\n\n" +

      "You may attach multiple screenshots to the same message.\n\n" +

      "Required screenshots should include:\n" +

      "• General Stats\n" +
      "• Combat / Quasi-Stats\n" +
      "• Equipment Stats\n" +
      "• PDEF Notice\n" +
      "• MDEF Notice\n\n" +

      "⏱️ You have **2 minutes** to upload your screenshots.",

    components: []

  });


  // ==========================================================
  // SCREENSHOT COLLECTOR
  // ==========================================================

  const collector =
    interaction.channel.createMessageCollector({

      time:
        120000,

      filter:
        function(message) {

          return (
            message.author.id ===
            interaction.user.id
          );

        }

    });


  collector.on(
    "collect",
    async function(message) {

      if (
        message.attachments.size === 0
      ) {

        return;

      }


      collector.stop(
        "screenshots_received"
      );


      const imageAttachments =
        [
          ...message.attachments.values()
        ]
        .filter(
          function(attachment) {

            const filename =
              String(
                attachment.name || ""
              ).toLowerCase();

            const contentType =
              String(
                attachment.contentType || ""
              ).toLowerCase();


            return (
              /\.(png|jpg|jpeg|webp|gif)$/i.test(
                filename
              ) ||
              contentType.startsWith(
                "image/"
              )
            );

          }
        );


      if (
        imageAttachments.length === 0
      ) {

        await interaction.followUp({

          content:
            "❌ I couldn't identify any image files in that message.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      await interaction.followUp({

        content:

          "🔍 Found **" +
          imageAttachments.length +
          "** screenshot(s).\n\n" +

          "Reading your stats...",

        flags:
          MessageFlags.Ephemeral

      });


      const imageUrls =
        imageAttachments.map(
          function(attachment) {
            return attachment.url;
          }
        );


      // ======================================================
      // OCR
      // ======================================================

      let stats;

      try {

        stats =
          await extractStats(
            imageUrls
          );

      } catch (error) {

        console.error(
          "[STATS] OCR ERROR:",
          error
        );

        await interaction.followUp({

          content:
            "❌ OCR failed while reading the screenshots.\n\n" +
            "Please try again with clearer screenshots.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      console.log(
        "[STATS] OCR RESULT:",
        stats
      );


      // ======================================================
      // MEMBER LOOKUP
      // ======================================================

      const discordUsername =
        interaction.user.username;


      let member;

      try {

        member =
          await findMemberByDiscordUsername(
            discordUsername
          );

      } catch (error) {

        console.error(
          "[STATS] Member lookup error:",
          error
        );

        await interaction.followUp({

          content:
            "❌ I couldn't access the Members List right now.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      if (!member) {

        await interaction.followUp({

          content:

            "❌ Your Discord username is not linked to a player in the **Members List**.\n\n" +

            "Please contact an administrator.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      const playerName =
        member.name ||
        stats.name ||
        "";


      // ======================================================
      // VALIDATE
      // ======================================================

      let missingStats =
        getMissingStats(
          stats
        );


      // ======================================================
      // UNIQUE TOKEN
      // ======================================================

      const token =
        Date.now().toString(36) +
        "_" +
        interaction.user.id.slice(-8);


      // ======================================================
      // CONFIRMATION
      // ======================================================

      const confirmationContent =
        safeDiscordContent(

          buildConfirmationText(
            stats,
            playerName,
            selectedClass,
            missingStats
          )

        );


      /*
       * IMPORTANT:
       *
       * This remains ephemeral.
       *
       * We keep the returned message ID and later edit it
       * using interaction.webhook.editMessage().
       */

      const confirmationMessage =
        await interaction.followUp({

          content:
            confirmationContent,

          components: [
            buildConfirmationButtons(
              token
            )
          ],

          flags:
            MessageFlags.Ephemeral,

          fetchReply:
            true

        });


      console.log(
        "[STATS] Confirmation message ID:",
        confirmationMessage.id
      );


      // ======================================================
      // CONFIRMATION COLLECTOR
      // ======================================================

      const confirmationCollector =
        confirmationMessage.createMessageComponentCollector({

          time:
            600000,

          filter:
            function(componentInteraction) {

              return (
                componentInteraction.user.id ===
                interaction.user.id
              );

            }

        });


      confirmationCollector.on(
        "collect",
        async function(componentInteraction) {

          // ==================================================
          // CONFIRM
          // ==================================================

          if (
            componentInteraction.customId ===
            "stats_confirm_" +
            token
          ) {

            missingStats =
              getMissingStats(
                stats
              );


            if (
              missingStats.length > 0
            ) {

              await componentInteraction.reply({

                content:
                  safeDiscordContent(

                    "❌ **Submission blocked.**\n\n" +

                    "The following required stats are still missing:\n\n" +

                    missingStats
                      .map(
                        function(field) {

                          return "• " + field;

                        }
                      )
                      .join("\n")

                  ),

                flags:
                  MessageFlags.Ephemeral

              });

              return;

            }


            // ------------------------------------------------
            // ACKNOWLEDGE BUTTON
            // ------------------------------------------------

            try {

              await componentInteraction.deferUpdate();

            } catch (error) {

              console.error(
                "[STATS] Could not acknowledge Confirm button:",
                error
              );

              return;

            }


            // ------------------------------------------------
            // REMOVE BUTTONS IMMEDIATELY
            // ------------------------------------------------
            //
            // Because this is an ephemeral follow-up, use
            // the interaction webhook rather than
            // confirmationMessage.edit().
            //

            try {

              await interaction.webhook.editMessage(

                confirmationMessage.id,

                {

                  content:

                    safeDiscordContent(

                      buildConfirmationText(
                        stats,
                        playerName,
                        selectedClass,
                        []
                      )

                    ) +

                    "\n\n⏳ **Submitting stats and refreshing reports...**",

                  components: []

                }

              );

            } catch (error) {

              console.error(
                "[STATS] Could not update processing message:",
                error
              );

            }


            // ------------------------------------------------
            // SUBMIT TO SHEETS
            // ------------------------------------------------

            let submissionResult;

            try {

              submissionResult =
                await submitStats(
                  member,
                  selectedClass,
                  stats
                );

            } catch (error) {

              console.error(
                "[STATS] SUBMISSION ERROR:",
                error
              );


              const errorMessage =

                "## ❌ Stats Submission Failed\n\n" +

                "The submission could not be completed.\n\n" +

                "`" +
                String(
                  error.message ||
                  error
                ).slice(0, 500) +
                "`";


              try {

                await interaction.webhook.editMessage(

                  confirmationMessage.id,

                  {

                    content:
                      safeDiscordContent(
                        errorMessage
                      ),

                    components: []

                  }

                );

              } catch (editError) {

                console.error(
                  "[STATS] Could not update failed submission message:",
                  editError
                );

              }


              confirmationCollector.stop(
                "submission_failed"
              );

              return;

            }


            // ------------------------------------------------
            // FINAL MESSAGE
            // ------------------------------------------------

            const finalMessage =
              buildFinalMessage(

                stats,

                submissionResult
                  ? submissionResult.refreshedPlayer
                  : null,

                playerName,

                selectedClass,

                submissionResult
                  ? submissionResult.reportsRefreshed
                  : false,

                submissionResult
                  ? submissionResult.refreshError
                  : null

              );


            // ------------------------------------------------
            // UPDATE SAME EPHEMERAL MESSAGE
            // ------------------------------------------------

            try {

              await interaction.webhook.editMessage(

                confirmationMessage.id,

                {

                  content:
                    finalMessage,

                  components: []

                }

              );


              console.log(
                "[STATS] Final refreshed message displayed."
              );

            } catch (error) {

              console.error(
                "[STATS] Could not update confirmation message:",
                error
              );


              // ------------------------------------------------
              // FALLBACK
              // ------------------------------------------------

              try {

                await interaction.followUp({

                  content:
                    finalMessage,

                  flags:
                    MessageFlags.Ephemeral

                });

              } catch (fallbackError) {

                console.error(
                  "[STATS] Final Discord fallback failed:",
                  fallbackError
                );

              }

            }


            confirmationCollector.stop(
              "submitted"
            );

            return;

          }


          // ==================================================
          // EDIT
          // ==================================================

          if (
            componentInteraction.customId ===
            "stats_edit_" +
            token
          ) {

            await componentInteraction.update({

              content:

                "## ✏️ Edit Stats\n\n" +

                "Select a stat to edit.\n\n" +

                "Cards are automatically set to **2-star**.",

              components: [

                buildStatsEditMenu(
                  token,
                  stats
                )

              ]

            });

            return;

          }


          // ==================================================
          // SELECT STAT TO EDIT
          // ==================================================

          if (
            componentInteraction.customId ===
            "stats_edit_field_" +
            token
          ) {

            const key =
              componentInteraction.values[0];


            const field =
              findStatField(
                key
              );


            if (!field) {

              await componentInteraction.reply({

                content:
                  "❌ Invalid stat field.",

                flags:
                  MessageFlags.Ephemeral

              });

              return;

            }


            const currentValue =
              isFilled(
                stats[key]
              )
                ? String(
                    stats[key]
                  )
                : "";


            const modal =
              new ModalBuilder()

                .setCustomId(
                  "stats_modal_" +
                  token +
                  "_" +
                  key
                )

                .setTitle(
                  "Edit " +
                  field.label
                );


            const input =
              new TextInputBuilder()

                .setCustomId(
                  "value"
                )

                .setLabel(
                  field.label.slice(0, 45)
                )

                .setStyle(
                  TextInputStyle.Short
                )

                .setRequired(
                  true
                )

                .setPlaceholder(
                  "Enter numeric value"
                );


            if (currentValue) {

              input.setValue(
                currentValue
              );

            }


            modal.addComponents(

              new ActionRowBuilder()
                .addComponents(
                  input
                )

            );


            await componentInteraction.showModal(
              modal
            );


            let modalInteraction;

            try {

              modalInteraction =
                await componentInteraction.awaitModalSubmit({

                  time:
                    120000,

                  filter:
                    function(modalSubmit) {

                      return (
                        modalSubmit.user.id ===
                        interaction.user.id &&

                        modalSubmit.customId ===
                        "stats_modal_" +
                        token +
                        "_" +
                        key
                      );

                    }

                });

            } catch (error) {

              return;

            }


            const rawValue =
              modalInteraction.fields.getTextInputValue(
                "value"
              );


            const parsed =
              parseManualNumber(
                rawValue
              );


            if (
              parsed === null
            ) {

              await modalInteraction.reply({

                content:

                  "❌ Invalid numeric value.\n\n" +

                  "Enter a number such as `5199`, `45.72` or `30%`.",

                flags:
                  MessageFlags.Ephemeral

              });

              return;

            }


            stats[key] =
              parsed;


            console.log(
              "[STATS] Manual edit:",
              key,
              "=",
              parsed
            );


            missingStats =
              getMissingStats(
                stats
              );


            /*
             * The modal submission is the active interaction,
             * so update the ephemeral confirmation using
             * update().
             */

            await modalInteraction.update({

              content:
                safeDiscordContent(

                  buildConfirmationText(
                    stats,
                    playerName,
                    selectedClass,
                    missingStats
                  )

                ),

              components: [

                buildConfirmationButtons(
                  token
                )

              ]

            });


            return;

          }

        }
      );


      // ======================================================
      // DELETE SCREENSHOT MESSAGE
      // ======================================================

      try {

        await message.delete();

      } catch (error) {

        console.log(
          "[STATS] Could not delete screenshot message:",
          error.message
        );

      }

    }
  );


  // ==========================================================
  // UPLOAD COLLECTOR END
  // ==========================================================

  collector.on(
    "end",
    function(
      collected,
      reason
    ) {

      console.log(
        "[STATS] Screenshot collector ended:",
        reason,
        "| messages:",
        collected.size
      );

    }
  );

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

  data,

  execute

};