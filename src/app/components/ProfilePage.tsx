import { useEffect, useState } from "react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";

interface ProfileData {
  username: string;
  name: string;
  email: string;
  bio: string;
  avatar: string;
  status: string;
  theme: string;
  notifications: boolean;
  privacy: string;
  joinedAt: number;
  lastActive: number;
}

interface Statistics {
  messagesSent: number;
  messagesReceived: number;
  totalMessages: number;
  activeConversations: number;
}

interface ProfilePageProps {
  username: string;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfilePage({ username, onClose, onLogout }: ProfilePageProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "edit" | "security" | "settings">("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Edit form state
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editStatus, setEditStatus] = useState("online");
  
  // Security form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Settings state
  const [editTheme, setEditTheme] = useState("light");
  const [editNotifications, setEditNotifications] = useState(true);
  const [editPrivacy, setEditPrivacy] = useState("public");
  
  // Delete account state
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProfile = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/profile/${username}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setStatistics(data.statistics);
        
        // Initialize form fields
        setEditName(data.profile.name);
        setEditBio(data.profile.bio);
        setEditStatus(data.profile.status);
        setEditTheme(data.profile.theme);
        setEditNotifications(data.profile.notifications);
        setEditPrivacy(data.profile.privacy);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const updateProfile = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/profile/${username}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: editName,
            bio: editBio,
            status: editStatus,
          }),
        }
      );

      if (res.ok) {
        setMessage({ type: "success", text: "Perfil atualizado com sucesso!" });
        await fetchProfile();
      } else {
        setMessage({ type: "error", text: "Erro ao atualizar perfil" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem" });
      return;
    }

    if (newPassword.length < 4) {
      setMessage({ type: "error", text: "Senha deve ter pelo menos 4 caracteres" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/profile/${username}/change-password`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );

      if (res.ok) {
        setMessage({ type: "success", text: "Senha alterada com sucesso!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erro ao alterar senha" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/profile/${username}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            theme: editTheme,
            notifications: editNotifications,
            privacy: editPrivacy,
          }),
        }
      );

      if (res.ok) {
        setMessage({ type: "success", text: "Configurações atualizadas!" });
        await fetchProfile();
      } else {
        setMessage({ type: "error", text: "Erro ao atualizar configurações" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-aef9e41b/profile/${username}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: deletePassword }),
        }
      );

      if (res.ok) {
        setMessage({ type: "success", text: "Conta excluída com sucesso" });
        setTimeout(() => onLogout(), 2000);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Erro ao excluir conta" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Erro de conexão" });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Agora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return `${days}d atrás`;
  };

  if (loading || !profile || !statistics) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8">
          <div className="text-gray-500">Carregando perfil...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header with cover */}
        <div className="relative">
          <div className="h-32 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-2xl" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Avatar */}
          <div className="absolute -bottom-16 left-8">
            <div className="w-32 h-32 rounded-full bg-white p-2 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-4xl">
                {profile.name[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Profile header info */}
        <div className="px-8 pt-20 pb-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-gray-900 mb-1">{profile.name}</h1>
              <p className="text-gray-600 mb-2">@{profile.username}</p>
              {profile.bio && <p className="text-gray-700 max-w-2xl">{profile.bio}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  profile.status === "online"
                    ? "bg-green-100 text-green-700"
                    : profile.status === "away"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {profile.status === "online" ? "🟢 Online" : profile.status === "away" ? "🟡 Ausente" : "⚫ Offline"}
              </span>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Mensagens Enviadas</p>
              <p className="text-blue-600">{statistics.messagesSent}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Mensagens Recebidas</p>
              <p className="text-purple-600">{statistics.messagesReceived}</p>
            </div>
            <div className="bg-pink-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Total de Mensagens</p>
              <p className="text-pink-600">{statistics.totalMessages}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">Conversas Ativas</p>
              <p className="text-green-600">{statistics.activeConversations}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-8">
          <button
            onClick={() => setActiveTab("info")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "info"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Informações
          </button>
          <button
            onClick={() => setActiveTab("edit")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "edit"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Editar Perfil
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "security"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Segurança
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-3 transition-colors ${
              activeTab === "settings"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Configurações
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {message && (
            <div
              className={`mb-4 p-4 rounded-lg ${
                message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-gray-900 mb-4">Detalhes da Conta</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Nome de usuário</p>
                    <p className="text-gray-800">@{profile.username}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Nome completo</p>
                    <p className="text-gray-800">{profile.name}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Membro desde</p>
                    <p className="text-gray-800">{formatDate(profile.joinedAt)}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Última atividade</p>
                    <p className="text-gray-800">{formatTime(profile.lastActive)}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-gray-900 mb-4">Preferências</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Tema</p>
                    <p className="text-gray-800 capitalize">{profile.theme}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Notificações</p>
                    <p className="text-gray-800">{profile.notifications ? "Ativadas" : "Desativadas"}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Privacidade</p>
                    <p className="text-gray-800 capitalize">{profile.privacy}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Status</p>
                    <p className="text-gray-800 capitalize">{profile.status}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Tab */}
          {activeTab === "edit" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Nome completo</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Biografia</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Conte um pouco sobre você..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="online">🟢 Online</option>
                  <option value="away">🟡 Ausente</option>
                  <option value="busy">🔴 Ocupado</option>
                  <option value="offline">⚫ Offline</option>
                </select>
              </div>

              <button
                onClick={updateProfile}
                disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-gray-900 mb-4">Alterar Senha</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Senha atual</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Nova senha</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-2">Confirmar nova senha</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={changePassword}
                    disabled={saving}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? "Alterando..." : "Alterar Senha"}
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-red-600 mb-4">Zona de Perigo</h3>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-lg transition-colors border border-red-200"
                  >
                    Excluir Conta
                  </button>
                ) : (
                  <div className="space-y-4 bg-red-50 p-4 rounded-lg border border-red-200">
                    <p className="text-red-700">
                      ⚠️ Esta ação é irreversível. Todas as suas mensagens serão excluídas.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Digite sua senha para confirmar"
                      className="w-full px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={deleteAccount}
                        disabled={saving || !deletePassword}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {saving ? "Excluindo..." : "Confirmar Exclusão"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeletePassword("");
                        }}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-700 mb-2">Tema</label>
                <select
                  value={editTheme}
                  onChange={(e) => setEditTheme(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="light">☀️ Claro</option>
                  <option value="dark">🌙 Escuro</option>
                  <option value="auto">🔄 Automático</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-700 mb-2">Privacidade</label>
                <select
                  value={editPrivacy}
                  onChange={(e) => setEditPrivacy(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="public">🌍 Público</option>
                  <option value="friends">👥 Apenas amigos</option>
                  <option value="private">🔒 Privado</option>
                </select>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-gray-800">Notificações</p>
                  <p className="text-sm text-gray-600">Receber notificações de novas mensagens</p>
                </div>
                <button
                  onClick={() => setEditNotifications(!editNotifications)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editNotifications ? "bg-blue-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editNotifications ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={updateSettings}
                disabled={saving}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
