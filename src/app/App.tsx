import { useEffect, useState, useRef } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";
import { API_URL } from "../../utils/supabase/info";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ username: string; name: string } | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<{ username: string; name: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  // Referência para contornar o encerramento (closure) do useEffect do WebSocket
  const selectedConvRef = useRef(selectedConversation);

  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  const handleLogin = (username: string, name: string) => setCurrentUser({ username, name });
  const handleLogout = () => { setCurrentUser(null); setSelectedConversation(null); };

  const handleSelectConversation = (username: string, name: string) => {
    setSelectedConversation({ username, name });
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleNewMessage = () => setRefreshTrigger(prev => prev + 1);

  useEffect(() => {
    if (!currentUser) return;

    const wsUrl = `${API_URL.replace(/^http/, 'ws')}/ws/${currentUser.username}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat") {
        const currentOpenChat = selectedConvRef.current?.username;

        if (currentOpenChat === data.from) {
          // Chat aberto: Marcar como lido no servidor imediatamente
          try {
            await fetch(`${API_URL}/mark-read`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                username: currentUser.username, 
                otherUser: data.from 
              })
            });
          } catch (e) { console.error(e); }
        } else {
          // Chat fechado: Mostrar notificação
          toast.info(`Mensagem de ${data.name || data.from}`, { 
            description: data.text,
            id: `msg-${data.from}` 
          });
        }
        setRefreshTrigger(prev => prev + 1);
      }

      if (data.type === "read_receipt") {
        setRefreshTrigger(prev => prev + 1);
      }
    };

    setSocket(ws);
    return () => ws.close();
  }, [currentUser?.username]);

  if (!currentUser) return (
    <div className="min-h-screen w-full">
      <Toaster position="top-right" richColors />
      <LoginScreen onLogin={handleLogin} />
    </div>
  );

  return (
    <div className="h-screen w-screen flex bg-gray-100 overflow-hidden fixed inset-0">
      <Toaster position="top-right" richColors closeButton />
      
      <div className={`${selectedConversation ? "hidden lg:flex" : "flex"} w-full lg:w-[400px] h-full flex-col border-r border-gray-200 bg-white flex-shrink-0`}>
        <ConversationList
          currentUsername={currentUser.username}
          currentName={currentUser.name}
          onSelectConversation={handleSelectConversation}
          onLogout={handleLogout}
          refreshTrigger={refreshTrigger}
        />
      </div>

      <div className={`${selectedConversation ? "flex" : "hidden lg:flex"} flex-grow h-full bg-white relative w-0`}>
        {selectedConversation ? (
          <div className="flex-1 h-full w-full">
            <ChatWindow
              key={selectedConversation.username}
              currentUsername={currentUser.username}
              otherUsername={selectedConversation.username}
              otherName={selectedConversation.name}
              onBack={handleBackToList}
              onNewMessage={handleNewMessage} 
              globalSocket={socket}            
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
            <p className="text-gray-400 font-medium">Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}