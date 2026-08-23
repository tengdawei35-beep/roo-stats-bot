const {
  getMembersMissingWeeklyStats,
  getMembersMissingStatsBeforeDate
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


// Prevent duplicate automatic reminders during the same day.
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
      Number(
        values.year
      ),

    month:
      Number(
        values.month
      ),

    day:
      Number(
        values.day
      ),

    hour:
      Number(
        values.hour
      ),

    minute:
      Number(
        values.minute
      ),

    second:
      Number(
        values.second
      )

  };

}


// ============================================================
// REMINDER KEY
// ============================================================

function getReminderKey() {

  const parts =
    getMalaysiaDateParts();


  return (

    parts.year +
    "-" +
    String(
      parts.month
    ).padStart(
      2,
      "0"
    ) +
    "-" +
    String(
      parts.day
    ).padStart(
      2,
      "0"
    )

  );

}


// ============================================================
// FIND DISCORD MEMBERS
// ============================================================
//
// IMPORTANT:
// Do NOT call guild.members.fetch() here.
//
// Fetching the entire guild caused:
//     GuildMembersTimeout
//
// Instead we search Discord for each username.
// ============================================================

async function resolveDiscordMembers(
  guild,
  missingMembers
) {

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


    if (
      !target
    ) {

      unresolved.push(
        missing
      );

      continue;

    }


    let discordMember =
      null;


    try {

      // ======================================================
      // SEARCH DISCORD
      // ======================================================

      const searchResults =
        await guild.members.search({

          query:
            target,

          limit:
            10

        });


      discordMember =
        searchResults.find(
          function(member) {

            return (

              member.user.username
                .toLowerCase() ===
              target

            );

          }
        ) || null;


      // ======================================================
      // FALLBACK TO CACHE
      // ======================================================

      if (
        !discordMember
      ) {

        discordMember =
          guild.members.cache.find(
            function(member) {

              return (

                member.user.username
                  .toLowerCase() ===
                target

              );

            }
          ) || null;

      }


    } catch (
      error
    ) {

      console.error(

        "[WEEKLY STATS] Discord search failed:",

        target,

        error

      );

    }


    if (
      !discordMember
    ) {

      console.warn(

        "[WEEKLY STATS] Discord member not found:",

        target

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
        missing.discordUsername,

      discordId:
        discordMember.id

    });


    console.log(

      "[WEEKLY STATS] Matched:",

      missing.name,

      "|",

      missing.discordUsername,

      "→",

      discordMember.id

    );

  }


  return {

    mentions,

    unresolved

  };

}


// ============================================================
// SEND REMINDER
// ============================================================

async function sendReminder(
  client,
  missingMembers
) {

  if (
    !REMINDER_CHANNEL_ID
  ) {

    throw new Error(
      "STATS_REMINDER_CHANNEL_ID is not configured."
    );

  }


  const channel =
    await client.channels.fetch(
      REMINDER_CHANNEL_ID
    );


  if (
    !channel
  ) {

    throw new Error(
      "Reminder channel was not found: " +
      REMINDER_CHANNEL_ID
    );

  }


  if (
    !channel.isTextBased()
  ) {

    throw new Error(
      "Reminder channel is not text-based."
    );

  }


  const guild =
    channel.guild;


  if (
    !guild
  ) {

    throw new Error(
      "Reminder channel does not belong to a guild."
    );

  }


  console.log(

    "[WEEKLY STATS] Resolving Discord members:",

    missingMembers.length

  );


  const resolved =
    await resolveDiscordMembers(
      guild,
      missingMembers
    );


  const mentions =
    resolved.mentions;


  const unresolved =
    resolved.unresolved;


  console.log(

    "[WEEKLY STATS] Members to tag:",

    mentions.length

  );


  console.log(

    "[WEEKLY STATS] Members not found in Discord:",

    unresolved.length

  );


  // ==========================================================
  // NOTHING TO TAG
  // ==========================================================

  if (
    mentions.length === 0
  ) {

    console.warn(

      "[WEEKLY STATS] No Discord members could be resolved."

    );


    return {

      sent:
        false,

      tagged:
        0,

      unresolved:
        unresolved.length

    };

  }


  // ==========================================================
  // BUILD MESSAGE
  // ==========================================================

  const header =

    "⚠️ **Weekly Stats Reminder**\n\n" +

    "The following members have **not submitted updated stats**:\n\n";


  const footer =

    "\nPlease use `/stats` to submit your updated stats.";


  let currentMessage =
    header;


  let messagesSent =
    0;


  // ==========================================================
  // SPLIT INTO MULTIPLE DISCORD MESSAGES IF NECESSARY
  // ==========================================================

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


      messagesSent++;


      currentMessage =
        header;

    }


    currentMessage +=
      line;

  }


  if (
    currentMessage !==
    header
  ) {

    currentMessage +=
      footer;


    await channel.send({

      content:
        currentMessage

    });


    messagesSent++;

  }


  console.log(

    "[WEEKLY STATS] Reminder sent successfully.",

    "| Tagged:",

    mentions.length,

    "| Messages:",

    messagesSent

  );


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
        .join(
          ", "
        )

    );

  }


  return {

    sent:
      true,

    tagged:
      mentions.length,

    unresolved:
      unresolved.length,

    messages:
      messagesSent

  };

}


// ============================================================
// NORMAL WEEKLY REMINDER
// ============================================================

async function runWeeklyStatsReminder(
  client
) {

  console.log(
    "[WEEKLY STATS] Running weekly stats check..."
  );


  const missingMembers =
    await getMembersMissingWeeklyStats();


  console.log(

    "[WEEKLY STATS] Missing submissions:",

    missingMembers.length

  );


  if (
    missingMembers.length === 0
  ) {

    console.log(

      "[WEEKLY STATS] Everyone has submitted stats this week."

    );


    return {

      sent:
        false,

      tagged:
        0

    };

  }


  return await sendReminder(
    client,
    missingMembers
  );

}


// ============================================================
// TEMPORARY AUGUST 22 REMINDER
// ============================================================
//
// Anyone whose latest submission is BEFORE:
//     22 August 2026 00:00 Malaysia time
//
// is considered not updated.
//
// A submission on 22 August or later counts.
// ============================================================

async function runStatsReminderBeforeAugust22(
  client
) {

  console.log(
    "[WEEKLY STATS] Running temporary August 22 cutoff reminder..."
  );


  const cutoff =
    new Date(
      "2026-08-21T16:00:00.000Z"
    );


  console.log(

    "[WEEKLY STATS] Cutoff:",

    cutoff.toISOString(),

    "(2026-08-22 00:00 Malaysia)"

  );


  const missingMembers =
    await getMembersMissingStatsBeforeDate(
      cutoff
    );


  console.log(

    "[WEEKLY STATS] Members not updated by August 22:",

    missingMembers.length

  );


  return await sendReminder(
    client,
    missingMembers
  );

}


// ============================================================
// AUTOMATIC SCHEDULER
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
    day !==
    REMINDER_DAY
  ) {

    return;

  }


  if (
    parts.hour !==
    REMINDER_HOUR
  ) {

    return;

  }


  const reminderKey =
    getReminderKey();


  if (
    lastReminderKey ===
    reminderKey
  ) {

    return;

  }


  lastReminderKey =
    reminderKey;


  try {

    await runWeeklyStatsReminder(
      client
    );

  } catch (
    error
  ) {

    console.error(

      "[WEEKLY STATS] Reminder failed:",

      error

    );


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

    "[WEEKLY STATS] Automatic reminder:",

    "Sunday",

    REMINDER_HOUR + ":00",

    "Malaysia time"

  );


  checkWeeklyStatsReminder(
    client
  );


  setInterval(

    function() {

      checkWeeklyStatsReminder(
        client
      );

    },

    60 * 1000

  );

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  startWeeklyStatsReminder,

  runWeeklyStatsReminder,

  runStatsReminderBeforeAugust22,

  checkWeeklyStatsReminder

};