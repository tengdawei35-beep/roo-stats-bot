const fs = require("fs");
const path = require("path");


// ============================================================
// CONFIG
// ============================================================

const GOOGLE_CREDENTIALS_PATH =
  path.join(
    __dirname,
    "..",
    "credentials",
    "google-service-account.json"
  );

const SPREADSHEET_ID =
  process.env.GOOGLE_SHEET_ID ||
  "1V_oL9Kkn4y_f0628pYkmsk7JLheHCHKpv2mTm3UXhHg";

const MEMBERS_SHEET_NAME =
  "Members List";

const STATS_SHEET_NAME =
  "Stats Submission";

const APPLICANTS_SHEET_NAME =
  "Applicants";

const APPLICANT_DATABASE_SHEET_NAME =
  "Applicant Database";

const APPLICANT_ANALYSIS_SHEET_NAME =
  "Applicant Analysis";

const APPLICANT_PROFILE_SHEET_NAME =
  "Applicant Profile";

const PLAYER_PROFILE_SHEET_NAME =
  "Player Profile";


// IMPORTANT:
// This MUST match the variable in .env
//
// APPS_SCRIPT_REFRESH_URL=https://script.google.com/macros/s/...../exec
//
const APPS_SCRIPT_REFRESH_URL =
  process.env.APPS_SCRIPT_REFRESH_URL;


// ============================================================
// DEFAULT CARD VALUE
// ============================================================

const DEFAULT_CARD_VALUE =
  "2-star";


// ============================================================
// CARD FIELDS
// ============================================================
//
// These are the actual Stats Submission / Applicants headers.
//
// Cards are no longer requested from the user.
// Every card slot defaults to 2-star.
//
// ============================================================

const CARD_FIELDS = [

  "Card Availability [Ghostring]",
  "Card Availability [Maya Purple]",

  "Card Availability [1st Thara Frog]",
  "Card Availability [2nd Thara Frog]",

  "Card Availability [1st Hydra]",
  "Card Availability [2nd Hydra]",

  "Card Availability [1st Skel Worker]",
  "Card Availability [2nd Skel Worker]",

  "Card Availability [1st Goblin Leader Puppet II]",
  "Card Availability [2nd Goblin Leader Puppet II]",

  "Card Availability [1st Doppelganger Puppet II]",
  "Card Availability [2nd Doppelganger Puppet II]",

  "Card Availability [1st Drake Puppet II]",
  "Card Availability [2nd Drake Puppet II]",

  "Card Availability [1st Golden Thief Bug Puppet II]",
  "Card Availability [2nd Golden Thief Bug Puppet II]",

  "Card Availability [1st Baphomet Puppet II]",
  "Card Availability [2nd Baphomet Puppet II]",

  "Card Availability [1st Deviling Puppet II]",
  "Card Availability [2nd Deviling Puppet II]"

];


// ============================================================
// GOOGLE CLIENT
// ============================================================

let sheetsClient = null;


async function getGoogleSheets() {

  if (
    sheetsClient
  ) {

    return sheetsClient;

  }


  if (
    !fs.existsSync(
      GOOGLE_CREDENTIALS_PATH
    )
  ) {

    throw new Error(
      "Google service account credentials not found at: " +
      GOOGLE_CREDENTIALS_PATH
    );

  }


  const {
    google
  } =
    require("googleapis");


  const credentials =
    JSON.parse(
      fs.readFileSync(
        GOOGLE_CREDENTIALS_PATH,
        "utf8"
      )
    );


  const auth =
    new google.auth.GoogleAuth({

      credentials,

      scopes: [

        "https://www.googleapis.com/auth/spreadsheets"

      ]

    });


  sheetsClient =
    google.sheets({

      version:
        "v4",

      auth

    });


  return sheetsClient;

}


// ============================================================
// HEADER NORMALIZATION
// ============================================================

function normalizeHeader(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /\u00A0/g,
      " "
    )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );

}


// ============================================================
// BUILD HEADER MAP
// ============================================================

function buildHeaderMap(
  headers
) {

  const map = {};


  headers.forEach(
    function(
      header,
      index
    ) {

      const normalized =
        normalizeHeader(
          header
        );


      if (
        !normalized
      ) {

        return;

      }


      map[
        normalized
      ] =
        index;

    }
  );


  return map;

}


// ============================================================
// FIND HEADER INDEX
// ============================================================

function findHeaderIndex(
  headerMap,
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

    const normalized =
      normalizeHeader(
        alias
      );


    if (
      Object.prototype.hasOwnProperty.call(
        headerMap,
        normalized
      )
    ) {

      return headerMap[
        normalized
      ];

    }

  }


  return -1;

}


// ============================================================
// SET HEADER VALUE
// ============================================================

function setHeaderValue(
  row,
  headerMap,
  aliases,
  value,
  label
) {

  const index =
    findHeaderIndex(
      headerMap,
      aliases
    );


  if (
    index === -1
  ) {

    console.warn(
      "[SHEETS] Header not found:",
      label,
      "| aliases:",
      aliases
    );

    return false;

  }


  row[index] =
    value === null ||
    value === undefined
      ? ""
      : value;


  console.log(
    "[SHEETS]",
    label,
    "=> column",
    index + 1,
    "=",
    row[index]
  );


  return true;

}


// ============================================================
// HEADER ALIASES
// ============================================================

const HEADER_ALIASES = {

  timestamp: [
    "Timestamp"
  ],

  name: [
    "Name",
    "Player Name",
    "Character Name"
  ],

  discordUsername: [
    "Discord Username",
    "Discord",
    "Discord Name",
    "Discord User"
  ],

  role: [
    "Role"
  ],

  jobClassFirst: [
    "Job Class (First Choice)",
    "Job Class",
    "Main Class"
  ],

  jobClassSecond: [
    "Job Class (Second Choice)",
    "Second Class"
  ],

  jobClassThird: [
    "Job Class (Third Choice)",
    "Third Class"
  ],

  hp: [
    "HP"
  ],

  patk: [
    "PATK",
    "PATK "
  ],

  matk: [
    "MATK",
    "MATK "
  ],

  pdef: [
    "PDEF (w/o buffs)",
    "PDEF",
    "Raw PDEF"
  ],

  mdef: [
    "MDEF (w/o buffs)",
    "MDEF",
    "Raw MDEF"
  ],

  pvpBonus: [
    "PvP Bonus",
    "PVP Bonus",
    "PVP Dmg Bonus",
    "PvP Dmg Bonus",
    "PVP DMG Bonus",
    "PvP DMG Bonus"
  ],

  pvpReduction: [
    "PvP Reduction",
    "PVP Reduction",
    "PVP Dmg Reduction",
    "PvP Dmg Reduction",
    "PVP DMG Reduction",
    "PvP DMG Reduction"
  ],

  pdmg: [
    "PDMG %",
    "PDMG"
  ],

  mdmg: [
    "MDMG %",
    "MDMG"
  ],

  pdmgReduction: [
    "PDMG Reduction %",
    "PDMG Reduction",
    "PDMG-R",
    "PDMG.R"
  ],

  mdmgReduction: [
    "MDMG Reduction %",
    "MDMG Reduction",
    "MDMG-R",
    "MDMG.R"
  ],

  critRes: [
    "Crit RES",
    "Crit Res"
  ],

  ignorePDEF: [
    "Ignore PDEF"
  ],

  ignoreMDEF: [
    "Ignore MDEF"
  ],

  mediumDamage: [
    "Medium Damage",
    "DMG vs Medium Enemies",
    "DMG vs MEDIUM ENEMIES"
  ],

  mediumReduction: [
    "Medium Reduction",
    "DMG Reduction vs Medium Enemies",
    "DMG REDUCTION vs MEDIUM ENEMIES"
  ],

  demiDamage: [
    "Demi Damage",
    "Demi-Human Damage",
    "DMG vs Demi-Human",
    "DMG vs DEMI-HUMAN"
  ],

  demiReduction: [
    "Demi Reduction",
    "Demi-Human Reduction",
    "DMG Reduction vs Demi-Human",
    "DMG REDUCTION vs DEMI-HUMAN"
  ],

  equipmentPDEF: [
    "Equipment PDEF",
    "Equipment PDEF %"
  ],

  equipmentMDEF: [
    "Equipment MDEF",
    "Equipment MDEF %"
  ]

};


// ============================================================
// MALAYSIA TIMESTAMP
// ============================================================
//
// The Oracle server may run in UTC.
//
// Do NOT use:
//     date.getHours()
//
// Instead explicitly format in Malaysia time.
//
// ============================================================

function formatTimestamp(
  date = new Date()
) {

  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
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

        second:
          "2-digit",

        hour12:
          false

      }
    ).formatToParts(
      date
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


  return (

    values.year +
    "-" +
    values.month +
    "-" +
    values.day +
    " " +
    values.hour +
    ":" +
    values.minute +
    ":" +
    values.second

  );

}


// ============================================================
// COLUMN NUMBER → LETTER
// ============================================================

function columnNumberToLetter(
  number
) {

  let result = "";

  let n =
    number;


  while (
    n > 0
  ) {

    const remainder =
      (n - 1) % 26;


    result =
      String.fromCharCode(
        65 +
        remainder
      ) +
      result;


    n =
      Math.floor(
        (n - 1) / 26
      );

  }


  return result;

}


// ============================================================
// SLEEP
// ============================================================

function sleep(
  milliseconds
) {

  return new Promise(
    function(resolve) {

      setTimeout(
        resolve,
        milliseconds
      );

    }
  );

}


// ============================================================
// GET SHEET HEADERS
// ============================================================

async function getSheetHeaders(
  sheetName
) {

  const sheets =
    await getGoogleSheets();


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        sheetName +
        "'!1:1"

    });


  const rows =
    response.data.values ||
    [];


  if (
    rows.length === 0
  ) {

    throw new Error(
      sheetName +
      " header row is empty."
    );

  }


  return rows[0];

}


// ============================================================
// GET STATS SUBMISSION HEADERS
// ============================================================

async function getStatsSubmissionHeaders() {

  return getSheetHeaders(
    STATS_SHEET_NAME
  );

}


// ============================================================
// LOG HEADERS
// ============================================================

function logHeaders(
  sheetName,
  headers
) {

  console.log(
    "[SHEETS] " +
    sheetName +
    " headers:"
  );


  headers.forEach(
    function(
      header,
      index
    ) {

      console.log(
        "[" +
        (index + 1) +
        "] " +
        JSON.stringify(
          header
        )
      );

    }
  );

}


// ============================================================
// DISCORD USERNAME NORMALIZATION
// ============================================================

function normalizeDiscordUsername(
  username
) {

  return String(
    username || ""
  )
    .trim()
    .toLowerCase();

}


// ============================================================
// FIND MEMBER
// ============================================================
//
// Members List:
//
// B = Name
// V = Discord Username
//
// ============================================================

async function findMemberByDiscordUsername(
  discordUsername
) {

  const sheets =
    await getGoogleSheets();


  const target =
    normalizeDiscordUsername(
      discordUsername
    );


  if (
    !target
  ) {

    return null;

  }


  console.log(
    "[MEMBER LOOKUP] Looking up:",
    discordUsername
  );


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        MEMBERS_SHEET_NAME +
        "'!B:V"

    });


  const rows =
    response.data.values ||
    [];


  if (
    rows.length < 2
  ) {

    return null;

  }


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i] ||
      [];


    const playerName =
      String(
        row[0] ||
        ""
      ).trim();


    const sheetUsername =
      String(
        row[20] ||
        ""
      ).trim();


    if (
      normalizeDiscordUsername(
        sheetUsername
      ) === target
    ) {

      console.log(
        "[MEMBER LOOKUP] MATCH:",
        playerName,
        "|",
        sheetUsername
      );


      return {

        name:
          playerName,

        discordUsername:
          sheetUsername

      };

    }

  }


  console.log(
    "[MEMBER LOOKUP] No match found:",
    discordUsername
  );


  return null;

}


// ============================================================
// WRITE DEFAULT CARDS
// ============================================================
//
// Every card slot gets:
//
//     2-star
//
// No card input is required from Discord.
//
// ============================================================

function writeDefaultCards(
  row,
  headerMap
) {

  console.log(
    "[SHEETS] Applying default 2-star cards..."
  );


  CARD_FIELDS.forEach(
    function(cardHeader) {

      const index =
        findHeaderIndex(
          headerMap,
          [cardHeader]
        );


      if (
        index === -1
      ) {

        console.warn(
          "[SHEETS] Card header not found:",
          cardHeader
        );

        return;

      }


      row[index] =
        DEFAULT_CARD_VALUE;


      console.log(
        "[SHEETS] Card:",
        cardHeader,
        "=> column",
        index + 1,
        "=",
        DEFAULT_CARD_VALUE
      );

    }
  );

}


// ============================================================
// BUILD STATS ROW
// ============================================================

function buildStatsRow(
  headers,
  member,
  selectedClass,
  stats
) {

  const headerMap =
    buildHeaderMap(
      headers
    );


  const row =
    new Array(
      headers.length
    ).fill("");


  // ----------------------------------------------------------
  // TIMESTAMP
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.timestamp,
    formatTimestamp(),
    "Timestamp"
  );


  // ----------------------------------------------------------
  // PLAYER
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.name,
    member.name,
    "Name"
  );


  // ----------------------------------------------------------
  // JOB CLASS
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.jobClassFirst,
    selectedClass,
    "Job Class (First Choice)"
  );


  // ----------------------------------------------------------
  // SECOND / THIRD CLASS
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.jobClassSecond,
    "",
    "Job Class (Second Choice)"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.jobClassThird,
    "",
    "Job Class (Third Choice)"
  );


  // ----------------------------------------------------------
  // GENERAL
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.hp,
    stats.hp,
    "HP"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.patk,
    stats.patk,
    "PATK"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.matk,
    stats.matk,
    "MATK"
  );


  // ----------------------------------------------------------
  // DEFENSE
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdef,
    stats.pdef,
    "PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdef,
    stats.mdef,
    "MDEF"
  );


  // ----------------------------------------------------------
  // COMBAT
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdmg,
    stats.pdmg,
    "PDMG %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdmg,
    stats.mdmg,
    "MDMG %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdmgReduction,
    stats.pdmgReduction,
    "PDMG Reduction %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdmgReduction,
    stats.mdmgReduction,
    "MDMG Reduction %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.critRes,
    stats.critRes,
    "Crit RES"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.ignorePDEF,
    stats.ignorePDEF,
    "Ignore PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.ignoreMDEF,
    stats.ignoreMDEF,
    "Ignore MDEF"
  );


  // ----------------------------------------------------------
  // PVP
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pvpBonus,
    stats.pvpBonus,
    "PvP Bonus"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pvpReduction,
    stats.pvpReduction,
    "PvP Reduction"
  );


  // ----------------------------------------------------------
  // TARGET DAMAGE
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.demiDamage,
    stats.demiDamage,
    "Demi Damage"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.demiReduction,
    stats.demiReduction,
    "Demi Reduction"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mediumDamage,
    stats.mediumDamage,
    "Medium Damage"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mediumReduction,
    stats.mediumReduction,
    "Medium Reduction"
  );


  // ----------------------------------------------------------
  // EQUIPMENT
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.equipmentPDEF,
    stats.equipmentPDEF,
    "Equipment PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.equipmentMDEF,
    stats.equipmentMDEF,
    "Equipment MDEF"
  );


  // ----------------------------------------------------------
  // CARDS
  // ----------------------------------------------------------

  writeDefaultCards(
    row,
    headerMap
  );


  return row;

}


// ============================================================
// VALIDATE REQUIRED STATS HEADERS
// ============================================================

function validateRequiredHeaders(
  headers
) {

  const headerMap =
    buildHeaderMap(
      headers
    );


  const required = [

    {
      label:
        "Timestamp",

      aliases:
        HEADER_ALIASES.timestamp
    },

    {
      label:
        "Name",

      aliases:
        HEADER_ALIASES.name
    },

    {
      label:
        "Job Class",

      aliases:
        HEADER_ALIASES.jobClassFirst
    },

    {
      label:
        "PATK",

      aliases:
        HEADER_ALIASES.patk
    },

    {
      label:
        "MATK",

      aliases:
        HEADER_ALIASES.matk
    },

    {
      label:
        "HP",

      aliases:
        HEADER_ALIASES.hp
    }

  ];


  const missing = [];


  required.forEach(
    function(field) {

      if (
        findHeaderIndex(
          headerMap,
          field.aliases
        ) === -1
      ) {

        missing.push(
          field.label
        );

      }

    }
  );


  if (
    missing.length > 0
  ) {

    throw new Error(
      "Stats Submission is missing required headers: " +
      missing.join(", ")
    );

  }

}


// ============================================================
// SUBMIT STATS
// ============================================================
//
// Supports BOTH:
//
// submitStats(
//   member,
//   selectedClass,
//   stats
// )
//
// AND the current stats.js:
//
// submitStats({
//   name,
//   jobClass,
//   stats,
//   cardAvailability
// })
//
// ============================================================

async function submitStats(
  member,
  selectedClass,
  stats
) {

  // ----------------------------------------------------------
  // SUPPORT CURRENT OBJECT-STYLE CALL
  // ----------------------------------------------------------

  if (
    arguments.length === 1 &&
    member &&
    typeof member === "object" &&
    member.stats
  ) {

    const submission =
      member;


    stats =
      submission.stats;


    selectedClass =
      submission.jobClass ||
      submission.jobClassFirst ||
      submission.mainClass;


    member = {

      name:
        submission.name,

      discordUsername:
        submission.discordUsername

    };

  }


  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------

  if (
    !member ||
    !member.name
  ) {

    throw new Error(
      "Invalid member information."
    );

  }


  if (
    !selectedClass
  ) {

    throw new Error(
      "No job class was selected."
    );

  }


  if (
    !stats
  ) {

    throw new Error(
      "No stats were supplied."
    );

  }


  console.log(
    "[SHEETS] ========================================"
  );

  console.log(
    "[SHEETS] SUBMITTING STATS"
  );

  console.log(
    "[SHEETS] Player:",
    member.name
  );

  console.log(
    "[SHEETS] Job Class:",
    selectedClass
  );

  console.log(
    "[SHEETS] ========================================"
  );


  const sheets =
    await getGoogleSheets();


  // ----------------------------------------------------------
  // READ ACTUAL HEADERS
  // ----------------------------------------------------------

  const headers =
    await getStatsSubmissionHeaders();


  logHeaders(
    STATS_SHEET_NAME,
    headers
  );


  validateRequiredHeaders(
    headers
  );


  // ----------------------------------------------------------
  // BUILD HEADER-DRIVEN ROW
  // ----------------------------------------------------------

  const row =
    buildStatsRow(
      headers,
      member,
      selectedClass,
      stats
    );


  // ----------------------------------------------------------
  // APPEND
  // ----------------------------------------------------------

  const endColumn =
    columnNumberToLetter(
      headers.length
    );


  const range =
    "'" +
    STATS_SHEET_NAME +
    "'!A:" +
    endColumn;


  console.log(
    "[SHEETS] Writing range:",
    range
  );


  let appendResponse;


  try {

    appendResponse =
      await sheets.spreadsheets.values.append({

        spreadsheetId:
          SPREADSHEET_ID,

        range,

        valueInputOption:
          "RAW",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {

          values: [
            row
          ]

        }

      });

  } catch (error) {

    console.error(
      "[SHEETS] Stats Submission write FAILED:",
      error
    );

    throw error;

  }


  console.log(
    "[SHEETS] Stats Submission written:",
    appendResponse
      ?.data
      ?.updates
      ?.updatedRange
  );


  // ----------------------------------------------------------
  // REFRESH REPORTS
  // ----------------------------------------------------------

  let refreshResult =
    null;


  try {

    refreshResult =
      await refreshGoogleReports();

  } catch (error) {

    console.error(
      "[SHEETS] Report refresh failed:",
      error
    );


    // IMPORTANT:
    //
    // The Stats Submission was already written.
    // Do not report this as a failed submission.

    return {

      success:
        true,

      submitted:
        true,

      reportsRefreshed:
        false,

      playerName:
        member.name,

      jobClass:
        selectedClass,

      timestamp:
        formatTimestamp(),

      refreshedPlayer:
        null,

      refreshError:
        error.message

    };

  }


  // ----------------------------------------------------------
  // WAIT FOR GOOGLE REPORTS
  // ----------------------------------------------------------

  await sleep(
    1500
  );


  // ----------------------------------------------------------
  // READ REFRESHED PROFILE
  // ----------------------------------------------------------

  let refreshedPlayer =
    null;


  try {

    refreshedPlayer =
      await getRefreshedPlayerProfile(
        member.name
      );

  } catch (error) {

    console.error(
      "[SHEETS] Could not read refreshed Player Profile:",
      error
    );

  }


  return {

    success:
      true,

    submitted:
      true,

    reportsRefreshed:
      true,

    playerName:
      member.name,

    jobClass:
      selectedClass,

    timestamp:
      formatTimestamp(),

    refreshedPlayer,

    refreshResult

  };

}


// ============================================================
// BUILD APPLICANTS ROW
// ============================================================

function buildApplicantsRow(
  headers,
  discordUsername,
  applicantName,
  selectedClass,
  stats
) {

  const headerMap =
    buildHeaderMap(
      headers
    );


  const row =
    new Array(
      headers.length
    ).fill("");


  // ----------------------------------------------------------
  // TIMESTAMP
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.timestamp,
    formatTimestamp(),
    "Timestamp"
  );


  // ----------------------------------------------------------
  // NAME
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.name,
    applicantName,
    "Name"
  );


  // ----------------------------------------------------------
  // DISCORD
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.discordUsername,
    discordUsername,
    "Discord Username"
  );


  // ----------------------------------------------------------
  // CLASS
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.jobClassFirst,
    selectedClass,
    "Main Class"
  );


  // ----------------------------------------------------------
  // GENERAL
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.hp,
    stats.hp,
    "HP"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.patk,
    stats.patk,
    "PATK"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.matk,
    stats.matk,
    "MATK"
  );


  // ----------------------------------------------------------
  // DEFENSE
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdef,
    stats.pdef,
    "PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdef,
    stats.mdef,
    "MDEF"
  );


  // ----------------------------------------------------------
  // COMBAT
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.ignorePDEF,
    stats.ignorePDEF,
    "Ignore PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.ignoreMDEF,
    stats.ignoreMDEF,
    "Ignore MDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.demiDamage,
    stats.demiDamage,
    "Demi Damage"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.demiReduction,
    stats.demiReduction,
    "Demi Reduction"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mediumDamage,
    stats.mediumDamage,
    "Medium Damage"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mediumReduction,
    stats.mediumReduction,
    "Medium Reduction"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdmg,
    stats.pdmg,
    "PDMG %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdmg,
    stats.mdmg,
    "MDMG %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pdmgReduction,
    stats.pdmgReduction,
    "PDMG Reduction %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.mdmgReduction,
    stats.mdmgReduction,
    "MDMG Reduction %"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.critRes,
    stats.critRes,
    "Crit RES"
  );


  // ----------------------------------------------------------
  // PVP
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pvpBonus,
    stats.pvpBonus,
    "PvP Bonus"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.pvpReduction,
    stats.pvpReduction,
    "PvP Reduction"
  );


  // ----------------------------------------------------------
  // EQUIPMENT
  // ----------------------------------------------------------

  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.equipmentPDEF,
    stats.equipmentPDEF,
    "Equipment PDEF"
  );


  setHeaderValue(
    row,
    headerMap,
    HEADER_ALIASES.equipmentMDEF,
    stats.equipmentMDEF,
    "Equipment MDEF"
  );


  // ----------------------------------------------------------
  // CARDS
  // ----------------------------------------------------------

  writeDefaultCards(
    row,
    headerMap
  );


  return row;

}


// ============================================================
// SUBMIT APPLICATION
// ============================================================
//
// FLOW:
//
// Applicants
//     ↓
// refreshGoogleReports()
//     ↓
// Applicant Database
//     ↓
// Applicant Analysis
//     ↓
// Applicant Profile
//
// ============================================================

async function submitApplication(
  discordUsername,
  applicantName,
  selectedClass,
  stats
) {

  if (
    !applicantName
  ) {

    throw new Error(
      "Applicant name is required."
    );

  }


  if (
    !selectedClass
  ) {

    throw new Error(
      "Main Class is required."
    );

  }


  if (
    !stats
  ) {

    throw new Error(
      "No stats were supplied."
    );

  }


  console.log(
    "[SHEETS] ========================================"
  );

  console.log(
    "[SHEETS] SUBMITTING APPLICATION"
  );

  console.log(
    "[SHEETS] Destination: Applicants"
  );

  console.log(
    "[SHEETS] Applicant:",
    applicantName
  );

  console.log(
    "[SHEETS] Class:",
    selectedClass
  );

  console.log(
    "[SHEETS] ========================================"
  );


  const sheets =
    await getGoogleSheets();


  // ----------------------------------------------------------
  // READ APPLICANTS HEADERS
  // ----------------------------------------------------------

  const headers =
    await getSheetHeaders(
      APPLICANTS_SHEET_NAME
    );


  logHeaders(
    APPLICANTS_SHEET_NAME,
    headers
  );


  // ----------------------------------------------------------
  // BUILD ROW
  // ----------------------------------------------------------

  const row =
    buildApplicantsRow(
      headers,
      discordUsername,
      applicantName,
      selectedClass,
      stats
    );


  // ----------------------------------------------------------
  // APPEND TO APPLICANTS
  // ----------------------------------------------------------

  const endColumn =
    columnNumberToLetter(
      headers.length
    );


  const range =
    "'" +
    APPLICANTS_SHEET_NAME +
    "'!A:" +
    endColumn;


  console.log(
    "[SHEETS] Writing Applicants range:",
    range
  );


  let appendResponse;


  try {

    appendResponse =
      await sheets.spreadsheets.values.append({

        spreadsheetId:
          SPREADSHEET_ID,

        range,

        valueInputOption:
          "RAW",

        insertDataOption:
          "INSERT_ROWS",

        requestBody: {

          values: [
            row
          ]

        }

      });

  } catch (error) {

    console.error(
      "[SHEETS] Applicants write FAILED:",
      error
    );

    throw new Error(
      "Could not write application to Applicants sheet: " +
      error.message
    );

  }


  console.log(
    "[SHEETS] Applicants row written:",
    appendResponse
      ?.data
      ?.updates
      ?.updatedRange
  );


  // ----------------------------------------------------------
  // REFRESH REPORTS
  // ----------------------------------------------------------

  let refreshResult;


  try {

    refreshResult =
      await refreshGoogleReports();

  } catch (error) {

    console.error(
      "[SHEETS] Report refresh failed after Applicants write:",
      error
    );


    return {

      success:
        true,

      submitted:
        true,

      applicantsWritten:
        true,

      reportsRefreshed:
        false,

      applicantName,

      selectedClass,

      refreshError:
        error.message

    };

  }


  // ----------------------------------------------------------
  // WAIT
  // ----------------------------------------------------------

  await sleep(
    1500
  );


  console.log(
    "[SHEETS] Applicant Database refresh requested."
  );

  console.log(
    "[SHEETS] Applicant Analysis refresh requested."
  );

  console.log(
    "[SHEETS] Applicant Profile refresh requested."
  );


  return {

    success:
      true,

    submitted:
      true,

    applicantsWritten:
      true,

    reportsRefreshed:
      true,

    applicantName,

    selectedClass,

    refreshResult

  };

}


// ============================================================
// REFRESH GOOGLE REPORTS
// ============================================================
//
// Uses:
//
// APPS_SCRIPT_REFRESH_URL
//
// from .env.
//
// ============================================================

async function refreshGoogleReports() {

  if (
    !APPS_SCRIPT_REFRESH_URL
  ) {

    throw new Error(
      "APPS_SCRIPT_REFRESH_URL is not configured in .env."
    );

  }


  console.log(
    "[SHEETS] Refreshing Google reports..."
  );


  console.log(
    "[SHEETS] Apps Script refresh URL configured:",
    APPS_SCRIPT_REFRESH_URL
      .replace(
        /\/s\/[^/]+\/exec$/,
        "/s/***/exec"
      )
  );


  let response;


  try {

    response =
      await fetch(
        APPS_SCRIPT_REFRESH_URL,
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              action:
                "refreshAllReports"

            })

        }
      );

  } catch (error) {

    throw new Error(
      "Could not connect to Apps Script: " +
      error.message
    );

  }


  const responseText =
    await response.text();


  console.log(
    "[SHEETS] Apps Script HTTP status:",
    response.status
  );


  console.log(
    "[SHEETS] Apps Script response:",
    responseText
  );


  if (
    !response.ok
  ) {

    throw new Error(
      "Apps Script returned HTTP " +
      response.status +
      ": " +
      responseText
    );

  }


  let result;


  try {

    result =
      JSON.parse(
        responseText
      );

  } catch (error) {

    result = {

      success:
        true,

      raw:
        responseText

    };

  }


  if (
    result &&
    result.success === false
  ) {

    throw new Error(
      result.error ||
      "Apps Script refresh failed."
    );

  }


  console.log(
    "[SHEETS] Reports refreshed successfully."
  );


  return result;

}


// ============================================================
// GET PLAYER PROFILE HEADERS
// ============================================================

async function getPlayerProfileHeaders() {

  const sheets =
    await getGoogleSheets();


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        PLAYER_PROFILE_SHEET_NAME +
        "'!1:1"

    });


  const rows =
    response.data.values ||
    [];


  if (
    rows.length === 0
  ) {

    return [];

  }


  return rows[0];

}


// ============================================================
// GET REFRESHED PLAYER PROFILE
// ============================================================

async function getRefreshedPlayerProfile(
  playerName
) {

  const sheets =
    await getGoogleSheets();


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        PLAYER_PROFILE_SHEET_NAME +
        "'!A:ZZ"

    });


  const rows =
    response.data.values ||
    [];


  if (
    rows.length < 2
  ) {

    console.warn(
      "[SHEETS] Player Profile contains no data."
    );

    return null;

  }


  const headers =
    rows[0];


  const headerMap =
    buildHeaderMap(
      headers
    );


  const nameIndex =
    findHeaderIndex(
      headerMap,
      HEADER_ALIASES.name
    );


  if (
    nameIndex === -1
  ) {

    console.warn(
      "[SHEETS] Player Profile has no Name column."
    );

    return null;

  }


  const target =
    String(
      playerName
    )
      .trim()
      .toLowerCase();


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i] ||
      [];


    const rowName =
      String(
        row[nameIndex] ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      rowName !== target
    ) {

      continue;

    }


    const profile =
      {};


    headers.forEach(
      function(
        header,
        index
      ) {

        profile[
          header
        ] =
          row[index] ??
          "";

      }
    );


    return profile;

  }


  console.warn(
    "[SHEETS] Player not found in Player Profile:",
    playerName
  );


  return null;

}


// ============================================================
// GET LATEST STATS FOR PLAYER
// ============================================================

async function getLatestStatsForPlayer(
  playerName
) {

  const sheets =
    await getGoogleSheets();


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        STATS_SHEET_NAME +
        "'!A:ZZ"

    });


  const rows =
    response.data.values ||
    [];


  if (
    rows.length < 2
  ) {

    return null;

  }


  const headers =
    rows[0];


  const headerMap =
    buildHeaderMap(
      headers
    );


  const nameIndex =
    findHeaderIndex(
      headerMap,
      HEADER_ALIASES.name
    );


  const timestampIndex =
    findHeaderIndex(
      headerMap,
      HEADER_ALIASES.timestamp
    );


  if (
    nameIndex === -1
  ) {

    throw new Error(
      "Stats Submission is missing the Name column."
    );

  }


  let latestRow =
    null;


  let latestTimestamp =
    new Date(0);


  const target =
    String(
      playerName || ""
    )
      .trim()
      .toLowerCase();


  for (
    let i = 1;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i] ||
      [];


    const rowName =
      String(
        row[nameIndex] ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      rowName !== target
    ) {

      continue;

    }


    if (
      latestRow === null
    ) {

      latestRow =
        row;


      if (
        timestampIndex !== -1
      ) {

        latestTimestamp =
          parseTimestamp(
            row[
              timestampIndex
            ]
          );

      }


      continue;

    }


    if (
      timestampIndex === -1
    ) {

      latestRow =
        row;

      continue;

    }


    const currentTimestamp =
      parseTimestamp(
        row[
          timestampIndex
        ]
      );


    if (
      currentTimestamp >
      latestTimestamp
    ) {

      latestRow =
        row;

      latestTimestamp =
        currentTimestamp;

    }

  }


  if (
    latestRow === null
  ) {

    return null;

  }


  const result =
    {};


  headers.forEach(
    function(
      header,
      index
    ) {

      result[
        header
      ] =
        latestRow[index] ??
        "";

    }
  );


  return result;

}


// ============================================================
// PARSE TIMESTAMP
// ============================================================

function parseTimestamp(
  value
) {

  if (
    !value
  ) {

    return new Date(0);

  }


  const text =
    String(
      value
    ).trim();


  const match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/
    );


  if (
    match
  ) {

    /*
     * Timestamp is Malaysia time.
     *
     * Convert the displayed Malaysia timestamp to an
     * absolute UTC timestamp for comparison.
     */

    const year =
      Number(
        match[1]
      );

    const month =
      Number(
        match[2]
      );

    const day =
      Number(
        match[3]
      );

    const hour =
      Number(
        match[4]
      );

    const minute =
      Number(
        match[5]
      );

    const second =
      Number(
        match[6]
      );


    return new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        hour - 8,
        minute,
        second
      )
    );

  }


  const parsed =
    new Date(
      text
    );


  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return new Date(0);

  }


  return parsed;

}


// ============================================================
// GET MEMBERS
// ============================================================

async function getMembers() {

  const sheets =
    await getGoogleSheets();


  const response =
    await sheets.spreadsheets.values.get({

      spreadsheetId:
        SPREADSHEET_ID,

      range:
        "'" +
        MEMBERS_SHEET_NAME +
        "'!B:V"

    });


  return (
    response.data.values ||
    []
  );

}


// ============================================================
// TEST MEMBER LOOKUP
// ============================================================

async function testMemberLookup(
  discordUsername
) {

  console.log(
    "[MEMBER LOOKUP TEST]",
    discordUsername
  );


  const member =
    await findMemberByDiscordUsername(
      discordUsername
    );


  console.log(
    "[MEMBER LOOKUP TEST RESULT]",
    member
  );


  return member;

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

  findMemberByDiscordUsername,

  submitStats,

  submitApplication,

  refreshGoogleReports,

  getLatestStatsForPlayer,

  getRefreshedPlayerProfile,

  getPlayerProfileHeaders,

  getMembers,

  testMemberLookup

};