require("dotenv").config();

module.exports = {

  discord: {

    token:
      process.env.DISCORD_TOKEN,

    clientId:
      process.env.DISCORD_CLIENT_ID,

    guildId:
      process.env.DISCORD_GUILD_ID

  },

  openai: {

    apiKey:
      process.env.OPENAI_API_KEY

  },

  google: {

    spreadsheetId:
      process.env.GOOGLE_SPREADSHEET_ID,

    credentialsPath:
      "./credentials/google-service-account.json"

  }

};