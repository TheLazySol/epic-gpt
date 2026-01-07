# EpicGPT Discord Bot

A Discord bot for Epicentral Labs that answers questions using a knowledge base (RAG via OpenAI Vector Stores), web search, and live API tools.

## Features

- **Knowledge Base (RAG)**: Answers from uploaded documents, PDFs, and URLs via OpenAI Vector Stores
- **Web Search**: Real-time web search via Serper.dev (only with `/search` command)
- **API Tools**: Live data from Solana RPC and Birdeye (balances, token supply, prices)
- **Session Context**: Maintains conversation history per user/channel
- **Admin Controls**: Add, remove, and refresh knowledge base items

## Commands

### User Commands
- `/chat prompt:<text>` - Chat with EpicGPT using knowledge base and API tools
- `/search prompt:<text>` - Search the web with citations + knowledge base
- `/help` - Show usage and available sources

### Admin Commands (Requires "Manage Guild" permission)
- `/kb_add_file` - Upload a file to the knowledge base
- `/kb_add_url url:<url>` - Add a URL to the knowledge base
- `/kb_list` - List all knowledge base items
- `/kb_remove id:<id>` - Remove a knowledge base item
- `/kb_refresh id:<id>` - Refresh/re-ingest a knowledge base item

## Setup

### Prerequisites
- Node.js 20+
- pnpm
- Discord Bot Token
- OpenAI API Key
- Serper.dev API Key (for web search)
- Birdeye API Key (for token prices)
- PostgreSQL database (Prisma Postgres recommended)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd epicgpt
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database URL
   ```

4. Generate Prisma client and run migrations:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. Build and start:
   ```bash
   pnpm build
   pnpm start
   ```

### Local Development with SQLite

For local development, you can use SQLite instead of PostgreSQL:

1. Copy the SQLite schema:
   ```bash
   cp prisma/schema.dev.prisma prisma/schema.prisma
   ```

2. Update `.env`:
   ```
   DATABASE_URL="file:./dev.db"
   ```

3. Push the schema:
   ```bash
   pnpm db:push
   ```

### Development

```bash
pnpm dev  # Runs with hot reload via tsx
```

### Deployment (Render)

1. Push your code to a Git repository
2. Create a new Web Service on Render
3. Use the `render.yaml` blueprint or configure manually:
   - Build Command: `pnpm install && pnpm db:generate && pnpm build`
   - Start Command: `pnpm db:migrate:deploy && pnpm start`
4. Set environment variables in Render dashboard
5. Create a PostgreSQL database and link it

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DISCORD_CLIENT_ID` | Yes | Discord application client ID |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `DATABASE_URL` | Yes | Prisma database connection string |
| `SERPER_API_KEY` | Yes | Serper.dev API key for web search |
| `SOLANA_RPC_URL` | No | Solana RPC endpoint (defaults to mainnet) |
| `BIRDEYE_API_KEY` | Yes | Birdeye API key for token prices |
| `ADMIN_ROLE_ID` | No | Override admin role (defaults to "Manage Guild" permission) |
| `NODE_ENV` | No | `development` or `production` |

## Architecture

```
src/
├── index.ts              # Entry point
├── config/               # Environment and constants
├── discord/              # Discord client and command registration
├── commands/             # Slash command handlers
├── guards/               # Permission and rate limit guards
├── ai/                   # OpenAI client and orchestration
├── kb/                   # Knowledge base ingestion
├── tools/                # API tools (Solana, Birdeye)
├── db/                   # Prisma client and helpers
└── utils/                # Utilities (error handling, message splitting)
```

## License

MIT
