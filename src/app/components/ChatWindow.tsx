import { useEffect, useState, useRef, useCallback } from "react";
import { API_URL } from "../../../utils/supabase/info";
import { ProfilePage } from "./ProfilePage";

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  read: boolean;
}

interface ChatWindowProps {
  currentUsername: string;
  otherUsername: string;
  otherName: string;
  onBack: () => void;
  onNewMessage: () => void;
}

export function ChatWindow({
  currentUsername,
  otherUsername,
  otherName,
  onBack,
  onNewMessage,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth", force = false) => {
    const container = scrollContainerRef.current;
    if (!container || !messagesEndRef.current) return;

    const isNearBottom = 
      container.scrollHeight - container.scrollTop <= container.clientHeight + 150;

    if (force || isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  }, []);

  const fetchMessages = useCallback(async (isInitial = false) => {
    try {
      const response = await fetch(`${API_URL}/inbox?username=${currentUsername}`);
      
      if (response.ok) {
        const data = await response.json();
        const conversationMessages = data.messages.filter(
          (msg: Message) =>
            (msg.from === currentUsername && msg.to === otherUsername) ||
            (msg.from === otherUsername && msg.to === currentUsername)
        );
        
        conversationMessages.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
        
        // Evita re-renders se nada mudou
        setMessages(prev => {
          if (JSON.stringify(prev) === JSON.stringify(conversationMessages)) return prev;
          
          // Se o número de mensagens aumentou, rolar para baixo
          if (conversationMessages.length > prev.length) {
            setTimeout(() => scrollToBottom(isInitial ? "auto" : "smooth", true), 50);
          }
          return conversationMessages;
        });

        const hasUnread = conversationMessages.some((m: Message) => !m.read && m.to === currentUsername);
        if (hasUnread) {
          const markRes = await fetch(`${API_URL}/mark-read`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: currentUsername, otherUser: otherUsername }),
          });
          if (markRes.ok) onNewMessage();
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [currentUsername, otherUsername, onNewMessage, scrollToBottom]);

  // Polling de Mensagens e Digitação
  useEffect(() => {
    setLoading(true);
    fetchMessages(true);

    const checkTyping = async () => {
      try {
        const res = await fetch(`${API_URL}/typing-status?from=${otherUsername}&to=${currentUsername}`);
        if (res.ok) {
          const data = await res.json();
          setIsOtherTyping(data.isTyping);
        }
      } catch (e) { setIsOtherTyping(false); }
    };

    const msgInterval = setInterval(() => fetchMessages(false), 2500);
    const typingInterval = setInterval(checkTyping, 2000);

    return () => {
      clearInterval(msgInterval);
      clearInterval(typingInterval);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [otherUsername, fetchMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setSending(true);
    setNewMessage(""); // Limpa o input imediatamente (Optimistic UI)

    try {
      const response = await fetch(`${API_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: currentUsername, to: otherUsername, text }),
      });

      if (response.ok) {
        await fetchMessages();
        onNewMessage();
      }
    } catch (error) {
      console.error("Erro ao enviar:", error);
    } finally {
      setSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Avisa o servidor que está digitando (Debounce)
    if (!typingTimeoutRef.current) {
      fetch(`${API_URL}/typing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: currentUsername, to: otherUsername }),
      }).catch(() => {});
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {showProfile ? (
        <ProfilePage username={otherUsername} onClose={() => setShowProfile(false)} />
      ) : (
        <>
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
            <button onClick={onBack} className="text-gray-600 p-2 lg:hidden">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div onClick={() => setShowProfile(true)} className="flex items-center gap-3 cursor-pointer flex-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                {otherName[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-gray-900 font-medium">{otherName}</h2>
                <p className="text-sm text-gray-500">@{otherUsername}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {loading && messages.length === 0 ? (
              <div className="space-y-4 animate-pulse">
                <div className="bg-gray-200 h-12 w-3/4 rounded-2xl"></div>
                <div className="bg-gray-100 h-12 w-1/2 rounded-2xl ml-auto"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic">Diga "Olá" para {otherName}!</div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.from === currentUsername;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isOwn ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white" : "bg-white border text-gray-900"}`}>
                      <p className="break-words">{msg.text}</p>
                      <span className={`text-[10px] mt-1 block ${isOwn ? "text-blue-100 text-right" : "text-gray-400"}`}>
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}

            {isOtherTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-4 py-3 flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button type="submit" disabled={!newMessage.trim() || sending} className="bg-blue-600 text-white p-3 rounded-full disabled:opacity-50">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}