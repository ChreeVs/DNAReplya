import { dbRepository, ProfileRecord, GlobalSettings } from '../../db/index.js';
import { AIProvider, GenerateReplyRequest, GenerateReplyResponse } from './types.js';

export class AIOrchestrator {
  /**
   * Generates a context-aware, guardrail-compliant reply using the configured LLM and profile memory.
   */
  static async generateReply(req: GenerateReplyRequest): Promise<GenerateReplyResponse> {
    const profile = dbRepository.getProfileById(req.profileId);
    const globalSettings = dbRepository.getGlobalSettings();

    const provider = (profile?.ai_provider || globalSettings.default_ai_provider || 'openai') as AIProvider;
    const model = profile?.ai_model || this.getDefaultModel(provider);

    // 1. Retrieve dynamic few-shot examples strictly isolated for this client/profile
    const pastReplies = dbRepository.getApprovedRepliesByProfile(req.profileId, 5);

    // 2. Build system prompt tailored to this profile's brand persona and boundaries
    const systemPrompt = this.buildSystemPrompt(profile, req.platform, pastReplies);

    // 3. Build user prompt
    const userPrompt = `
CLIENTE / BRAND: ${profile ? profile.name : 'Brand'}
PIATTAFORMA: ${req.platform.toUpperCase()}
AUTORE DEL COMMENTO: @${req.authorUsername}
${req.postSnippet ? `POST DI RIFERIMENTO: "${req.postSnippet}"` : ''}
TESTO DEL COMMENTO RICEVUTO:
"${req.commentText}"

Elabora ora la migliore risposta rispettando rigorosamente le linee guida del brand, il tono e i limiti imposti. Rispondi SOLO con il testo del messaggio finale senza virgolette né spiegazioni.
`.trim();

    // 4. Resolve API Key from global settings or environment
    const apiKey = this.getApiKey(globalSettings, provider);

    if (!apiKey) {
      return {
        proposedReply: `[Bozza]: Ciao @${req.authorUsername}, grazie per il tuo commento! (Configura la chiave API ${provider.toUpperCase()} nella Dashboard per attivare l'AI).`,
        modelUsed: 'mock-no-key',
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    }

    try {
      let reply = '';
      if (provider === 'openai') {
        reply = await this.callOpenAI(model, apiKey, systemPrompt, userPrompt);
      } else if (provider === 'gemini') {
        reply = await this.callGemini(model, apiKey, systemPrompt, userPrompt);
      } else if (provider === 'anthropic') {
        reply = await this.callAnthropic(model, apiKey, systemPrompt, userPrompt);
      } else {
        throw new Error(`Provider non supportato: ${provider}`);
      }

      // Max length truncation
      const maxLen = profile?.max_reply_length || 280;
      if (maxLen > 0 && reply.length > maxLen) {
        reply = reply.substring(0, maxLen).trim();
      }

      return {
        proposedReply: reply.trim(),
        modelUsed: model,
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    } catch (err: any) {
      console.error(`[AIOrchestrator] Errore risposta AI (${provider}):`, err.message);
      return {
        proposedReply: `[Errore AI ${provider}]: ${err.message}. Controlla la chiave API in Configurazione.`,
        modelUsed: model,
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    }
  }

  private static buildSystemPrompt(profile: ProfileRecord | undefined, platform: string, pastReplies: any[]): string {
    const toneMap: Record<string, string> = {
      friendly: 'Amichevole, caloroso, empatico, con emoji appropriate ma con misura.',
      professional: 'Formale, professionale, chiaro, cordiale e istituzionale.',
      concise: 'Estremamente sintetico, rapido, dritto al punto, senza giri di parole.',
      humorous: 'Simpatico, brillante, ironico con garbo.',
      custom: profile?.custom_tone_instructions || 'Naturale e autentico.',
    };

    const chosenTone = profile ? (toneMap[profile.tone_of_voice] || toneMap.friendly) : toneMap.friendly;

    let prompt = `Sei l'assistente social media manager per "${profile?.name || 'il nostro Brand'}".
Il tuo obiettivo è rispondere ai commenti social rispettando l'identità del cliente.

### GUIDELINES:
1. Piattaforma: ${platform.toUpperCase()}.
2. Tono di voce: ${chosenTone}
${profile?.custom_tone_instructions ? `3. Istruzioni di stile specifiche per questo cliente: ${profile.custom_tone_instructions}` : ''}
4. Lunghezza massima risposta: ${profile?.max_reply_length || 280} caratteri.

### LIMITI & BASE DI CONOSCENZA DEL CLIENTE (FONTE UNICA DI VERITÀ):
${profile?.business_knowledge ? `USA ESCLUSIVAMENTE QUESTE INFORMAZIONI PER RISPONDERE A DOMANDE SU PRODOTTI, PREZZI, SPEDIZIONI O POLICY:\n${profile.business_knowledge}` : 'Rispondi con cortesia invitando a contattare il supporto o il sito web per dettagli specifici.'}
${profile?.forbidden_words ? `TERMINI O ARGOMENTI VIETATI (NON USARLI MAI):\n${profile.forbidden_words}` : ''}
- Non inventare mai sconti o informazioni inesistenti.
- Se una domanda richiede dati privati, invita gentilmente l'utente a scrivere in Direct Message (DM).
`;

    // Dynamic Few-Shot RAG from past approved interactions for this profile
    if (pastReplies.length > 0) {
      prompt += `\n### ESEMPI DI RISPOSTE REALI APPROVATE IN PASSATO PER ${profile?.name?.toUpperCase() || 'QUESTO CLIENTE'}:\n`;
      prompt += `Replica fedelmente questo stile approvato:\n`;
      pastReplies.forEach((item, index) => {
        prompt += `\n[Esempio ${index + 1} - ${item.platform.toUpperCase()}]\nCommento: "${item.comment_text}"\nRisposta Approvata: "${item.approved_reply}"\n`;
      });
    }

    return prompt;
  }

  private static getApiKey(globalSettings: GlobalSettings, provider: AIProvider): string {
    switch (provider) {
      case 'openai': return globalSettings.api_key_openai || process.env.OPENAI_API_KEY || '';
      case 'gemini': return globalSettings.api_key_gemini || process.env.GEMINI_API_KEY || '';
      case 'anthropic': return globalSettings.api_key_anthropic || process.env.ANTHROPIC_API_KEY || '';
      default: return '';
    }
  }

  private static getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case 'openai': return 'gpt-4o-mini';
      case 'gemini': return 'gemini-1.5-flash';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      default: return 'gpt-4o-mini';
    }
  }

  private static async callOpenAI(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  private static async callGemini(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.7 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  private static async callAnthropic(
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude error (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    return data.content?.[0]?.text || '';
  }
}
