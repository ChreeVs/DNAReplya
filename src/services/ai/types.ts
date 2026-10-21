export type AIProvider = 'openai' | 'gemini' | 'anthropic';

export interface GenerateReplyRequest {
  profileId: string;
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
