import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

export interface Match {
  id: string;
  appleId: string;
  orangeId: string;
  score: number;
  status: "pending" | "confirmed" | "rejected";
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  type: "apple" | "orange";
  messages: ConversationMessage[];
  status: "active" | "completed" | "error";
  createdAt: string;
}

interface MatchmakingState {
  matches: Match[];
  conversations: Conversation[];
  activeConversationId: string | null;
  isLoading: boolean;
  error: string | null;
  addMatch: (match: Match) => void;
  setActiveConversation: (id: string | null) => void;
  addConversation: (conversation: Conversation) => void;
  addMessageToConversation: (id: string, msg: ConversationMessage) => void;
  setLoading: (loading: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

// Ensure the type is passed to create<MatchmakingState>()
export const useMatchmakingStore = create<MatchmakingState>()(
  devtools(
    persist(
      (set) => ({
        matches: [],
        conversations: [],
        activeConversationId: null,
        isLoading: false,
        error: null,

        addMatch: (match: Match) =>
          set((state) => ({
            matches: [match, ...state.matches].slice(0, 100),
          })),

        setActiveConversation: (id: string | null) => set({ activeConversationId: id }),

        addConversation: (conv: Conversation) =>
          set((state) => ({
            conversations: [conv, ...state.conversations],
          })),

        addMessageToConversation: (id: string, message: ConversationMessage) =>
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c.id === id ? { ...c, messages: [...c.messages, message] } : c
            ),
          })),

        setLoading: (isLoading: boolean) => set({ isLoading }),
        setError: (error: string | null) => set({ error }),
        reset: () => {
          localStorage.removeItem('matchmaking-storage');
          set({ matches: [], conversations: [], activeConversationId: null });
        },
      }),
      {
        name: "matchmaking-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          conversations: state.conversations,
          matches: state.matches,
        }),
      }
    ),
    { name: "MatchmakingStore" }
  )
);