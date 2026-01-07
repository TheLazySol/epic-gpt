import { prisma } from './prisma.js';
import { SESSION } from '../config/constants.js';
import type { GuildConfig, KnowledgeItem, ConversationSession, Prisma } from '@prisma/client';

// ============================================================================
// Guild Config
// ============================================================================

export async function getGuildConfig(guildId: string): Promise<GuildConfig | null> {
  return prisma.guildConfig.findUnique({
    where: { id: guildId },
  });
}

export async function getOrCreateGuildConfig(guildId: string): Promise<GuildConfig> {
  return prisma.guildConfig.upsert({
    where: { id: guildId },
    create: { id: guildId },
    update: {},
  });
}

export async function updateGuildVectorStoreId(
  guildId: string,
  vectorStoreId: string
): Promise<GuildConfig> {
  return prisma.guildConfig.upsert({
    where: { id: guildId },
    create: { id: guildId, vectorStoreId },
    update: { vectorStoreId },
  });
}

// ============================================================================
// Knowledge Items
// ============================================================================

export async function createKnowledgeItem(data: {
  guildId: string;
  kind: 'FILE' | 'URL';
  title: string;
  sourceUrl?: string;
  openaiFileId: string;
  vectorStoreFileId: string;
  contentHash: string;
  createdByDiscordUserId: string;
}): Promise<KnowledgeItem> {
  return prisma.knowledgeItem.create({
    data,
  });
}

export async function getKnowledgeItems(guildId: string): Promise<KnowledgeItem[]> {
  return prisma.knowledgeItem.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getKnowledgeItemById(id: string): Promise<KnowledgeItem | null> {
  return prisma.knowledgeItem.findUnique({
    where: { id },
  });
}

export async function getKnowledgeItemByHash(
  guildId: string,
  contentHash: string
): Promise<KnowledgeItem | null> {
  return prisma.knowledgeItem.findFirst({
    where: { guildId, contentHash },
  });
}

export async function deleteKnowledgeItem(id: string): Promise<KnowledgeItem> {
  return prisma.knowledgeItem.delete({
    where: { id },
  });
}

export async function updateKnowledgeItem(
  id: string,
  data: {
    openaiFileId?: string;
    vectorStoreFileId?: string;
    contentHash?: string;
  }
): Promise<KnowledgeItem> {
  return prisma.knowledgeItem.update({
    where: { id },
    data,
  });
}

// ============================================================================
// Conversation Sessions
// ============================================================================

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function getSession(
  guildId: string,
  userId: string,
  channelId: string
): Promise<{ session: ConversationSession; messages: SessionMessage[] } | null> {
  const session = await prisma.conversationSession.findUnique({
    where: {
      guildId_userId_channelId: { guildId, userId, channelId },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    await prisma.conversationSession.delete({
      where: { id: session.id },
    });
    return null;
  }

  try {
    // Handle both JSON object and string formats
    const messages = (
      typeof session.messages === 'string'
        ? JSON.parse(session.messages)
        : session.messages
    ) as SessionMessage[];
    return { session, messages };
  } catch {
    return null;
  }
}

export async function saveSession(
  guildId: string,
  userId: string,
  channelId: string,
  messages: SessionMessage[]
): Promise<ConversationSession> {
  // Ensure guild config exists before saving session
  await getOrCreateGuildConfig(guildId);

  const expiresAt = new Date(Date.now() + SESSION.TTL_MS);
  const limitedMessages = messages.slice(-SESSION.MAX_MESSAGES) as unknown as Prisma.InputJsonValue;

  return prisma.conversationSession.upsert({
    where: {
      guildId_userId_channelId: { guildId, userId, channelId },
    },
    create: {
      guildId,
      userId,
      channelId,
      messages: limitedMessages,
      expiresAt,
    },
    update: {
      messages: limitedMessages,
      expiresAt,
    },
  });
}

export async function clearSession(
  guildId: string,
  userId: string,
  channelId: string
): Promise<void> {
  await prisma.conversationSession.deleteMany({
    where: { guildId, userId, channelId },
  });
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.conversationSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

// ============================================================================
// Request Logs
// ============================================================================

export async function createRequestLog(data: {
  guildId: string;
  userId: string;
  command: 'chat' | 'search';
  usedFileSearch?: boolean;
  usedWebSearch?: boolean;
  toolCalls?: unknown[];
  error?: string;
}): Promise<void> {
  // Ensure guild config exists before creating request log
  await getOrCreateGuildConfig(data.guildId);

  await prisma.requestLog.create({
    data: {
      guildId: data.guildId,
      userId: data.userId,
      command: data.command,
      usedFileSearch: data.usedFileSearch ?? false,
      usedWebSearch: data.usedWebSearch ?? false,
      toolCalls: data.toolCalls as Prisma.InputJsonValue | undefined,
      error: data.error,
    },
  });
}

// Cleanup expired sessions periodically
setInterval(
  async () => {
    try {
      const count = await cleanupExpiredSessions();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} expired sessions`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired sessions:', error);
    }
  },
  5 * 60 * 1000 // Every 5 minutes
);
