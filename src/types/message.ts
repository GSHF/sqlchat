import { Id, Timestamp } from ".";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SHOW_TOKEN_USAGE?: string;
      QWEN_INTERNAL?: string;
    }
  }
}

export enum CreatorRole {
  System = "system",
  User = "user",
  Assistant = "assistant",
}

type MessageStatus = "LOADING" | "DONE" | "FAILED";

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface Message {
  id: Id;
  conversationId: string;
  creatorId: Id;
  creatorRole: CreatorRole;
  createdAt: Timestamp;
  content: string;
  status: MessageStatus;
  error?: string;
  usage?: TokenUsage;
  role?: string;
}
