import { useState } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { ConversationList } from "./components/ConversationList";
import { ChatWindow } from "./components/ChatWindow";

export default function App() {
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    name: string;
  } | null>(null);
  
  const [selectedConversation, setSelectedConversation] = useState<{
    username: string;
    name: string;
  } | null>(null);
  
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogin = (username: string, name: string) => {
    setCurrentUser({ username, name });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedConversation(null);
  };

  const handleSelectConversation = (username: string, name: string) => {
    setSelectedConversation({ username, name });
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleNewMessage = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Login screen
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Mobile: Show chat window if conversation selected
  if (selectedConversation) {
    return (
      <div className="h-screen lg:hidden">
        <ChatWindow
          currentUsername={currentUser.username}
          otherUsername={selectedConversation.username}
          otherName={selectedConversation.name}
          onBack={handleBackToList}
          onNewMessage={handleNewMessage}
        />
      </div>
    );
  }

  // Desktop and mobile conversation list
  return (
    <div className="h-screen flex bg-gray-100">
      {/* Conversation List - always visible on desktop, main view on mobile */}
      <div className={`${selectedConversation ? "hidden lg:flex" : "flex"} w-full lg:w-96 flex-col`}>
        <ConversationList
          currentUsername={currentUser.username}
          currentName={currentUser.name}
          onSelectConversation={handleSelectConversation}
          onLogout={handleLogout}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Chat Window - only on desktop */}
      <div className="hidden lg:flex flex-1">
        {selectedConversation ? (
          <ChatWindow
            currentUsername={currentUser.username}
            otherUsername={selectedConversation.username}
            otherName={selectedConversation.name}
            onBack={handleBackToList}
            onNewMessage={handleNewMessage}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <svg className="w-24 h-24 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-gray-500">Selecione uma conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}