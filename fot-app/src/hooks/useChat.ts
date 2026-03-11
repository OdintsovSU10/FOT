import { useState, useEffect, useCallback, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { chatService, type IChatConversation, type IChatMessage } from '../services/chatService';

export const useChat = (socket: Socket | null) => {
  const [conversations, setConversations] = useState<IChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const activeConvRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
      setUnreadTotal(data.reduce((sum, c) => sum + c.unread_count, 0));
    } catch {
      // ignore
    }
  }, []);

  // Load messages for active conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const data = await chatService.getMessages(conversationId);
      setMessages(data.reverse()); // API returns newest first, we want oldest first
      await chatService.markAsRead(conversationId);
      socket?.emit('mark_read', conversationId);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [socket]);

  // Select conversation
  const selectConversation = useCallback(async (conversationId: string) => {
    // Leave previous
    if (activeConvRef.current) {
      socket?.emit('leave_conversation', activeConvRef.current);
    }

    setActiveConversationId(conversationId);
    socket?.emit('join_conversation', conversationId);
    await loadMessages(conversationId);
    await loadConversations(); // refresh unread counts
  }, [socket, loadMessages, loadConversations]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!activeConvRef.current || !content.trim()) return;

    try {
      const message = await chatService.sendMessage(activeConvRef.current, content);
      setMessages(prev => [...prev, message]);
      // Socket will broadcast to others
      await loadConversations();
    } catch {
      // ignore
    }
  }, [loadConversations]);

  // Start new conversation
  const startConversation = useCallback(async (participantId: string) => {
    try {
      const conversationId = await chatService.createConversation(participantId);
      await loadConversations();
      await selectConversation(conversationId);
      return conversationId;
    } catch {
      return null;
    }
  }, [loadConversations, selectConversation]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message: IChatMessage) => {
      if (message.conversation_id === activeConvRef.current) {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
      loadConversations();
    };

    const handleMessageNotification = (data: { conversationId: string; message: IChatMessage }) => {
      if (data.conversationId !== activeConvRef.current) {
        setUnreadTotal(prev => prev + 1);
      }
      loadConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_notification', handleMessageNotification);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_notification', handleMessageNotification);
    };
  }, [socket, loadConversations]);

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load unread count periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const count = await chatService.getUnreadCount();
        setUnreadTotal(count);
      } catch {
        // ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    conversations,
    activeConversationId,
    messages,
    loading,
    unreadTotal,
    selectConversation,
    sendMessage,
    startConversation,
    loadConversations,
  };
};
