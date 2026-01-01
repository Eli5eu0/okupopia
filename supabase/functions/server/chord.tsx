// Chord-like distributed hash system for user/message distribution

interface ChordNode {
  id: number;
  name: string;
  active: boolean;
  users: string[];
  messageCount: number;
}

// Simple hash function for consistent hashing
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Calculate position in Chord ring (0-255)
export function getChordPosition(key: string): number {
  return hashString(key) % 256;
}

// Find responsible node for a key using Chord lookup
export function findResponsibleNode(key: string, nodes: ChordNode[]): ChordNode | null {
  const activeNodes = nodes.filter(n => n.active);
  if (activeNodes.length === 0) return null;

  const position = getChordPosition(key);
  
  // Sort nodes by their position
  const sortedNodes = activeNodes
    .map(n => ({ node: n, position: getChordPosition(`node:${n.id}`) }))
    .sort((a, b) => a.position - b.position);

  // Find first node with position >= key position (successor)
  for (const { node, position: nodePos } of sortedNodes) {
    if (nodePos >= position) {
      return node;
    }
  }

  // If no node found, wrap around to first node
  return sortedNodes[0].node;
}

// Get replica nodes (for replication factor of 3)
export function getReplicaNodes(key: string, nodes: ChordNode[], count: number = 3): ChordNode[] {
  const activeNodes = nodes.filter(n => n.active);
  if (activeNodes.length === 0) return [];

  const primary = findResponsibleNode(key, nodes);
  if (!primary) return [];

  const replicas = [primary];
  const position = getChordPosition(key);
  
  // Get next N-1 nodes in the ring
  const sortedNodes = activeNodes
    .map(n => ({ node: n, position: getChordPosition(`node:${n.id}`) }))
    .sort((a, b) => a.position - b.position);

  const primaryIndex = sortedNodes.findIndex(n => n.node.id === primary.id);
  
  for (let i = 1; i < count && replicas.length < activeNodes.length; i++) {
    const nextIndex = (primaryIndex + i) % sortedNodes.length;
    replicas.push(sortedNodes[nextIndex].node);
  }

  return replicas;
}

// Initialize default nodes
export function initializeNodes(): ChordNode[] {
  return [
    { id: 1, name: "Node-Alpha", active: true, users: [], messageCount: 0 },
    { id: 2, name: "Node-Beta", active: true, users: [], messageCount: 0 },
    { id: 3, name: "Node-Gamma", active: true, users: [], messageCount: 0 },
    { id: 4, name: "Node-Delta", active: true, users: [], messageCount: 0 },
    { id: 5, name: "Node-Epsilon", active: true, users: [], messageCount: 0 },
  ];
}
