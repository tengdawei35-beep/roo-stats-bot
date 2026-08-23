require("dotenv").config();

const {
  startWeeklyStatsReminder
} =
  require("./services/weeklyStatsReminder");

const statsReminderCommand =
  require("./commands/statsreminder");

const checkCommand =
  require("./commands/check");

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes
} = require("discord.js");

const config =
  require("./config");

const statsCommand =
  require("./commands/stats");

const applyCommand =
  require("./commands/apply");


// ============================================================
// BOOT
// ============================================================

console.log("[BOOT] index.js starting");

console.log(
  "[BOOT] dotenv loaded"
);


// ============================================================
// CLIENT
// ============================================================

const client =
  new Client({

    intents: [

      GatewayIntentBits.Guilds,

      GatewayIntentBits.GuildMessages,

      GatewayIntentBits.MessageContent

    ]

  });


// ============================================================
// COMMAND COLLECTION
// ============================================================

client.commands =
  new Collection();


// /stats

client.commands.set(
  statsCommand.data.name,
  statsCommand
);


// /apply

client.commands.set(
  applyCommand.data.name,
  applyCommand
);

//statsreminder

client.commands.set(
  statsReminderCommand.data.name,
  statsReminderCommand
);

//check

client.commands.set(
  checkCommand.data.name,
  checkCommand
);

console.log(
  "[BOOT] Commands loaded:",
  Array.from(
    client.commands.keys()
  ).join(", ")
);


// ============================================================
// DISCORD REST CLIENT
// ============================================================

const rest =
  new REST({
    version: "10"
  }).setToken(
    config.discord.token
  );


// ============================================================
// REGISTER SLASH COMMANDS
// ============================================================

async function registerCommands() {

  console.log(
    "[DISCORD] Registering slash commands..."
  );


  const commands =
    Array.from(
      client.commands.values()
    ).map(
      function(command) {

        return command.data.toJSON();

      }
    );


  await rest.put(

    Routes.applicationGuildCommands(

      config.discord.clientId,

      config.discord.guildId

    ),

    {

      body:
        commands

    }

  );


  console.log(
    "[DISCORD] Slash commands registered:",
    commands
      .map(
        function(command) {

          return "/" + command.name;

        }
      )
      .join(", ")
  );

}


// ============================================================
// READY
// ============================================================

client.once(
  "ready",
  async function() {

    console.log(
      `[DISCORD] Logged in as ${client.user.tag}`
    );

    console.log(
      "[VERSION] V2.3 - /check added"
    );

    console.log(
      "[DISCORD] Guild:",
      config.discord.guildId
    );


    try {

  await registerCommands();

  startWeeklyStatsReminder(
    client
  );

  } catch (error) {

    console.error(
      "[DISCORD] Failed to register slash commands:",
      error
    );

  }

  }
);


// ============================================================
// INTERACTION HANDLER
// ============================================================

client.on(
  "interactionCreate",
  async function(interaction) {

    // --------------------------------------------------------
    // SLASH COMMANDS
    // --------------------------------------------------------

    if (
      interaction.isChatInputCommand()
    ) {

      const command =
        client.commands.get(
          interaction.commandName
        );


      if (
        !command
      ) {

        console.warn(
          "[DISCORD] Unknown command:",
          interaction.commandName
        );

        return;

      }


      console.log(
        "[DISCORD] Command:",
        "/" +
        interaction.commandName,
        "| User:",
        interaction.user.tag
      );


      try {

        await command.execute(
          interaction
        );

      } catch (error) {

        console.error(
          `[DISCORD] Error executing /${interaction.commandName}:`,
          error
        );


        const message =
          "Something went wrong while processing the command.";


        try {

          if (
            interaction.replied ||
            interaction.deferred
          ) {

            await interaction.followUp({

              content:
                message,

              ephemeral:
                true

            });

          } else {

            await interaction.reply({

              content:
                message,

              ephemeral:
                true

            });

          }

        } catch (replyError) {

          console.error(
            "[DISCORD] Could not send error response:",
            replyError
          );

        }

      }


      return;

    }

  }
);


// ============================================================
// LOGIN
// ============================================================

if (
  !config.discord.token
) {

  console.error(
    "[BOOT] Discord token is missing."
  );

  process.exit(
    1
  );

}


if (
  !config.discord.clientId
) {

  console.error(
    "[BOOT] Discord client ID is missing."
  );

  process.exit(
    1
  );


}


if (
  !config.discord.guildId
) {

  console.error(
    "[BOOT] Discord guild ID is missing."
  );

  process.exit(
    1
  );

}


console.log(
  "[BOOT] Starting Discord client..."
);


client.login(
  config.discord.token
);