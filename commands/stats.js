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

const REQUIRED_STATS = [

  {
    key:
      "hp",

    label:
      "HP"
  },

  {
    key:
      "patk",

    label:
      "PATK"
  },

  {
    key:
      "matk",

    label:
      "MATK"
  },

  {
    key:
      "pdef",

    label:
      "PDEF (w/o buffs)"
  },

  {
    key:
      "mdef",

    label:
      "MDEF (w/o buffs)"
  },

  {
    key:
      "pvpBonus",

    label:
      "PvP DMG Bonus"
  },

  {
    key:
      "pvpReduction",

    label:
      "PvP DMG Reduction"
  },

  {
    key:
      "pdmg",

    label:
      "PDMG %"
  },

  {
    key:
      "mdmg",

    label:
      "MDMG %"
  },

  {
    key:
      "pdmgReduction",

    label:
      "PDMG Reduction %"
  },

  {
    key:
      "mdmgReduction",

    label:
      "MDMG Reduction %"
  },

  {
    key:
      "critRes",

    label:
      "Crit RES"
  },

  {
    key:
      "ignorePDEF",

    label:
      "Ignore PDEF"
  },

  {
    key:
      "ignoreMDEF",

    label:
      "Ignore MDEF"
  },

  {
    key:
      "mediumDamage",

    label:
      "Medium Damage"
  },

  {
    key:
      "mediumReduction",

    label:
      "Medium Reduction"
  },

  {
    key:
      "demiDamage",

    label:
      "Demi-Human Damage"
  },

  {
    key:
      "demiReduction",

    label:
      "Demi-Human Reduction"
  },

  {
    key:
      "equipmentPDEF",

    label:
      "Equipment PDEF"
  },

  {
    key:
      "equipmentMDEF",

    label:
      "Equipment MDEF"
  }

];


// ============================================================
// SUBMISSION QUEUE
// ============================================================
//
// OCR sessions may run concurrently.
//
// Google Sheets + Apps Script refresh is serialized.
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
          "[STATS QUEUE] Starting submission:",
          submission.name
        );


        try {

          return await submitStats(
            submission
          );

        } finally {

          console.log(
            "[STATS QUEUE] Finished submission:",
            submission.name
          );

        }

      }
    );


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

    return (
      value.trim() !== ""
    );

  }


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
// FORMAT PERCENT
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
// SAFE CONTENT
// ============================================================

function safeDiscordContent(
  content
) {

  const maxLength =
    1900;


  if (
    content.length <=
    maxLength
  ) {

    return content;

  }


  return (

    content.substring(
      0,
      maxLength - 100
    ) +

    "\n\n" +

    "⚠️ Some information was shortened."

  );

}


// ============================================================
// MANUAL NUMBER
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


  const text =
    String(
      value
    )
      .trim()
      .replace(
        /,/g,
        ""
      )
      .replace(
        /%/g,
        ""
      );


  if (
    !text
  ) {

    return null;

  }


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
// JOB CLASS MENU
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
// CONFIRMATION BUTTONS
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
// STATS EDIT MENU
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
// CONFIRMATION TEXT
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


  if (
    missingStats.length === 0
  ) {

    content +=

      "### ✅ Ready to Submit\n\n" +

      "All required stats were detected.\n\n" +

      "⚠️ **Please verify your stats before submitting.**\n\n" +

      "Press **Confirm** to submit.\n" +

      "Press **Edit** to correct any values.\n\n" +

      "🃏 **All cards will automatically be recorded as 2-star.**";

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
// DELETE UPLOAD MESSAGE SAFELY
// ============================================================

async function deleteUploadMessage(
  message
) {

  if (
    !message
  ) {

    return;

  }


  try {

    await message.delete();


    console.log(
      "[STATS] Upload message deleted:",
      message.id
    );

  } catch (error) {

    /*
     * Discord error 10008 means the message is already gone.
     * This is harmless.
     */

    if (
      error &&
      error.code === 10008
    ) {

      console.log(
        "[STATS] Upload message was already deleted:",
        message.id
      );

      return;

    }


    console.error(
      "[STATS] Could not delete upload message:",
      error
    );

  }

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
    "[STATS] Starting /stats:",
    interaction.user.tag,
    "| ID:",
    userId
  );


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
  // JOB CLASS COLLECTOR
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

      "• Quasi Stats\n" +

      "• PDEF/MDEF Notice\n" +

      "• Equipment / Damage Stats\n\n" +

      "🃏 **Card information is not required. All cards are automatically recorded as 2-star.**\n\n" +

      "⏱️ You have **2 minutes** to upload your screenshots.",

    components: []

  });


  // ==========================================================
  // SCREENSHOT COLLECTOR
  // ==========================================================

  const channel =
    interaction.channel;


  const collector =
    channel.createMessageCollector({

      time:
        120000,

      filter:
        function(message) {

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


      if (
        message.attachments.size === 0
      ) {

        return;

      }


      collector.stop(
        "screenshots_received"
      );


      // ========================================================
      // FIND IMAGES
      // ========================================================

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
              )
                .toLowerCase();


            const contentType =
              String(
                attachment.contentType ||
                ""
              )
                .toLowerCase();


            return (

              contentType.startsWith(
                "image/"
              ) ||

              /\.(png|jpg|jpeg|webp|gif)$/i
                .test(
                  filename
                )

            );

          }
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


      console.log(
        "[STATS] Image count:",
        imageAttachments.length
      );


      await interaction.followUp({

        content:

          "🔍 Found **" +
          imageAttachments.length +
          "** screenshot(s).\n\n" +

          "Downloading and reading your stats...\n\n" +

          "Please wait.",

        flags:
          MessageFlags.Ephemeral

      });


      const imageUrls =
        imageAttachments.map(
          function(attachment) {

            return attachment.url;

          }
        );


      // ========================================================
      // OCR
      // ========================================================
      //
      // IMPORTANT:
      //
      // DO NOT DELETE THE DISCORD MESSAGE BEFORE THIS FINISHES.
      //
      // extractStats() downloads the Discord CDN attachments.
      //
      // ========================================================

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


        /*
         * We can delete the message now because OCR has
         * finished attempting the downloads.
         */

        await deleteUploadMessage(
          message
        );


        return;

      }


      console.log(
        "[STATS] OCR RESULT:",
        JSON.stringify(
          stats,
          null,
          2
        )
      );


      // ========================================================
      // OCR SUCCESS
      // ========================================================

      await deleteUploadMessage(
        message
      );


      // ========================================================
      // MEMBER LOOKUP
      // ========================================================

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


      // ========================================================
      // VALIDATION
      // ========================================================

      const missingStats =
        getMissingStats(
          stats
        );


      // ========================================================
      // UNIQUE TOKEN
      // ========================================================

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


      // ========================================================
      // CONFIRMATION
      // ========================================================

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


      // ========================================================
      // CONFIRMATION COLLECTOR
      // ========================================================

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
            componentInteraction.customId
          );


          // ====================================================
          // CONFIRM
          // ====================================================

          if (
            componentInteraction.customId ===
            "stats_confirm_" +
            token
          ) {

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


            // --------------------------------------------------
            // DISABLE BUTTONS
            // --------------------------------------------------

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


            // --------------------------------------------------
            // SUBMISSION OBJECT
            // --------------------------------------------------

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
              "[STATS] Final submission:",
              JSON.stringify(
                submission,
                null,
                2
              )
            );


            // --------------------------------------------------
            // QUEUED GOOGLE SUBMISSION
            // --------------------------------------------------

            try {

              const result =
                await submitStatsQueued(
                  submission
                );


              console.log(
                "[STATS] Stats successfully submitted:",
                playerName
              );


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
                result.reportsRefreshed ===
                false
              ) {

                successMessage +=

                  "\n⚠️ **Reports could not be refreshed.**";

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

                    "The submission was **not automatically retried**.",

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


            return;

          }


          // ====================================================
          // EDIT
          // ====================================================

          if (
            componentInteraction.customId ===
            "stats_edit_" +
            token
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


          // ====================================================
          // EDIT FIELD
          // ====================================================

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


      // ========================================================
      // CONFIRMATION END
      // ========================================================

      confirmationCollector.on(
        "end",
        function(
          collected,
          reason
        ) {

          console.log(
            "[STATS] Confirmation collector ended:",
            reason,
            "| interactions:",
            collected.size,
            "| Player:",
            playerName
          );

        }
      );

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
        "| messages:",
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