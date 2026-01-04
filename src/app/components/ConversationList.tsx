import { useEffect, useState } from "react";
import { API_URL } from "../../../utils/supabase/info";
import { AdminPanel } from "./AdminPanel";
import { ProfilePage } from "./ProfilePage";

interface Conversation {
  username: string;
  name: string;
  lastMessage: {
    text: string;
    timestamp: number;
    from: string;
    read: boolean;
  };
  unreadCount: number;
}

interface ConversationListProps {
  currentUsername: string;
  currentName: string;
  onSelectConversation: (username: string, name: string) => void;
  onLogout: () => void;
  refreshTrigger: number;
}

export function ConversationList({
  currentUsername,
  currentName,
  onSelectConversation,
  onLogout,
  refreshTrigger,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<{ username: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/conversations?username=${currentUsername}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/users?username=${currentUsername}`);
      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, [currentUsername]);

  useEffect(() => {
    fetchConversations();
  }, [currentUsername, refreshTrigger]);

  // Lógica para filtrar usuários que ainda não possuem conversa aberta
  const availableUsers = allUsers.filter(user => 
    !conversations.some(conv => conv.username === user.username)
  );

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffInHours < 24) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      {showProfile && <ProfilePage username={currentUsername} onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* MODAL DE NOVA CONVERSA */}
      {showNewChat && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
          <div className="bg-blue-600 p-4 text-white flex items-center gap-4">
            <button onClick={() => setShowNewChat(false)} className="p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <h2 className="font-semibold text-lg">Nova Conversa</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="p-8 text-center text-gray-500">Nenhum usuário novo encontrado.</p>
            ) : (
              availableUsers.map(user => (
                <button key={user.username} onClick={() => { onSelectConversation(user.username, user.name); setShowNewChat(false); }} className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{user.name[0]}</div>
                  <div className="text-left"><p className="font-medium text-gray-900">{user.name}</p><p className="text-xs text-gray-500">@{user.username}</p></div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* HEADER E LISTA PRINCIPAL */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 hover:bg-white/10 rounded-lg p-1 transition-colors">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold"><span>{currentName[0].toUpperCase()}</span></div>
            <div className="text-left"><h2 className="font-semibold">{currentName}</h2><p className="text-xs text-white/80">@{currentUsername}</p></div>
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdmin(true)} className="p-2 bg-white/20 rounded-lg hover:bg-white/30"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
          </div>
        </div>
        <button onClick={() => setShowNewChat(true)} className="w-full bg-white/20 hover:bg-white/30 p-2 rounded-lg flex items-center justify-center gap-2 font-medium transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Nova Conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : (
          conversations.map((conv) => (
            <button key={conv.username} onClick={() => onSelectConversation(conv.username, conv.name)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b transition-colors group">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">{conv.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-gray-900 truncate">{conv.name}</p>
                  <span className="text-[11px] text-gray-400">{formatTimestamp(conv.lastMessage.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 truncate pr-4">
                    {conv.lastMessage.from === currentUsername ? "Você: " : ""}{conv.lastMessage.text}
                  </p>
                  
                  {/* CHECK DE LIDO NO CANTO DIREITO */}
                  <div className="flex items-center gap-1">
                    {conv.unreadCount > 0 ? (
                      <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{conv.unreadCount}</span>
                    ) : (
                      conv.lastMessage.from === currentUsername && (
                        conv.lastMessage.read ? (
                          <svg className="w-4 h-4 text-blue-500 fill-current" viewBox="0 0 20 20"><path d="M19 6.7l-1.4-1.4-9.3 9.3-4.3-4.3-1.4 1.4 5.7 5.7zM14.7 6.7l-1.4-1.4-5 5 1.4 1.4z" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}