import { supabase } from '../config/database.js';
import { encryptionService } from './encryption.service.js';

export interface IChatConversation {
  id: string;
  created_at: string;
  updated_at: string;
  participants: { user_id: string; full_name: string | null }[];
  last_message: { content: string; sender_id: string; created_at: string } | null;
  unread_count: number;
}

export interface IChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

/**
 * Расшифровать контент или вернуть как есть (для старых незашифрованных сообщений)
 */
const decryptOrPassthrough = (content: string): string => {
  // Encrypted format: hex:hex:hex (iv:authTag:encrypted)
  if (/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i.test(content)) {
    try {
      return encryptionService.decrypt(content);
    } catch {
      return content;
    }
  }
  return content;
};

export const chatService = {
  /**
   * Получить или создать диалог между двумя пользователями
   */
  async getOrCreateConversation(userId1: string, userId2: string): Promise<string> {
    // Ищем существующий диалог между этими двумя пользователями
    const { data: existing } = await supabase
      .rpc('find_direct_conversation', { user1: userId1, user2: userId2 });

    if (existing && existing.length > 0) {
      return existing[0].conversation_id;
    }

    // Создаём новый диалог
    const { data: conv, error: convError } = await supabase
      .from('chat_conversations')
      .insert({})
      .select('id')
      .single();

    if (convError || !conv) {
      throw new Error('Failed to create conversation');
    }

    // Добавляем участников
    await supabase
      .from('chat_participants')
      .insert([
        { conversation_id: conv.id, user_id: userId1 },
        { conversation_id: conv.id, user_id: userId2 },
      ]);

    return conv.id;
  },

  /**
   * Отправить сообщение (шифрует контент перед сохранением)
   */
  async sendMessage(conversationId: string, senderId: string, content: string): Promise<IChatMessage> {
    // Проверяем что отправитель — участник
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', senderId)
      .single();

    if (!participant) {
      throw new Error('Not a participant of this conversation');
    }

    const plainContent = content.trim();
    const encryptedContent = encryptionService.encrypt(plainContent);

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: encryptedContent,
      })
      .select('id, conversation_id, sender_id, content, is_read, created_at')
      .single();

    if (error || !message) {
      throw new Error('Failed to send message');
    }

    // Обновляем updated_at диалога
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    // Возвращаем с расшифрованным контентом для socket broadcast
    return { ...message, content: plainContent } as IChatMessage;
  },

  /**
   * Получить сообщения диалога (расшифровывает контент)
   */
  async getMessages(conversationId: string, userId: string, limit = 50, offset = 0): Promise<IChatMessage[]> {
    // Проверяем участие
    const { data: participant } = await supabase
      .from('chat_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!participant) {
      throw new Error('Not a participant');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, content, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error('Failed to fetch messages');

    return (data || []).map(msg => ({
      ...msg,
      content: decryptOrPassthrough(msg.content),
    })) as IChatMessage[];
  },

  /**
   * Получить список диалогов пользователя
   */
  async getConversations(userId: string): Promise<IChatConversation[]> {
    // 1) conversation_ids пользователя
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (!participations || participations.length === 0) return [];

    const convIds = participations.map(p => p.conversation_id);

    // 2) Все диалоги одним запросом
    const { data: conversations } = await supabase
      .from('chat_conversations')
      .select('id, created_at, updated_at')
      .in('id', convIds)
      .order('updated_at', { ascending: false });

    if (!conversations || conversations.length === 0) return [];

    // 3) Все участники всех диалогов одним запросом
    const { data: allParts } = await supabase
      .from('chat_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds);

    const partsByConv = new Map<string, string[]>();
    (allParts || []).forEach(p => {
      const arr = partsByConv.get(p.conversation_id) || [];
      arr.push(p.user_id);
      partsByConv.set(p.conversation_id, arr);
    });

    // 4) Все user_profiles одним запросом
    const allUserIds = [...new Set((allParts || []).map(p => p.user_id))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', allUserIds);

    const profileById = new Map<string, { id: string; full_name: string | null }>();
    (profiles || []).forEach(p => profileById.set(p.id, p));

    // 5) Все сообщения (только нужные колонки) одним запросом — берём по одному последнему на каждый диалог
    // PostgREST не поддерживает DISTINCT ON, поэтому берём все сообщения за разумный лимит и группируем в JS
    const { data: allMsgs } = await supabase
      .from('chat_messages')
      .select('conversation_id, content, sender_id, created_at, is_read')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(convIds.length * 50);

    const lastByConv = new Map<string, { content: string; sender_id: string; created_at: string }>();
    const unreadByConv = new Map<string, number>();
    (allMsgs || []).forEach(m => {
      if (!lastByConv.has(m.conversation_id)) {
        lastByConv.set(m.conversation_id, {
          content: m.content,
          sender_id: m.sender_id,
          created_at: m.created_at,
        });
      }
      if (!m.is_read && m.sender_id !== userId) {
        unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) || 0) + 1);
      }
    });

    // 6) Сборка результата без дополнительных запросов
    return conversations.map(conv => {
      const participantIds = partsByConv.get(conv.id) || [];
      const participants = participantIds
        .map(uid => profileById.get(uid))
        .filter((p): p is { id: string; full_name: string | null } => !!p)
        .map(p => ({ user_id: p.id, full_name: p.full_name }));

      const lastMsg = lastByConv.get(conv.id);

      return {
        id: conv.id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        participants,
        last_message: lastMsg ? {
          content: decryptOrPassthrough(lastMsg.content),
          sender_id: lastMsg.sender_id,
          created_at: lastMsg.created_at,
        } : null,
        unread_count: unreadByConv.get(conv.id) || 0,
      };
    });
  },

  /**
   * Пометить сообщения как прочитанные
   */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', userId);
  },

  /**
   * Получить общее количество непрочитанных сообщений для пользователя
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('conversation_id')
      .eq('user_id', userId);

    if (!participations || participations.length === 0) return 0;

    const convIds = participations.map(p => p.conversation_id);

    const { count } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds)
      .eq('is_read', false)
      .neq('sender_id', userId);

    return count || 0;
  },

  /**
   * Поиск пользователей для начала диалога
   */
  async searchUsers(query: string, currentUserId: string): Promise<{ id: string; full_name: string | null }[]> {
    let dbQuery = supabase
      .from('user_profiles')
      .select('id, full_name')
      .neq('id', currentUserId)
      .eq('is_approved', true)
      .order('full_name', { ascending: true })
      .limit(50);

    if (query && query.trim()) {
      dbQuery = dbQuery.ilike('full_name', `%${query.trim()}%`);
    }

    const { data } = await dbQuery;

    return (data || []).map(u => ({ id: u.id, full_name: u.full_name }));
  },
};
