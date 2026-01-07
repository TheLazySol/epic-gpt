import { REST, Routes } from 'discord.js';
import type { Client } from 'discord.js';
import { env } from '../config/env.js';

// Import all commands
import { chatCommand } from '../commands/chat.js';
import { searchCommand } from '../commands/search.js';
import { helpCommand } from '../commands/help.js';
import { kbAddFileCommand } from '../commands/kb_add_file.js';
import { kbAddUrlCommand } from '../commands/kb_add_url.js';
import { kbListCommand } from '../commands/kb_list.js';
import { kbRemoveCommand } from '../commands/kb_remove.js';
import { kbRefreshCommand } from '../commands/kb_refresh.js';

const commands = [
  chatCommand,
  searchCommand,
  helpCommand,
  kbAddFileCommand,
  kbAddUrlCommand,
  kbListCommand,
  kbRemoveCommand,
  kbRefreshCommand,
];

export async function registerCommands(client: Client): Promise<void> {
  // Register commands in the client's collection
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }

  // Deploy commands to Discord API
  const rest = new REST().setToken(env.DISCORD_TOKEN);

  try {
    console.log(`🔄 Registering ${commands.length} slash commands...`);

    const commandData = commands.map((cmd) => cmd.data.toJSON());

    // Register globally (use applicationGuildCommands for faster testing in dev)
    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
      body: commandData,
    });

    console.log(`✅ Successfully registered ${commands.length} slash commands`);
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
    throw error;
  }
}

export default registerCommands;
