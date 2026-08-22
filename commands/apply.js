const {
  submitApplication
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
    .setName("apply")
    .setDescription(
      "Submit an ROO application"
    );


// ============================================================
// REQUIRED STATS
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
    label: "Equipment PDEF %"
  },

  {
    key: "equipmentMDEF",
    label: "Equipment MDEF %"
  }

];


// ============================================================
// HELPERS
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


function parseNumber(value) {

  const cleaned =
    String(value)
      .trim()
      .replace(/,/g, "")
      .replace(/%/g, "");

  if (!cleaned) {
    return null;
  }

  const number =
    Number(cleaned);

  if (
    !Number.isFinite(number)
  ) {

    return null;

  }

  return number;

}


function safeDiscordContent(
  content
) {

  const MAX =
    1900;

  if (
    content.length <= MAX
  ) {

    return content;

  }

  return (
    content.substring(
      0,
      MAX - 100
    ) +
    "\n\n⚠️ Message shortened. Use **Edit** to review stats."
  );

}


// ============================================================
// JOB MENU
// ============================================================

function buildJobMenu(
  userId
) {

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


  return new ActionRowBuilder()
    .addComponents(

      new StringSelectMenuBuilder()

        .setCustomId(
          "apply_job_" +
          userId
        )

        .setPlaceholder(
          "Select your main job class"
        )

        .setMinValues(1)

        .setMaxValues(1)

        .addOptions(
          options
        )

    );

}


// ============================================================
// CONFIRM BUTTONS
// ============================================================

function buildConfirmationButtons(
  token
) {

  return new ActionRowBuilder()
    .addComponents(

      new ButtonBuilder()

        .setCustomId(
          "apply_confirm_" +
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
          "apply_edit_" +
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

function buildEditMenu(
  token,
  stats
) {

  const menu =
    new StringSelectMenuBuilder()

      .setCustomId(
        "apply_edit_field_" +
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
            String(value).slice(0, 70)

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

function findField(
  key
) {

  return REQUIRED_STATS.find(
    function(field) {

      return (
        field.key === key
      );

    }
  );

}


// ============================================================
// CONFIRMATION TEXT
// ============================================================

function buildConfirmation(
  stats,
  applicantName,
  selectedClass
) {

  const missing =
    getMissingStats(
      stats
    );


  let content =

    "## 🔍 ROOC Application Confirmation\n\n" +

    "**Name:** " +
    applicantName +
    "\n" +

    "**Main Class:** " +
    selectedClass +
    "\n\n" +

    "### General\n" +

    "HP: **" +
    formatValue(stats.hp) +
    "** | " +

    "PATK: **" +
    formatValue(stats.patk) +
    "** | " +

    "MATK: **" +
    formatValue(stats.matk) +
    "**\n\n" +

    "### Defense\n" +

    "PDEF: **" +
    formatValue(stats.pdef) +
    "** | " +

    "MDEF: **" +
    formatValue(stats.mdef) +
    "**\n\n" +

    "### Combat\n" +

    "PDMG: **" +
    formatValue(stats.pdmg) +
    "%** | " +

    "MDMG: **" +
    formatValue(stats.mdmg) +
    "%**\n" +

    "PDMG-R: **" +
    formatValue(stats.pdmgReduction) +
    "%** | " +

    "MDMG-R: **" +
    formatValue(stats.mdmgReduction) +
    "%**\n" +

    "Crit RES: **" +
    formatValue(stats.critRes) +
    "**\n" +

    "Ignore PDEF: **" +
    formatValue(stats.ignorePDEF) +
    "** | " +

    "Ignore MDEF: **" +
    formatValue(stats.ignoreMDEF) +
    "**\n\n" +

    "### PvP\n" +

    "Bonus: **" +
    formatValue(stats.pvpBonus) +
    "** | " +

    "Reduction: **" +
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
    "%** | " +

    "MDEF: **" +
    formatValue(stats.equipmentMDEF) +
    "%**\n\n";


  if (
    missing.length === 0
  ) {

    content +=

      "### ✅ Ready to Submit\n\n" +

      "All required stats have values.\n\n" +

      "Cards will automatically be recorded as **2-star**.\n\n" +

      "Press **Confirm** to submit.\n" +

      "Press **Edit** to correct a value.";

  } else {

    content +=

      "### ⚠️ Missing Information\n\n" +

      missing
        .map(
          function(field) {

            return "• " + field;

          }
        )
        .join("\n") +

      "\n\n" +

      "❌ **Submission is blocked until every required stat has a value.**\n\n" +

      "Press **Edit** to enter missing values.";

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

  const userId =
    interaction.user.id;


  // ==========================================================
  // STEP 1 — NAME FIRST
  // ==========================================================

  const nameModal =
    new ModalBuilder()

      .setCustomId(
        "apply_name_" +
        userId
      )

      .setTitle(
        "ROO Application"
      )

      .addComponents(

        new ActionRowBuilder()
          .addComponents(

            new TextInputBuilder()

              .setCustomId(
                "applicant_name"
              )

              .setLabel(
                "ROO Character Name"
              )

              .setPlaceholder(
                "Enter your character name"
              )

              .setStyle(
                TextInputStyle.Short
              )

              .setRequired(
                true
              )

              .setMaxLength(
                50
              )

          )

      );


  await interaction.showModal(
    nameModal
  );


  let nameInteraction;

  try {

    nameInteraction =
      await interaction.awaitModalSubmit({

        time:
          120000,

        filter:
          function(modalInteraction) {

            return (

              modalInteraction.user.id ===
              userId &&

              modalInteraction.customId ===
              "apply_name_" +
              userId

            );

          }

      });

  } catch (error) {

    console.log(
      "[APPLY] Name modal timed out."
    );

    return;

  }


  const applicantName =
    nameInteraction.fields
      .getTextInputValue(
        "applicant_name"
      )
      .trim();


  if (!applicantName) {

    await nameInteraction.reply({

      content:
        "❌ Please enter a character name.",

      flags:
        MessageFlags.Ephemeral

    });

    return;

  }


  // ==========================================================
  // STEP 2 — JOB
  // ==========================================================

  await nameInteraction.reply({

    content:

      "## 📝 ROO Application\n\n" +

      "**Name:** " +
      applicantName +
      "\n\n" +

      "Select your **main job class**.",

    components: [

      buildJobMenu(
        userId
      )

    ],

    flags:
      MessageFlags.Ephemeral

  });


  let jobInteraction;

  try {

    jobInteraction =
      await nameInteraction.channel.awaitMessageComponent({

        time:
          120000,

        filter:
          function(componentInteraction) {

            return (

              componentInteraction.user.id ===
              userId &&

              componentInteraction.customId ===
              "apply_job_" +
              userId

            );

          }

      });

  } catch (error) {

    try {

      await nameInteraction.editReply({

        content:
          "⏱️ Job selection timed out.\n\n" +
          "Please run `/apply` again.",

        components: []

      });

    } catch (_) {}

    return;

  }


  const selectedClass =
    jobInteraction.values[0];


  // ==========================================================
  // STEP 3 — SCREENSHOTS
  // ==========================================================

  await jobInteraction.update({

    content:

      "## 📸 Upload Screenshots\n\n" +

      "**Name:** " +
      applicantName +
      "\n" +

      "**Main Class:** " +
      selectedClass +
      "\n\n" +

      "Send **one message** containing your ROO stat screenshots.\n\n" +

      "You may attach multiple screenshots.\n\n" +

      "Required screenshots should include:\n" +

      "• General Stats\n" +
      "• Combat / Quasi Stats\n" +
      "• Equipment Stats\n" +
      "• PDEF Notice\n" +
      "• MDEF Notice\n\n" +

      "Cards are **not required**.\n\n" +

      "⏱️ You have **2 minutes**.",

    components: []

  });


  const collector =
    interaction.channel.createMessageCollector({

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

              /\.(png|jpg|jpeg|webp|gif)$/i
                .test(filename) ||

              contentType.startsWith(
                "image/"
              )

            );

          }
        );


      if (
        imageAttachments.length === 0
      ) {

        await nameInteraction.followUp({

          content:
            "❌ No supported image files were found.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      await nameInteraction.followUp({

        content:

          "🔍 Found **" +
          imageAttachments.length +
          "** screenshot(s).\n\n" +

          "Reading your stats...",

        flags:
          MessageFlags.Ephemeral

      });


      let stats;


      try {

        stats =
          await extractStats(

            imageAttachments.map(
              function(attachment) {

                return attachment.url;

              }
            )

          );

      } catch (error) {

        console.error(
          "[APPLY] OCR ERROR:",
          error
        );


        await nameInteraction.followUp({

          content:

            "❌ OCR failed.\n\n" +

            "Please try again with clearer screenshots.",

          flags:
            MessageFlags.Ephemeral

        });

        return;

      }


      console.log(
        "[APPLY] OCR RESULT:",
        stats
      );


      // --------------------------------------------------------
      // MANUAL NAME IS AUTHORITATIVE
      // --------------------------------------------------------

      stats.name =
        applicantName;


      // --------------------------------------------------------
      // CONFIRMATION
      // --------------------------------------------------------

      const token =
        Date.now().toString(36) +
        "_" +
        userId.slice(-8);


      let confirmationMessage;


      try {

        confirmationMessage =
          await nameInteraction.followUp({

            content:
              buildConfirmation(
                stats,
                applicantName,
                selectedClass
              ),

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
          "[APPLY] Confirmation error:",
          error
        );

        return;

      }


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

          // ====================================================
          // CONFIRM
          // ====================================================

          if (
            componentInteraction.customId ===
            "apply_confirm_" +
            token
          ) {

            const missing =
              getMissingStats(
                stats
              );


            if (
              missing.length > 0
            ) {

              await componentInteraction.reply({

                content:
                  safeDiscordContent(

                    "❌ **Submission blocked.**\n\n" +

                    "The following fields are missing:\n\n" +

                    missing
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


            // --------------------------------------------------
            // ACKNOWLEDGE
            // --------------------------------------------------

            await componentInteraction.deferUpdate();


            // --------------------------------------------------
            // UPDATE SAME EPHEMERAL MESSAGE
            // --------------------------------------------------

            try {

              await interaction.webhook.editMessage(

                confirmationMessage.id,

                {

                  content:

                    "## ⏳ Application Processing\n\n" +

                    "**Name:** " +
                    applicantName +
                    "\n" +

                    "**Main Class:** " +
                    selectedClass +
                    "\n\n" +

                    "Writing to **Applicant Database**...\n\n" +

                    "Please wait while Applicant Analysis and Applicant Profile are refreshed.",

                  components: []

                }

              );

            } catch (error) {

              console.error(
                "[APPLY] Could not update processing message:",
                error
              );

            }


            // --------------------------------------------------
            // SUBMIT
            // --------------------------------------------------

            try {

              const result =
                await submitApplication(

                  interaction.user.username,

                  applicantName,

                  selectedClass,

                  stats

                );


              console.log(
                "[APPLY] Submission result:",
                result
              );


              let finalMessage =

                "## ✅ Application Submitted\n\n" +

                "**Name:** " +
                applicantName +
                "\n" +

                "**Main Class:** " +
                selectedClass +
                "\n\n" +

                "📋 **Applicant Database:** Updated\n";


              if (
                result &&
                result.reportsRefreshed
              ) {

                finalMessage +=

                  "🔄 **Applicant Analysis:** Refreshed\n" +

                  "👤 **Applicant Profile:** Refreshed\n\n" +

                  "✅ **Cards defaulted to 2-star.**";

              } else {

                finalMessage +=

                  "⚠️ **Reports could not be confirmed as refreshed.**\n\n" +

                  "The application itself was submitted successfully.";

              }


              await interaction.webhook.editMessage(

                confirmationMessage.id,

                {

                  content:
                    safeDiscordContent(
                      finalMessage
                    ),

                  components: []

                }

              );


              confirmationCollector.stop(
                "confirmed"
              );


            } catch (error) {

              console.error(
                "[APPLY] Submission error:",
                error
              );


              try {

                await interaction.webhook.editMessage(

                  confirmationMessage.id,

                  {

                    content:

                      "## ❌ Application Submission Failed\n\n" +

                      "The application could not be completed.\n\n" +

                      "`" +
                      String(
                        error.message ||
                        error
                      ).slice(0, 500) +
                      "`",

                    components: []

                  }

                );

              } catch (editError) {

                console.error(
                  "[APPLY] Could not display submission error:",
                  editError
                );

              }


              confirmationCollector.stop(
                "submission_failed"
              );

            }


            try {

              await message.delete();

            } catch (error) {

              console.log(
                "[APPLY] Could not delete upload:",
                error.message
              );

            }


            return;

          }


          // ====================================================
          // EDIT
          // ====================================================

          if (
            componentInteraction.customId ===
            "apply_edit_" +
            token
          ) {

            await componentInteraction.update({

              content:

                "## ✏️ Edit Application Stats\n\n" +

                "**Name:** " +
                applicantName +
                "\n" +

                "**Main Class:** " +
                selectedClass +
                "\n\n" +

                "Select the field you want to edit.",

              components: [

                buildEditMenu(
                  token,
                  stats
                ),

                new ActionRowBuilder()
                  .addComponents(

                    new ButtonBuilder()

                      .setCustomId(
                        "apply_back_" +
                        token
                      )

                      .setLabel(
                        "Back"
                      )

                      .setStyle(
                        ButtonStyle.Secondary
                      )

                  )

              ]

            });

            return;

          }


          // ====================================================
          // BACK
          // ====================================================

          if (
            componentInteraction.customId ===
            "apply_back_" +
            token
          ) {

            await componentInteraction.update({

              content:
                buildConfirmation(
                  stats,
                  applicantName,
                  selectedClass
                ),

              components: [

                buildConfirmationButtons(
                  token
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
            "apply_edit_field_" +
            token
          ) {

            const key =
              componentInteraction.values[0];


            const field =
              findField(
                key
              );


            if (!field) {

              await componentInteraction.reply({

                content:
                  "❌ Invalid field.",

                flags:
                  MessageFlags.Ephemeral

              });

              return;

            }


            const modal =
              new ModalBuilder()

                .setCustomId(
                  "apply_edit_modal_" +
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
              isFilled(
                stats[key]
              )
            ) {

              input.setValue(
                String(
                  stats[key]
                )
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
                        "apply_edit_modal_" +
                        token +
                        "_" +
                        key

                      );

                    }

                });

            } catch (error) {

              return;

            }


            const value =
              parseNumber(

                modalInteraction.fields
                  .getTextInputValue(
                    "value"
                  )

              );


            if (
              value === null
            ) {

              await modalInteraction.reply({

                content:
                  "❌ Please enter a valid number.",

                flags:
                  MessageFlags.Ephemeral

              });

              return;

            }


            stats[key] =
              value;


            await modalInteraction.update({

              content:
                buildConfirmation(
                  stats,
                  applicantName,
                  selectedClass
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

    }

  );


  collector.on(
    "end",
    function(
      collected,
      reason
    ) {

      console.log(
        "[APPLY] Screenshot collector ended:",
        reason
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