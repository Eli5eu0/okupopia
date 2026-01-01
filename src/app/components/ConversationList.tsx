import { useEffect, useState } from "react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { AdminPanel } from "./AdminPanel";
import { ProfilePage } from "./ProfilePage";

interface Conversation {
  username: string;
  name: string;
  lastMessage: {
    text: string;
    timestamp: number;
    from: string;
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/conversations?username=${currentUsername}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/users?username=${currentUsername}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchAllUsers();
  }, [currentUsername, refreshTrigger]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } else if (diffInHours < 48) {
      return "Ontem";
    } else {
      return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    }
  };

  const availableUsers = allUsers.filter(
    (user) => !conversations.some((conv) => conv.username === user.username)
  );

  return (
    <div className="h-screen flex flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 text-white">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 hover:bg-white/10 rounded-lg p-1 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center cursor-pointer">
              <span>{currentName[0].toUpperCase()}</span>
            </div>
            <div className="text-left">
              <h2 className="text-white">{currentName}</h2>
              <p className="text-sm text-white/80">@{currentUsername}</p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAdmin(!showAdmin)}
              className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Painel Admin"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={onLogout}
              className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>

        <button
          onClick={() => setShowNewChat(!showNewChat)}
          className="w-full bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Conversa
        </button>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-700">Iniciar nova conversa</h3>
            <button onClick={() => setShowNewChat(false)} className="text-gray-500 hover:text-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableUsers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum usuário disponível</p>
            ) : (
              availableUsers.map((user) => (
                <button
                  key={user.username}
                  onClick={() => {
                    onSelectConversation(user.username, user.name);
                    setShowNewChat(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white">
                    {user.name[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p>{user.name}</p>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {showAdmin && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}

      {/* Profile Page */}
      {showProfile && (
        <ProfilePage 
          username={currentUsername} 
          onClose={() => setShowProfile(false)} 
          onLogout={onLogout}
        />
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">Nenhuma conversa ainda</p>
            <p className="text-sm text-gray-400 mt-2">Clique em "Nova Conversa" para começar</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.username}
              onClick={() => onSelectConversation(conv.username, conv.name)}
              className="w-full flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white flex-shrink-0">
                {conv.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between mb-1">
                  <p>{conv.name}</p>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(conv.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 truncate">
                    {conv.lastMessage.from === currentUsername ? "Você: " : ""}
                    {conv.lastMessage.text}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}