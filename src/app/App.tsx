import { useEffect, useState } from "react";
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
  const [totalUnread, setTotalUnread] = useState(0); // ESTADO ESSENCIAL ADICIONADO

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

  // Monitoramento Global Inteligente
useEffect(() => {
    if (!currentUser) return;

    const checkNewMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/conversations?username=${currentUser.username}`);
        if (!res.ok) return;
        const data = await res.json();
        const convs = data.conversations || [];
        
        const currentUnreadTotal = convs.reduce((acc: number, conv: any) => acc + (conv.unreadCount || 0), 0);

        // Se o total de não lidas aumentou, verificamos se devemos notificar
        if (currentUnreadTotal > totalUnread) {
          const incoming = convs.find((c: any) => c.unreadCount > 0);
          
          // SÓ notifica se NÃO for a conversa aberta no momento
          if (incoming && incoming.username !== selectedConversation?.username) {
            toast.info(`Mensagem de ${incoming.name}`, {
              description: incoming.lastMessage?.text,
              id: `msg-${incoming.username}`, // ID fixo evita empilhar vários toasts do mesmo usuário
            });
          }
        }
        
        // Atualiza estados e força re-render da lista lateral
        setTotalUnread(currentUnreadTotal);
        setRefreshTrigger(prev => prev + 1);
        
      } catch (err) {
        console.error("Erro no monitoramento:", err);
      }
    };

    // Polling de 5s para o App (Notificação) é mais lento que o Chat (2.5s)
    const interval = setInterval(checkNewMessages, 5000);
    return () => clearInterval(interval);
  }, [currentUser?.username, totalUnread, selectedConversation?.username]);

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