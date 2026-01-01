import { useEffect, useState, useRef } from "react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/inbox?username=${currentUsername}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const conversationMessages = data.messages.filter(
          (msg: Message) =>
            (msg.from === currentUsername && msg.to === otherUsername) ||
            (msg.from === otherUsername && msg.to === currentUsername)
        );
        
        // Sort by timestamp (oldest first)
        conversationMessages.sort((a: Message, b: Message) => a.timestamp - b.timestamp);
        
        setMessages(conversationMessages);

        // Mark messages as read
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/mark-read`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({
              username: currentUsername,
              otherUser: otherUsername,
            }),
          }
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [currentUsername, otherUsername]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            from: currentUsername,
            to: otherUsername,
            text: newMessage.trim(),
          }),
        }
      );

      if (response.ok) {
        setNewMessage("");
        await fetchMessages();
        onNewMessage(); // Trigger refresh in conversation list
      } else {
        console.error("Failed to send message");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-gray-600 hover:text-gray-800 lg:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white">
          {otherName[0].toUpperCase()}
        </div>
        <div>
          <h2>{otherName}</h2>
          <p className="text-sm text-gray-500">@{otherUsername}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Carregando mensagens...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">Nenhuma mensagem ainda</p>
            <p className="text-sm text-gray-400 mt-2">Envie a primeira mensagem!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.from === currentUsername;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwnMessage
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <p className="break-words">{msg.text}</p>
                  <div
                    className={`text-xs mt-1 ${
                      isOwnMessage ? "text-white/70" : "text-gray-500"
                    }`}
                  >
                    {formatMessageTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={sending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}