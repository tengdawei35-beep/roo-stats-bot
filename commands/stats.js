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
// REQUIRED STAT FIELDS
// ============================================================
//
// Cards are intentionally NOT included.
//
// Cards are automatically set to 2-star by sheets.js.
//
// ============================================================

const REQUIRED_STATS = [

  {
    key: "hp",
    label: "HP"
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
    key: "pdef",
    label: "PDEF (w/o buffs)"
  },

  {
    key: "mdef",
    label: "MDEF (w/o buffs)"
  },

  {
    key: "pvpBonus",
    label: "PvP DMG Bonus"
  },

  {
    key: "pvpReduction",
    label: "PvP DMG Reduction"
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
    label: "Medium Damage"
  },

  {
    key: "mediumReduction",
    label: "Medium Reduction"
  },

  {
    key: "demiDamage",
    label: "Demi-Human Damage"
  },

  {
    key: "demiReduction",
    label: "Demi-Human Reduction"
  },

  {
    key: "equipmentPDEF",
    label: "Equipment PDEF"
  },

  {
    key: "equipmentMDEF",
    label: "Equipment MDEF"
  }

];


// ============================================================
// SUBMISSION QUEUE
// ============================================================
//
// IMPORTANT:
//
// OCR is allowed to run concurrently.
//
// Google Sheets submission + Apps Script refresh is serialized.
//
// Example:
//
// User A OCR ────────────────┐
//                            ▼
// User B OCR ────────────────┐
//                            ▼
// User C OCR ────────────────┐
//                            ▼
//
//                       Submission Queue
//                            │
//                 ┌──────────┴──────────┐
//                 ▼                     ▼
//             User A                User B
//          Sheets + Refresh      Sheets + Refresh
//                                        │
//                                        ▼
//                                      User C
//
// This prevents simultaneous Apps Script report rebuilds.
//
// ============================================================

let submissionQueue =
  Promise.resolve();


function submitStatsQueued(
  submission
) {

  const job =
    submissionQueue.then(
      async function() {

        console.log(
          "[STATS QUEUE] Starting submission for:",
          submission.name
        );

        try {

          return await submitStats(
            submission
          );

        } finally {

          console.log(
            "[STATS QUEUE] Finished submission for:",
            submission.name
          );

        }

      }
    );


  /*
   * Keep the queue alive even if one submission fails.
   *
   * The current job still receives the rejection because
   * `job` is returned to the caller.
   */

  submissionQueue =
    job.catch(
      function(error) {

        console.error(
          "[STATS QUEUE] Job failed:",
          error
        );

      }
    );


  return job;

}


// ============================================================
// VALUE HELPERS
// ============================================================

function isFilled(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return false;

  }


  if (
    typeof value === "string"
  ) {

    return value.trim() !== "";

  }


  /*
   * 0 is a valid value.
   *
   * This is important for:
   *
   * Ignore PDEF: 0
   * Ignore MDEF: 0
   * etc.
   */

  return true;

}


// ============================================================
// FORMAT VALUE
// ============================================================

function formatValue(
  value
) {

  if (
    !isFilled(
      value
    )
  ) {

    return "Missing";

  }


  return String(
    value
  );

}


// ============================================================
// FORMAT PERCENTAGE
// ============================================================

function formatPercent(
  value
) {

  if (
    !isFilled(
      value
    )
  ) {

    return "Missing";

  }


  return (
    String(
      value
    ) +
    "%"
  );

}


// ============================================================
// SAFE DISCORD CONTENT
// ============================================================

function safeDiscordContent(
  content
) {

  const MAX_LENGTH =
    1900;


  if (
    content.length <=
    MAX_LENGTH
  ) {

    return content;

  }


  return (

    content.substring(
      0,
      MAX_LENGTH - 120
    ) +

    "\n\n" +

    "⚠️ Some information was shortened. " +

    "Use **Edit** to review the fields."

  );

}


// ============================================================
// PARSE MANUAL NUMBER
// ============================================================

function parseManualNumber(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }


  let text =
    String(
      value
    )
      .trim();


  if (
    text === ""
  ) {

    return null;

  }


  text =
    text
      .replace(
        /,/g,
        ""
      )
      .replace(
        /%/g,
        ""
      )
      .trim();


  const number =
    Number(
      text
    );


  if (
    !Number.isFinite(
      number
    )
  ) {

    return null;

  }


  return number;

}


// ============================================================
// MISSING STATS
// ============================================================

function getMissingStats(
  stats
) {

  const missing = [];


  REQUIRED_STATS.forEach(
    function(field) {

      if (
        !isFilled(
          stats[
            field.key
          ]
        )
      ) {

        missing.push(
          field.label
        );

      }

    }
  );


  return missing;

}


// ============================================================
// FIND STAT FIELD
// ============================================================

function findStatField(
  key
) {

  return REQUIRED_STATS.find(
    function(field) {

      return (
        field.key ===
        key
      );

    }
  );

}


// ============================================================
// BUILD JOB CLASS MENU
// ============================================================

function buildJobClassMenu() {

  const options =
    JOB_CLASSES
      .slice(
        0,
        25
      )
      .map(
        function(jobClass) {

          return new StringSelectMenuOptionBuilder()

            .setLabel(
              String(
                jobClass
              ).slice(
                0,
                100
              )
            )

            .setValue(
              String(
                jobClass
              ).slice(
                0,
                100
              )
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

    .setMinValues(
      1
    )

    .setMaxValues(
      1
    )

    .addOptions(
      options
    );

}


// ============================================================
// BUILD CONFIRMATION BUTTONS
// ============================================================

function buildConfirmationButtons(
  token
) {

  const confirmButton =
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
      );


  const editButton =
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
      );


  return new ActionRowBuilder()
    .addComponents(
      confirmButton,
      editButton
    );

}


// ============================================================
// BUILD EDIT GROUP MENU
// ============================================================

function buildEditGroupMenu(
  token
) {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "stats_edit_group_" +
        token
      )

      .setPlaceholder(
        "Choose what you want to edit"
      )

      .addOptions(

        new StringSelectMenuOptionBuilder()

          .setLabel(
            "Stats"
          )

          .setDescription(
            "Edit OCR-detected player stats"
          )

          .setValue(
            "stats"
          )

      );


  return new ActionRowBuilder()
    .addComponents(
      menu
    );

}


// ============================================================
// BUILD STATS EDIT MENU
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

      const current =
        stats[
          field.key
        ];


      const description =
        isFilled(
          current
        )

          ? "Current: " +
            String(
              current
            ).slice(
              0,
              45
            )

          : "Currently missing";


      menu.addOptions(

        new StringSelectMenuOptionBuilder()

          .setLabel(
            field.label.slice(
              0,
              100
            )
          )

          .setDescription(
            description.slice(
              0,
              100
            )
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
// BUILD COMPACT CONFIRMATION
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
    formatValue(
      playerName
    ) +

    "\n" +

    "**Class:** " +
    formatValue(
      selectedClass
    ) +

    "\n\n" +


    "### General\n" +

    "HP: **" +
    formatValue(
      stats.hp
    ) +

    "** | PATK: **" +
    formatValue(
      stats.patk
    ) +

    "** | MATK: **" +
    formatValue(
      stats.matk
    ) +

    "**\n\n" +


    "### Defense\n" +

    "PDEF: **" +
    formatValue(
      stats.pdef
    ) +

    "** | MDEF: **" +
    formatValue(
      stats.mdef
    ) +

    "**\n\n" +


    "### Combat\n" +

    "PDMG: **" +
    formatPercent(
      stats.pdmg
    ) +

    "** | MDMG: **" +
    formatPercent(
      stats.mdmg
    ) +

    "**\n" +

    "PDMG-R: **" +
    formatPercent(
      stats.pdmgReduction
    ) +

    "** | MDMG-R: **" +
    formatPercent(
      stats.mdmgReduction
    ) +

    "**\n" +

    "Crit RES: **" +
    formatValue(
      stats.critRes
    ) +

    "**\n" +

    "Ignore PDEF: **" +
    formatValue(
      stats.ignorePDEF
    ) +

    "** | Ignore MDEF: **" +
    formatValue(
      stats.ignoreMDEF
    ) +

    "**\n\n" +


    "### PvP\n" +

    "Bonus: **" +
    formatValue(
      stats.pvpBonus
    ) +

    "** | Reduction: **" +
    formatValue(
      stats.pvpReduction
    ) +

    "**\n\n" +


    "### Target Damage\n" +

    "Medium: **" +
    formatPercent(
      stats.mediumDamage
    ) +

    " / " +
    formatPercent(
      stats.mediumReduction
    ) +

    "**\n" +

    "Demi-Human: **" +
    formatPercent(
      stats.demiDamage
    ) +

    " / " +
    formatPercent(
      stats.demiReduction
    ) +

    "**\n\n" +


    "### Equipment\n" +

    "PDEF: **" +
    formatPercent(
      stats.equipmentPDEF
    ) +

    "** | MDEF: **" +
    formatPercent(
      stats.equipmentMDEF
    ) +

    "**\n\n";


  // ==========================================================
  // VALIDATION
  // ==========================================================

  if (
    missingStats.length === 0
  ) {

    content +=

      "### ✅ Ready to Submit\n\n" +

      "All required stats have been detected.\n\n" +

      "⚠️ **Please verify your stats before submitting.**\n\n" +

      "Press **Confirm** to submit.\n" +

      "Press **Edit** to correct any values.";

  } else {

    content +=

      "### ⚠️ Missing Information\n\n" +

      "**Stats:** " +

      missingStats.join(
        ", "
      ) +

      "\n\n" +

      "❌ **Submission is blocked until all required stats have a value.**\n\n" +

      "Press **Edit** to enter the missing values.";

  }


  return content;

}


// ============================================================
// EXECUTE
// ============================================================

async function execute(
  interaction
) {

  const userId =
    interaction.user.id;


  const discordUsername =
    interaction.user.username;


  console.log(
    "[STATS] Starting /stats for:",
    interaction.user.tag,
    "| ID:",
    userId
  );


  // ==========================================================
  // JOB CLASS
  // ==========================================================

  const jobMenu =
    buildJobClassMenu();


  const jobRow =
    new ActionRowBuilder()
      .addComponents(
        jobMenu
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
              userId &&

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
  // UPDATE TO UPLOAD SCREEN
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

      "Required information should include:\n" +

      "• General Stats\n" +

      "• Quasi-Stats\n" +

      "• Equipment / Damage Stats\n" +

      "• PDEF Notice\n" +

      "• MDEF Notice\n\n" +

      "ℹ️ **Card information is not required. Cards will automatically be recorded as 2-star.**\n\n" +

      "⏱️ You have **2 minutes** to upload your screenshots.",

    components: []

  });


  // ==========================================================
  // UPLOAD COLLECTOR
  // ==========================================================
  //
  // This collector belongs ONLY to this /stats session.
  //
  // Multiple users can therefore have collectors running
  // simultaneously.
  //
  // ==========================================================

  const channel =
    interaction.channel;


  const collector =
    channel.createMessageCollector({

      time:
        120000,

      filter:
        function(message) {

          /*
           * Only accept messages from the user who invoked
           * this particular /stats session.
           */

          return (
            message.author.id ===
            userId
          );

        }

    });


  collector.on(
    "collect",
    async function(message) {

      console.log(
        "[STATS] Screenshot message received:",
        message.id,
        "| User:",
        message.author.tag,
        "| Attachments:",
        message.attachments.size
      );


      // ------------------------------------------------------
      // IGNORE MESSAGES WITHOUT ATTACHMENTS
      // ------------------------------------------------------

      if (
        message.attachments.size === 0
      ) {

        return;

      }


      /*
       * Stop ONLY this user's collector.
       *
       * Other /stats sessions have their own collectors.
       */

      collector.stop(
        "screenshots_received"
      );


      // ------------------------------------------------------
      // FIND IMAGES
      // ------------------------------------------------------

      const imageAttachments =
        [
          ...message.attachments.values()
        ]
        .filter(
          function(attachment) {

            const filename =
              String(
                attachment.name ||
                ""
              ).toLowerCase();


            const contentType =
              String(
                attachment.contentType ||
                ""
              ).toLowerCase();


            const extensionIsImage =
              /\.(png|jpg|jpeg|webp|gif)$/i
                .test(
                  filename
                );


            const contentTypeIsImage =
              contentType.startsWith(
                "image/"
              );


            return (
              extensionIsImage ||
              contentTypeIsImage
            );

          }
        );


      console.log(
        "[STATS] Image count:",
        imageAttachments.length
      );


      if (
        imageAttachments.length === 0
      ) {

        await interaction.followUp({

          content:

            "❌ I received your message, but couldn't identify any image files.\n\n" +

            "Please upload PNG, JPG, JPEG or WEBP screenshots.",

          flags:
            MessageFlags.Ephemeral

        });


        return;

      }


      // ------------------------------------------------------
      // OCR STATUS
      // ------------------------------------------------------

      await interaction.followUp({

        content:

          "🔍 Found **" +
          imageAttachments.length +
          "** screenshot(s).\n\n" +

          "Reading your stats...\n\n" +

          "This may take a little while.",

        flags:
          MessageFlags.Ephemeral

      });


      const imageUrls =
        imageAttachments.map(
          function(attachment) {

            return attachment.url;

          }
        );


      // ------------------------------------------------------
      // OCR
      // ------------------------------------------------------

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

            "❌ The screenshots were received, but OCR failed.\n\n" +

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


      // ------------------------------------------------------
      // PLAYER LOOKUP
      // ------------------------------------------------------

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

            "❌ I couldn't access the Members List right now.\n\n" +

            "Please try again later or contact an administrator.",

          flags:
            MessageFlags.Ephemeral

        });


        return;

      }


      if (
        !member
      ) {

        await interaction.followUp({

          content:

            "❌ Your Discord username is not linked to a player in the **Members List**.\n\n" +

            "Please contact an administrator to have your Discord username linked.",

          flags:
            MessageFlags.Ephemeral

        });


        return;

      }


      console.log(
        "[STATS] Member found:",
        member
      );


      // ------------------------------------------------------
      // PLAYER NAME
      // ------------------------------------------------------

      const playerName =
        member.name ||
        stats.name ||
        "";


      // ------------------------------------------------------
      // VALIDATION
      // ------------------------------------------------------

      const missingStats =
        getMissingStats(
          stats
        );


      // ------------------------------------------------------
      // UNIQUE TOKEN
      // ------------------------------------------------------

      const token =
        Date.now().toString(
          36
        ) +

        "_" +

        userId.slice(
          -8
        ) +

        "_" +

        Math.random()
          .toString(
            36
          )
          .slice(
            2,
            8
          );


      // ------------------------------------------------------
      // CONFIRMATION
      // ------------------------------------------------------

      const confirmationContent =
        safeDiscordContent(

          buildConfirmationText(

            stats,

            playerName,

            selectedClass,

            missingStats

          )

        );


      let confirmationMessage;


      try {

        confirmationMessage =
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

      } catch (error) {

        console.error(
          "[STATS] Could not create confirmation:",
          error
        );


        return;

      }


      console.log(
        "[STATS] Confirmation message created:",
        confirmationMessage.id
      );


      console.log(
        "[STATS] Confirmation token:",
        token
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
                userId
              );

            }

        });


      confirmationCollector.on(
        "collect",
        async function(componentInteraction) {

          console.log(
            "[STATS] Confirmation component:",
            componentInteraction.customId,
            "| User:",
            componentInteraction.user.tag
          );


          // ==================================================
          // CONFIRM
          // ==================================================

          if (
            componentInteraction.customId ===
            "stats_confirm_" +
            token
          ) {

            // ------------------------------------------------
            // FINAL VALIDATION
            // ------------------------------------------------

            const finalMissingStats =
              getMissingStats(
                stats
              );


            if (
              finalMissingStats.length > 0
            ) {

              await componentInteraction.reply({

                content:

                  safeDiscordContent(

                    "❌ **Submission blocked.**\n\n" +

                    "**Missing Stats:** " +

                    finalMissingStats.join(
                      ", "
                    ) +

                    "\n\n" +

                    "Press **Edit** to enter the missing values."

                  ),

                flags:
                  MessageFlags.Ephemeral

              });


              return;

            }


            // ------------------------------------------------
            // REMOVE BUTTONS IMMEDIATELY
            // ------------------------------------------------

            try {

              await componentInteraction.update({

                content:

                  safeDiscordContent(

                    buildConfirmationText(

                      stats,

                      playerName,

                      selectedClass,

                      []

                    )

                  ) +

                  "\n\n" +

                  "⏳ **Submission queued...**",

                components: []

              });

            } catch (error) {

              console.error(
                "[STATS] Could not update confirmation:",
                error
              );


              return;

            }


            // ------------------------------------------------
            // BUILD SUBMISSION
            // ------------------------------------------------

            const submission = {

              discordUsername:
                discordUsername,

              discordId:
                userId,

              name:
                playerName,

              jobClass:
                selectedClass,

              jobClassFirst:
                selectedClass,

              jobClassSecond:
                "",

              jobClassThird:
                "",

              stats:
                stats

            };


            console.log(
              "[STATS] Final submission:"
            );


            console.log(
              JSON.stringify(
                submission,
                null,
                2
              )
            );


            // ------------------------------------------------
            // SERIALIZED SUBMISSION
            // ------------------------------------------------

            try {

              console.log(
                "[STATS QUEUE] Queuing:",
                playerName
              );


              const result =
                await submitStatsQueued(
                  submission
                );


              console.log(
                "[STATS] Stats successfully submitted:",
                playerName
              );


              // ------------------------------------------------
              // RESULT MESSAGE
              // ------------------------------------------------

              let successMessage =

                "## ✅ ROOC Stats Updated\n\n" +

                "**Name:** " +
                playerName +

                " **Class:** " +
                selectedClass +

                "\n\n" +

                "### General\n" +

                "HP: **" +
                formatValue(
                  stats.hp
                ) +

                "** | PATK: **" +
                formatValue(
                  stats.patk
                ) +

                "** | MATK: **" +
                formatValue(
                  stats.matk
                ) +

                "**\n\n" +

                "### Defense\n" +

                "PDEF: **" +
                formatValue(
                  stats.pdef
                ) +

                "** | MDEF: **" +
                formatValue(
                  stats.mdef
                ) +

                "**\n\n" +

                "### Combat\n" +

                "PDMG: **" +
                formatPercent(
                  stats.pdmg
                ) +

                "** | MDMG: **" +
                formatPercent(
                  stats.mdmg
                ) +

                "**\n" +

                "PDMG-R: **" +
                formatPercent(
                  stats.pdmgReduction
                ) +

                "** | MDMG-R: **" +
                formatPercent(
                  stats.mdmgReduction
                ) +

                "**\n" +

                "Crit RES: **" +
                formatValue(
                  stats.critRes
                ) +

                "**\n" +

                "Ignore PDEF: **" +
                formatValue(
                  stats.ignorePDEF
                ) +

                "** | Ignore MDEF: **" +
                formatValue(
                  stats.ignoreMDEF
                ) +

                "**\n\n" +

                "### PvP\n" +

                "Bonus: **" +
                formatValue(
                  stats.pvpBonus
                ) +

                "** | Reduction: **" +
                formatValue(
                  stats.pvpReduction
                ) +

                "**\n\n" +

                "### Target Damage\n" +

                "Medium: **" +
                formatPercent(
                  stats.mediumDamage
                ) +

                " / " +
                formatPercent(
                  stats.mediumReduction
                ) +

                "**\n" +

                "Demi-Human: **" +
                formatPercent(
                  stats.demiDamage
                ) +

                " / " +
                formatPercent(
                  stats.demiReduction
                ) +

                "**\n\n" +

                "### Equipment\n" +

                "PDEF: **" +
                formatPercent(
                  stats.equipmentPDEF
                ) +

                "** | MDEF: **" +
                formatPercent(
                  stats.equipmentMDEF
                ) +

                "**\n\n" +

                "✅ **Stats Submission updated**\n" +

                "✅ **Cards set to 2-star**";


              if (
                result &&
                result.reportsRefreshed === false
              ) {

                successMessage +=

                  "\n⚠️ **Reports could not be refreshed.** " +

                  "The Stats Submission itself was written successfully.";

              } else {

                successMessage +=

                  "\n✅ **Reports refreshed**";

              }


              try {

                await interaction.editReply({

                  content:
                    safeDiscordContent(
                      successMessage
                    ),

                  components: []

                });

              } catch (error) {

                console.error(
                  "[STATS] Could not update final confirmation:",
                  error
                );

              }


            } catch (error) {

              console.error(
                "[STATS] SUBMISSION ERROR:",
                error
              );


              try {

                await interaction.editReply({

                  content:

                    "## ❌ Stats Submission Failed\n\n" +

                    "The stats could not be written to Google Sheets.\n\n" +

                    "Please contact an administrator.\n\n" +

                    "The submission was **not automatically retried** to prevent duplicate records.",

                  components: []

                });

              } catch (editError) {

                console.error(
                  "[STATS] Could not update failed confirmation:",
                  editError
                );

              }

            }


            confirmationCollector.stop(
              "submitted"
            );


            // ------------------------------------------------
            // DELETE SCREENSHOT MESSAGE
            // ------------------------------------------------

            try {

              await message.delete();

            } catch (error) {

              console.log(
                "[STATS] Could not delete upload message:",
                error.message
              );

            }


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

                "Choose the stat you want to edit.",

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
          // EDIT GROUP
          // ==================================================

          if (
            componentInteraction.customId ===
            "stats_edit_group_" +
            token
          ) {

            const group =
              componentInteraction.values[0];


            if (
              group ===
              "stats"
            ) {

              await componentInteraction.update({

                content:

                  "## ✏️ Edit Stats\n\n" +

                  "Select the stat you want to edit.",

                components: [

                  buildStatsEditMenu(
                    token,
                    stats
                  )

                ]

              });


              return;

            }

          }


          // ==================================================
          // EDIT STAT FIELD
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


            if (
              !field
            ) {

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
                  field.label.slice(
                    0,
                    45
                  )
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


            if (
              currentValue !== ""
            ) {

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
                        userId &&

                        modalSubmit.customId ===
                        "stats_modal_" +
                        token +
                        "_" +
                        key

                      );

                    }

                });

            } catch (error) {

              console.log(
                "[STATS] Stat edit modal timed out."
              );


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
              "[STATS] Manual stat edit:",
              key,
              "=",
              parsed
            );


            const updatedMissingStats =
              getMissingStats(
                stats
              );


            try {

              await modalInteraction.update({

                content:

                  safeDiscordContent(

                    buildConfirmationText(

                      stats,

                      playerName,

                      selectedClass,

                      updatedMissingStats

                    )

                  ),

                components: [

                  buildConfirmationButtons(
                    token
                  )

                ]

              });

            } catch (error) {

              console.error(
                "[STATS] Could not update after stat edit:",
                error
              );

            }


            return;

          }

        }
      );


      // ======================================================
      // CONFIRMATION COLLECTOR END
      // ======================================================

      confirmationCollector.on(
        "end",
        function(
          collected,
          reason
        ) {

          console.log(
            "[STATS] Confirmation collector ended:",
            reason,
            "interactions:",
            collected.size,
            "| Player:",
            playerName
          );

        }
      );


      // ------------------------------------------------------
      // DELETE UPLOAD MESSAGE
      // ------------------------------------------------------

      try {

        await message.delete();

        console.log(
          "[STATS] Upload message deleted."
        );

      } catch (error) {

        console.log(
          "[STATS] Could not delete upload message:",
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
        "[STATS] Upload collector ended:",
        reason,
        "messages:",
        collected.size,
        "| User:",
        userId
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