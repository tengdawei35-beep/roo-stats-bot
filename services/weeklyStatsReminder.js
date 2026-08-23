const {
  getMembersMissingWeeklyStats
} = require("./sheets");


// ============================================================
// CONFIG
// ============================================================

const REMINDER_CHANNEL_ID =
  process.env.STATS_REMINDER_CHANNEL_ID;


// Sunday at 6 PM Malaysia time by default.
const REMINDER_DAY =
  Number(
    process.env.STATS_REMINDER_DAY || 0
  );


const REMINDER_HOUR =
  Number(
    process.env.STATS_REMINDER_HOUR || 18
  );


// Prevent duplicate reminders during the same run.
let lastReminderKey =
  null;


// ============================================================
// MALAYSIA TIME
// ============================================================

function getMalaysiaDateParts() {

  const now =
    new Date();


  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {

        timeZone:
          "Asia/Kuala_Lumpur",

        year:
          "numeric",

        month:
          "numeric",

        day:
          "numeric",

        hour:
          "numeric",

        minute:
          "numeric",

        second:
          "numeric",

        hour12:
          false

      }
    ).formatToParts(
      now
    );


  const values = {};


  parts.forEach(
    function(part) {

      values[
        part.type
      ] =
        part.value;

    }
  );


  return {

    year:
      Number(values.year),

    month:
      Number(values.month),

    day:
      Number(values.day),

    hour:
      Number(values.hour),

    minute:
      Number(values.minute),

    second:
      Number(values.second)

  };

}


// ============================================================
// GET REMINDER KEY
// ============================================================

function getReminderKey() {

  const parts =
    getMalaysiaDateParts();


  return (

    parts.year +
    "-" +
    String(parts.month).padStart(2, "0") +
    "-" +
    String(parts.day).padStart(2, "0")

  );

}


// ============================================================
// RUN WEEKLY CHECK
// ============================================================

async function runWeeklyStatsReminder(
  client
) {

  if (
    !REMINDER_CHANNEL_ID
  ) {

    console.warn(
      "[WEEKLY STATS] STATS_REMINDER_CHANNEL_ID is not configured."
    );

    return;

  }


  const channel =
    await client.channels.fetch(
      REMINDER_CHANNEL_ID
    );


  if (
    !channel
  ) {

    console.error(
      "[WEEKLY STATS] Reminder channel not found:",
      REMINDER_CHANNEL_ID
    );

    return;

  }


  if (
    !channel.isTextBased()
  ) {

    console.error(
      "[WEEKLY STATS] Reminder channel is not text-based."
    );

    return;

  }


  console.log(
    "[WEEKLY STATS] Running weekly stats check..."
  );


  const missingMembers =
    await getMembersMissingWeeklyStats();


  if (
    missingMembers.length === 0
  ) {

    console.log(
      "[WEEKLY STATS] Everyone has submitted stats this week."
    );


    await channel.send({

      content:
        "✅ **Weekly Stats Update**\n\n" +
        "Everyone has submitted their updated stats this week!"

    });


    return;

  }


  // ==========================================================
  // GET DISCORD MEMBERS
  // ==========================================================

  let guild;


  try {

    guild =
      channel.guild;

  } catch (error) {

    console.error(
      "[WEEKLY STATS] Could not determine guild:",
      error
    );

    return;

  }


  try {

    await guild.members.fetch();

  } catch (error) {

    console.error(
      "[WEEKLY STATS] Could not fetch guild members:",
      error
    );

  }


  // ==========================================================
  // MATCH SHEET USERNAME → DISCORD MEMBER
  // ==========================================================

  const mentions = [];


  const unresolved = [];


  for (
    const missing of missingMembers
  ) {

    const target =
      String(
        missing.discordUsername
      )
        .trim()
        .toLowerCase();


    const discordMember =
      guild.members.cache.find(
        function(member) {

          return (

            member.user.username
              .toLowerCase() ===
            target

          );

        }
      );


    if (
      !discordMember
    ) {

      console.warn(
        "[WEEKLY STATS] Discord member not found:",
        missing.discordUsername
      );


      unresolved.push(
        missing
      );


      continue;

    }


    mentions.push({

      mention:
        `<@${discordMember.id}>`,

      name:
        missing.name,

      username:
        missing.discordUsername

    });

  }


  console.log(
    "[WEEKLY STATS] Members to tag:",
    mentions.length
  );


  console.log(
    "[WEEKLY STATS] Members not found in Discord:",
    unresolved.length
  );


  if (
    mentions.length === 0
  ) {

    await channel.send({

      content:
        "⚠️ **Weekly Stats Reminder**\n\n" +
        "There are members who have not submitted their stats this week, " +
        "but I could not match their Discord usernames."

    });


    return;

  }


  // ==========================================================
  // BUILD MESSAGE
  // ==========================================================

  const header =
    "⚠️ **Weekly Stats Reminder**\n\n" +
    "The following members have **not submitted updated stats this week**:\n\n";


  const footer =
    "\nPlease use `/stats` to submit your updated stats.";


  // Discord has a 2000 character message limit.
  // Split into multiple messages when necessary.

  let currentMessage =
    header;


  for (
    const member of mentions
  ) {

    const line =
      member.mention +
      " — `" +
      member.name +
      "`\n";


    if (
      currentMessage.length +
      line.length +
      footer.length >
      1900
    ) {

      currentMessage +=
        footer;


      await channel.send({

        content:
          currentMessage

      });


      currentMessage =
        header;

    }


    currentMessage +=
      line;

  }


  if (
    currentMessage !== header
  ) {

    currentMessage +=
      footer;


    await channel.send({

      content:
        currentMessage

    });

  }


  // ==========================================================
  // UNRESOLVED USERS
  // ==========================================================

  if (
    unresolved.length > 0
  ) {

    console.warn(
      "[WEEKLY STATS] Could not match:",
      unresolved
        .map(
          function(member) {

            return (
              member.name +
              " (" +
              member.discordUsername +
              ")"
            );

          }
        )
        .join(", ")
    );

  }


  console.log(
    "[WEEKLY STATS] Reminder sent successfully."
  );

}


// ============================================================
// CHECK WHETHER REMINDER SHOULD RUN
// ============================================================

async function checkWeeklyStatsReminder(
  client
) {

  const parts =
    getMalaysiaDateParts();


  const day =
    new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day
      )
    ).getUTCDay();


  if (
    day !== REMINDER_DAY
  ) {

    return;

  }


  if (
    parts.hour !== REMINDER_HOUR
  ) {

    return;

  }


  const reminderKey =
    getReminderKey();


  if (
    lastReminderKey === reminderKey
  ) {

    return;

  }


  lastReminderKey =
    reminderKey;


  try {

    await runWeeklyStatsReminder(
      client
    );

  } catch (error) {

    console.error(
      "[WEEKLY STATS] Reminder failed:",
      error
    );

    // Allow another attempt during the same hour if
    // the first attempt failed.

    lastReminderKey =
      null;

  }

}


// ============================================================
// START SCHEDULER
// ============================================================

function startWeeklyStatsReminder(
  client
) {

  console.log(
    "[WEEKLY STATS] Scheduler started."
  );


  console.log(
    "[WEEKLY STATS] Reminder:",
    "Sunday",
    REMINDER_HOUR + ":00",
    "Malaysia time"
  );


  // Check once immediately.
  checkWeeklyStatsReminder(
    client
  );


  // Check every minute.
  setInterval(
    function() {

      checkWeeklyStatsReminder(
        client
      );

    },
    60 * 1000
  );

}


module.exports = {

  startWeeklyStatsReminder,

  runWeeklyStatsReminder,

  checkWeeklyStatsReminder

};