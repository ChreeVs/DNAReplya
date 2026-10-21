export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'groq';

export interface GenerateReplyRequest {
  platform: string;
  authorUsername: string;
  commentText: string;
  postSnippet?: string;
  systemPromptOverride?: string;
}

export interface GenerateReplyResponse {
  proposedReply: string;
  modelUsed: string;
  providerUsed: AIProvider;
  fewShotExamplesCount: number;
}
