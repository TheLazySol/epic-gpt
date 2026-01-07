import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import type { Command } from '../types/command.js';

// Extend the Discord.js Client to include our commands collection
declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}

// Create Discord client with required intents
export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
    partials: [Partials.Channel],
  });

  // Initialize commands collection
  client.commands = new Collection();

  return client;
}

export default createClient;
