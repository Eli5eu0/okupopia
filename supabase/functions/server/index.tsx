import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as chord from "./chord.tsx";

const app = new Hono();

// Initialize Chord nodes on startup
let chordNodes = chord.initializeNodes();

// Load nodes from storage or use defaults
(async () => {
  const storedNodes = await kv.get("system:chord_nodes");
  if (storedNodes) {
    chordNodes = storedNodes;
  } else {
    await kv.set("system:chord_nodes", chordNodes);
  }
})();

// Helper function to save nodes
async function saveNodes() {
  await kv.set("system:chord_nodes", chordNodes);
}

// Helper function to log operations
async function logOperation(operation: string, details: any) {
  const logs = await kv.get("system:operation_logs") || [];
  logs.unshift({
    timestamp: Date.now(),
    operation,
    details
  });
  // Keep only last 100 logs
  if (logs.length > 100) logs.length = 100;
  await kv.set("system:operation_logs", logs);
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-aef9e41b/health", (c) => {
  return c.json({ status: "ok" });
});

// User signup endpoint
app.post("/make-server-aef9e41b/signup", async (c) => {
  try {
    const { username, password, name } = await c.req.json();
    
    if (!username || !password || !name) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Check if user already exists
    const existingUser = await kv.get(`user:${username}`);
    if (existingUser) {
      return c.json({ error: "Username already exists" }, 409);
    }

    // Store user data with profile defaults
    const userData = { 
      username, 
      password, 
      name, 
      email: `${username}@example.com`,
      bio: "",
      avatar: "",
      status: "online",
      theme: "light",
      notifications: true,
      privacy: "public",
      joinedAt: Date.now(),
      lastActive: Date.now(),
      createdAt: Date.now() 
    };
    await kv.set(`user:${username}`, userData);

    return c.json({ success: true, user: { username, name } });
  } catch (error) {
    console.log(`Error during signup: ${error}`);
    return c.json({ error: "Signup failed" }, 500);
  }
});

// User signin endpoint
app.post("/make-server-aef9e41b/signin", async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({ error: "Missing username or password" }, 400);
    }

    const user = await kv.get(`user:${username}`);
    if (!user || user.password !== password) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    return c.json({ success: true, user: { username, name: user.name } });
  } catch (error) {
    console.log(`Error during signin: ${error}`);
    return c.json({ error: "Signin failed" }, 500);
  }
});

// Get all users (for contacts list)
app.get("/make-server-aef9e41b/users", async (c) => {
  try {
    const username = c.req.query("username");
    
    const users = await kv.getByPrefix("user:");
    const userList = users
      .filter((u) => u.username !== username) // Exclude current user
      .map((u) => ({ username: u.username, name: u.name }));

    return c.json({ users: userList });
  } catch (error) {
    console.log(`Error getting users: ${error}`);
    return c.json({ error: "Failed to get users" }, 500);
  }
});

// Send message endpoint
app.post("/make-server-aef9e41b/send", async (c) => {
  try {
    const { from, to, text } = await c.req.json();
    
    if (!from || !to || !text) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Verify both users exist
    const fromUser = await kv.get(`user:${from}`);
    const toUser = await kv.get(`user:${to}`);
    
    if (!fromUser || !toUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: messageId,
      from,
      to,
      text,
      timestamp: Date.now(),
      read: false
    };

    await kv.set(`message:${messageId}`, message);

    return c.json({ success: true, message });
  } catch (error) {
    console.log(`Error sending message: ${error}`);
    return c.json({ error: "Failed to send message" }, 500);
  }
});

// Get inbox (all messages for a user)
app.get("/make-server-aef9e41b/inbox", async (c) => {
  try {
    const username = c.req.query("username");
    
    if (!username) {
      return c.json({ error: "Missing username" }, 400);
    }

    const allMessages = await kv.getByPrefix("message:");
    const userMessages = allMessages.filter(
      (msg) => msg.to === username || msg.from === username
    );

    // Sort by timestamp (newest first)
    userMessages.sort((a, b) => b.timestamp - a.timestamp);

    return c.json({ messages: userMessages });
  } catch (error) {
    console.log(`Error getting inbox: ${error}`);
    return c.json({ error: "Failed to get inbox" }, 500);
  }
});

// Mark messages as read
app.put("/make-server-aef9e41b/mark-read", async (c) => {
  try {
    const { username, otherUser } = await c.req.json();
    
    if (!username || !otherUser) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const allMessages = await kv.getByPrefix("message:");
    const messagesToUpdate = allMessages.filter(
      (msg) => msg.to === username && msg.from === otherUser && !msg.read
    );

    for (const msg of messagesToUpdate) {
      msg.read = true;
      await kv.set(`message:${msg.id}`, msg);
    }

    return c.json({ success: true, updated: messagesToUpdate.length });
  } catch (error) {
    console.log(`Error marking messages as read: ${error}`);
    return c.json({ error: "Failed to mark messages as read" }, 500);
  }
});

// Get conversations list with unread counts
app.get("/make-server-aef9e41b/conversations", async (c) => {
  try {
    const username = c.req.query("username");
    
    if (!username) {
      return c.json({ error: "Missing username" }, 400);
    }

    const allMessages = await kv.getByPrefix("message:");
    const userMessages = allMessages.filter(
      (msg) => msg.to === username || msg.from === username
    );

    // Group messages by conversation partner
    const conversations = new Map();
    
    for (const msg of userMessages) {
      const partner = msg.to === username ? msg.from : msg.to;
      
      if (!conversations.has(partner)) {
        conversations.set(partner, {
          username: partner,
          lastMessage: msg,
          unreadCount: 0
        });
      }

      const conv = conversations.get(partner);
      
      // Update last message if this one is newer
      if (msg.timestamp > conv.lastMessage.timestamp) {
        conv.lastMessage = msg;
      }

      // Count unread messages sent to this user
      if (msg.to === username && !msg.read) {
        conv.unreadCount++;
      }
    }

    // Get user details for each conversation partner
    const conversationList = [];
    for (const [partner, conv] of conversations) {
      const user = await kv.get(`user:${partner}`);
      if (user) {
        conversationList.push({
          username: partner,
          name: user.name,
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount
        });
      }
    }

    // Sort by most recent message
    conversationList.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);

    return c.json({ conversations: conversationList });
  } catch (error) {
    console.log(`Error getting conversations: ${error}`);
    return c.json({ error: "Failed to get conversations" }, 500);
  }
});

// === CHORD ADMIN ENDPOINTS ===

// Get Chord nodes status
app.get("/make-server-aef9e41b/admin/nodes", async (c) => {
  try {
    // Update node statistics
    for (const node of chordNodes) {
      if (node.active) {
        const users = await kv.getByPrefix("user:");
        const messages = await kv.getByPrefix("message:");
        
        // Count users assigned to this node
        node.users = users
          .map(u => u.username)
          .filter(username => {
            const responsible = chord.findResponsibleNode(`user:${username}`, chordNodes);
            return responsible?.id === node.id;
          });
        
        // Count messages for this node's users
        node.messageCount = messages.filter(msg => 
          node.users.includes(msg.from) || node.users.includes(msg.to)
        ).length;
      }
    }

    await saveNodes();

    return c.json({ nodes: chordNodes });
  } catch (error) {
    console.log(`Error getting nodes: ${error}`);
    return c.json({ error: "Failed to get nodes" }, 500);
  }
});

// Toggle node status (on/off)
app.post("/make-server-aef9e41b/admin/nodes/:id/toggle", async (c) => {
  try {
    const nodeId = parseInt(c.req.param("id"));
    const node = chordNodes.find(n => n.id === nodeId);
    
    if (!node) {
      return c.json({ error: "Node not found" }, 404);
    }

    const previousStatus = node.active;
    node.active = !node.active;
    
    await saveNodes();
    await logOperation(
      node.active ? "NODE_ACTIVATED" : "NODE_DEACTIVATED",
      { nodeId: node.id, nodeName: node.name, previousStatus, newStatus: node.active }
    );

    // If node was deactivated, log affected users
    if (!node.active && node.users.length > 0) {
      const affectedUsers = [...node.users];
      await logOperation("NODE_FAILOVER", {
        deactivatedNode: node.name,
        affectedUsers,
        message: "Users will be redistributed to active nodes"
      });
    }

    return c.json({ success: true, node });
  } catch (error) {
    console.log(`Error toggling node: ${error}`);
    return c.json({ error: "Failed to toggle node" }, 500);
  }
});

// Get operation logs
app.get("/make-server-aef9e41b/admin/logs", async (c) => {
  try {
    const logs = await kv.get("system:operation_logs") || [];
    return c.json({ logs });
  } catch (error) {
    console.log(`Error getting logs: ${error}`);
    return c.json({ error: "Failed to get logs" }, 500);
  }
});

// Get user distribution across nodes
app.get("/make-server-aef9e41b/admin/distribution", async (c) => {
  try {
    const users = await kv.getByPrefix("user:");
    const distribution: any = {};

    for (const user of users) {
      const responsible = chord.findResponsibleNode(`user:${user.username}`, chordNodes);
      const replicas = chord.getReplicaNodes(`user:${user.username}`, chordNodes);
      
      distribution[user.username] = {
        name: user.name,
        primaryNode: responsible ? responsible.name : "None",
        primaryNodeId: responsible ? responsible.id : null,
        replicaNodes: replicas.map(n => n.name),
        chordPosition: chord.getChordPosition(`user:${user.username}`)
      };
    }

    return c.json({ distribution });
  } catch (error) {
    console.log(`Error getting distribution: ${error}`);
    return c.json({ error: "Failed to get distribution" }, 500);
  }
});

// Clear all logs
app.delete("/make-server-aef9e41b/admin/logs", async (c) => {
  try {
    await kv.set("system:operation_logs", []);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error clearing logs: ${error}`);
    return c.json({ error: "Failed to clear logs" }, 500);
  }
});

// === USER PROFILE ENDPOINTS ===

// Get user profile
app.get("/make-server-aef9e41b/profile/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const user = await kv.get(`user:${username}`);
    
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get statistics
    const allMessages = await kv.getByPrefix("message:");
    const sentMessages = allMessages.filter(m => m.from === username);
    const receivedMessages = allMessages.filter(m => m.to === username);
    
    const conversations = await kv.getByPrefix("user:");
    const activeConversations = conversations.filter(u => 
      u.username !== username && (
        allMessages.some(m => 
          (m.from === username && m.to === u.username) || 
          (m.from === u.username && m.to === username)
        )
      )
    ).length;

    return c.json({
      profile: {
        username: user.username,
        name: user.name,
        email: user.email,
        bio: user.bio || "",
        avatar: user.avatar || "",
        status: user.status || "online",
        theme: user.theme || "light",
        notifications: user.notifications !== false,
        privacy: user.privacy || "public",
        joinedAt: user.joinedAt || Date.now(),
        lastActive: user.lastActive || Date.now()
      },
      statistics: {
        messagesSent: sentMessages.length,
        messagesReceived: receivedMessages.length,
        totalMessages: sentMessages.length + receivedMessages.length,
        activeConversations
      }
    });
  } catch (error) {
    console.log(`Error getting profile: ${error}`);
    return c.json({ error: "Failed to get profile" }, 500);
  }
});

// Update user profile
app.put("/make-server-aef9e41b/profile/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const updates = await c.req.json();
    
    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    // Update allowed fields
    const updatedUser = {
      ...user,
      name: updates.name || user.name,
      bio: updates.bio !== undefined ? updates.bio : user.bio,
      avatar: updates.avatar !== undefined ? updates.avatar : user.avatar,
      status: updates.status || user.status,
      theme: updates.theme || user.theme,
      notifications: updates.notifications !== undefined ? updates.notifications : user.notifications,
      privacy: updates.privacy || user.privacy,
      lastActive: Date.now()
    };

    await kv.set(`user:${username}`, updatedUser);

    await logOperation("PROFILE_UPDATED", {
      username,
      updatedFields: Object.keys(updates)
    });

    return c.json({ success: true, profile: updatedUser });
  } catch (error) {
    console.log(`Error updating profile: ${error}`);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Change password
app.post("/make-server-aef9e41b/profile/:username/change-password", async (c) => {
  try {
    const username = c.req.param("username");
    const { currentPassword, newPassword } = await c.req.json();
    
    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.password !== currentPassword) {
      return c.json({ error: "Current password is incorrect" }, 401);
    }

    user.password = newPassword;
    await kv.set(`user:${username}`, user);

    await logOperation("PASSWORD_CHANGED", { username });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error changing password: ${error}`);
    return c.json({ error: "Failed to change password" }, 500);
  }
});

// Delete account
app.delete("/make-server-aef9e41b/profile/:username", async (c) => {
  try {
    const username = c.req.param("username");
    const { password } = await c.req.json();
    
    const user = await kv.get(`user:${username}`);
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.password !== password) {
      return c.json({ error: "Password is incorrect" }, 401);
    }

    // Delete user
    await kv.del(`user:${username}`);

    // Delete all messages
    const messages = await kv.getByPrefix("message:");
    const userMessages = messages.filter(m => m.from === username || m.to === username);
    for (const msg of userMessages) {
      await kv.del(`message:${msg.id}`);
    }

    await logOperation("ACCOUNT_DELETED", { username });

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting account: ${error}`);
    return c.json({ error: "Failed to delete account" }, 500);
  }
});

Deno.serve(app.fetch);