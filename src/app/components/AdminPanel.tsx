import { useEffect, useState } from "react";
import { API_URL } from "../../../utils/supabase/info";

interface ChordNode {
  id: number;
  name: string;
  active: boolean;
  users: string[];
  messageCount: number;
}

interface OperationLog {
  timestamp: number;
  operation: string;
  details: any;
}

interface UserDistribution {
  [username: string]: {
    name: string;
    primaryNode: string;
    primaryNodeId: number | null;
    replicaNodes: string[];
    chordPosition: number;
  };
}

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [nodes, setNodes] = useState<ChordNode[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [distribution, setDistribution] = useState<UserDistribution>({});
  const [activeTab, setActiveTab] = useState<"nodes" | "distribution" | "logs">("nodes");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      // Fetch nodes do Servidor Python Local
      const nodesRes = await fetch(`${API_URL}/admin/nodes`);
      if (nodesRes.ok) {
        const data = await nodesRes.json();
        setNodes(data.nodes);
      }

      // Fetch logs do Servidor Python Local
      const logsRes = await fetch(`${API_URL}/admin/logs`);
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }

      // Fetch distribution do Servidor Python Local
      const distRes = await fetch(`${API_URL}/admin/distribution`);
      if (distRes.ok) {
        const data = await distRes.json();
        setDistribution(data.distribution);
      }
    } catch (error) {
      console.error("Error fetching admin data from Local Server:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const toggleNode = async (nodeId: number) => {
    try {
      const res = await fetch(`${API_URL}/admin/nodes/${nodeId}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        // Aguardamos 300ms antes de buscar os dados 
        // para dar tempo do Supabase processar a escrita do Python
        setTimeout(() => fetchData(), 300);
      }
    } catch (error) {
      console.error("Error toggling node:", error);
    }
  };

  const clearLogs = async () => {
    try {
      // Apontando para o servidor local
      const res = await fetch(`${API_URL}/admin/logs`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        fetchData();
      }
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("pt-BR");
  };

  const activeNodes = nodes.filter((n) => n.active).length;
  const totalUsers = Object.keys(distribution).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-t-2xl text-white flex items-center justify-between">
          <div>
            <h2 className="text-white mb-1">Painel de Administração Chord</h2>
            <p className="text-sm text-white/80">
              Sistema Distribuído • {activeNodes}/{nodes.length} Nós Ativos • {totalUsers} Utilizadores
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("nodes")}
            className={`flex-1 px-6 py-3 transition-colors ${
              activeTab === "nodes"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Nós Chord
          </button>
          <button
            onClick={() => setActiveTab("distribution")}
            className={`flex-1 px-6 py-3 transition-colors ${
              activeTab === "distribution"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Distribuição
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 px-6 py-3 transition-colors ${
              activeTab === "logs"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            Logs ({logs.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Carregando...</div>
            </div>
          ) : (
            <>
              {/* Nodes Tab */}
              {activeTab === "nodes" && (
                <div className="space-y-4">
                  {nodes.map((node) => (
                    <div
                      key={node.id}
                      className={`border-2 rounded-xl p-6 transition-all ${
                        node.active
                          ? "border-green-300 bg-green-50"
                          : "border-red-300 bg-red-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-4 h-4 rounded-full ${
                              node.active ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          <div>
                            <h3>{node.name}</h3>
                            <p className="text-sm text-gray-600">
                              ID: {node.id} • Status: {node.active ? "Ativo" : "Inativo"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleNode(node.id)}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            node.active
                              ? "bg-red-500 hover:bg-red-600 text-white"
                              : "bg-green-500 hover:bg-green-600 text-white"
                          }`}
                        >
                          {node.active ? "Desligar Nó" : "Ligar Nó"}
                        </button>
                      </div>

                      {node.active && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Utilizadores</p>
                            <p className="text-gray-800">{node.users.length}</p>
                            {node.users.length > 0 && (
                              <p className="text-xs text-gray-500 mt-2">
                                {node.users.join(", ")}
                              </p>
                            )}
                          </div>
                          <div className="bg-white p-4 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Mensagens</p>
                            <p className="text-gray-800">{node.messageCount}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Distribution Tab */}
              {activeTab === "distribution" && (
                <div className="space-y-3">
                  {Object.entries(distribution).length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                      Nenhum utilizador registado
                    </p>
                  ) : (
                    Object.entries(distribution).map(([username, info]) => (
                      <div
                        key={username}
                        className="border border-gray-200 rounded-xl p-4 bg-gray-50"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p>{info.name}</p>
                            <p className="text-sm text-gray-600">@{username}</p>
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                            Posição Chord: {info.chordPosition}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="bg-white p-3 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Nó Primário</p>
                            <p className="text-sm text-gray-800">{info.primaryNode}</p>
                          </div>
                          <div className="bg-white p-3 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Réplicas</p>
                            <p className="text-sm text-gray-800">
                              {info.replicaNodes.join(", ")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === "logs" && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-gray-600">
                      {logs.length} operações registadas
                    </p>
                    {logs.length > 0 && (
                      <button
                        onClick={clearLogs}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Limpar Logs
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">Nenhum log registado</p>
                    ) : (
                      logs.map((log, index) => (
                        <div
                          key={index}
                          className={`border-l-4 p-4 rounded-r-lg ${
                            log.operation === "NODE_DEACTIVATED"
                              ? "border-red-500 bg-red-50"
                              : log.operation === "NODE_ACTIVATED"
                              ? "border-green-500 bg-green-50"
                              : log.operation === "NODE_FAILOVER"
                              ? "border-orange-500 bg-orange-50"
                              : "border-blue-500 bg-blue-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs px-2 py-1 bg-white rounded">
                              {log.operation}
                            </span>
                            <span className="text-xs text-gray-600">
                              {formatTimestamp(log.timestamp)}
                            </span>
                          </div>
                          <pre className="text-xs text-gray-700 overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
