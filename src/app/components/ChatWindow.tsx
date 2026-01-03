import { useEffect, useState, useRef } from "react";
import { API_URL } from "../../../utils/supabase/info";
import { ProfilePage } from "./ProfilePage";

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  read: boolean;
  type?: "chat" | "typing" | "read_receipt";
  status?: "start" | "stop";
}

interface ChatWindowProps {
  currentUsername: string;
  otherUsername: string;
  otherName: string;
  onBack: () => void;
  onNewMessage: () => void;
  globalSocket: WebSocket | null;
}

export function ChatWindow({ globalSocket, currentUsername, otherUsername, otherName, onBack, onNewMessage }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOtherTyping]);

  useEffect(() => {
    if (!globalSocket) return;

    const handleSocketMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.from !== otherUsername && data.to !== otherUsername) return;

      if (data.type === "typing") {
        if (data.status === "stop") {
          setIsOtherTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        } else {
          setIsOtherTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
        }
      } 
      else if (data.type === "read_receipt") {
        setMessages(prev => prev.map(msg => ({ ...msg, read: true })));
      } 
      else if (data.type === "chat") {
        if (data.from === otherUsername) {
          setMessages(prev => {
            // Checagem extra de segurança por ID
            if (prev.find(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          onNewMessage(); 

          fetch(`${API_URL}/mark-read`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: currentUsername, otherUser: otherUsername })
          });
        }
      }
    };

    globalSocket.addEventListener("message", handleSocketMessage);
    return () => {
      globalSocket.removeEventListener("message", handleSocketMessage);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [globalSocket, otherUsername, currentUsername]);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/inbox?username=${currentUsername}`);
        if (res.ok) {
          const data = await res.json();
          const filtered = data.messages
            .filter((msg: any) => 
              (msg.from === currentUsername && msg.to === otherUsername) ||
              (msg.from === otherUsername && msg.to === currentUsername)
            )
            .sort((a: any, b: any) => a.timestamp - b.timestamp);
          setMessages(filtered);
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchHistory();
  }, [otherUsername, currentUsername]);

  useEffect(() => {
    const clearUnread = async () => {
      try {
        await fetch(`${API_URL}/mark-read`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: currentUsername, otherUser: otherUsername })
        });
        onNewMessage(); 
      } catch (e) { console.error(e); }
    };
    clearUnread();
  }, [otherUsername]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !globalSocket || globalSocket.readyState !== WebSocket.OPEN) return;

    const timestamp = Date.now();
    const msgPayload: Message = {
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`, // ID mais único
      type: "chat",
      from: currentUsername,
      to: otherUsername,
      text: newMessage.trim(),
      timestamp: timestamp,
      read: false
    };

    // 1. Envia a mensagem real
    globalSocket.send(JSON.stringify(msgPayload));

    // 2. Avisa que parou de digitar (stop typing)
    globalSocket.send(JSON.stringify({ 
      type: "typing", 
      status: "stop", 
      from: currentUsername, 
      to: otherUsername 
    }));
    
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);

    // 3. Atualiza a tela localmente (Update Otimista) - APENAS UMA VEZ
    setMessages(prev => [...prev, msgPayload]);
    setNewMessage("");
    onNewMessage();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (globalSocket?.readyState === WebSocket.OPEN) {
      if (value.trim() === "") {
        globalSocket.send(JSON.stringify({ 
          type: "typing", 
          status: "stop", 
          from: currentUsername, 
          to: otherUsername 
        }));
        if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      } else {
        globalSocket.send(JSON.stringify({ 
          type: "typing", 
          status: "start", 
          from: currentUsername, 
          to: otherUsername 
        }));

        if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
        myTypingTimeoutRef.current = setTimeout(() => {
          globalSocket.send(JSON.stringify({ type: "typing", status: "stop", from: currentUsername, to: otherUsername }));
        }, 2000);
      }
    }
  };

  const formatMessageTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">{otherName[0].toUpperCase()}</div>
              <div>
                <h2 className="text-gray-900 font-medium">{otherName}</h2>
                <p className="text-sm text-gray-500">@{otherUsername}</p>
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {loading && messages.length === 0 ? (
              <div className="space-y-4 animate-pulse">
                <div className="bg-gray-200 h-12 w-3/4 rounded-2xl"></div>
                <div className="bg-gray-200 h-12 w-1/2 rounded-2xl ml-auto"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic">Diga "Olá" para {otherName}!</div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.from === currentUsername;
                return (
                  <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isOwn ? "bg-blue-600 text-white" : "bg-white border text-gray-900"}`}>
                      <p className="break-words">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className={`text-[10px] ${isOwn ? "text-blue-100" : "text-gray-400"}`}>{formatMessageTime(msg.timestamp)}</span>
                        {isOwn && (
                          <span className="text-[10px]">
                            {msg.read ? (
                              <svg className="w-3 h-3 text-blue-200 fill-current" viewBox="0 0 20 20"><path d="M19 6.7l-1.4-1.4-9.3 9.3-4.3-4.3-1.4 1.4 5.7 5.7zM14.7 6.7l-1.4-1.4-5 5 1.4 1.4z" /></svg>
                            ) : (
                              <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {isOtherTyping && (
              <div className="flex justify-start">
                <div className="bg-white border rounded-2xl px-4 py-3 flex gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-4 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              <button type="submit" disabled={!newMessage.trim()} className="bg-blue-600 text-white p-3 rounded-full disabled:opacity-50 hover:bg-blue-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}