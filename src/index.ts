import { Events } from 'discord.js';
import { createClient } from './discord/client.js';
import { registerCommands } from './discord/registerCommands.js';
import { env } from './config/env.js';
import { BOT } from './config/constants.js';
import { prisma } from './db/prisma.js';
import { closeBrowser } from './kb/fetchUrl.js';

// Create Discord client
const client = createClient();

// Handle ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ ${BOT.NAME} is online as ${readyClient.user.tag}`);
  console.log(`📊 Serving ${readyClient.guilds.cache.size} guild(s)`);

  // Register slash commands
  await registerCommands(client);
});

// Handle interaction events
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ There was an error while executing this command!',
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: '❌ There was an error while executing this command!',
          ephemeral: true,
        });
      }
    } catch (replyError) {
      console.error('Failed to send error reply:', replyError);
    }
  }
});

// Handle errors
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    // Close Playwright browser
    await closeBrowser();

    // Disconnect Prisma
    await prisma.$disconnect();

    // Destroy Discord client
    client.destroy();

    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Start the bot
async function main() {
  console.log(`🚀 Starting ${BOT.NAME}...`);
  console.log(`📌 Environment: ${env.NODE_ENV}`);

  try {
    // Connect to database
    await prisma.$connect();
    console.log('✅ Database connected');

    // Login to Discord
    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

main();
