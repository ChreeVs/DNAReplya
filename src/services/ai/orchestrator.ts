import { dbRepository, AppSettings } from '../../db/index.js';
import { AIProvider, GenerateReplyRequest, GenerateReplyResponse } from './types.js';

export class AIOrchestrator {
  /**
   * Generates a context-aware, guardrail-compliant reply using the configured LLM and few-shot examples.
   */
  static async generateReply(req: GenerateReplyRequest): Promise<GenerateReplyResponse> {
    const settings = dbRepository.getSettings();
    const provider = (settings.ai_provider || 'openai') as AIProvider;
    const model = settings.ai_model || this.getDefaultModel(provider);

    // 1. Retrieve dynamic few-shot examples from approved past interactions
    const pastReplies = dbRepository.getApprovedReplies(5);

    // 2. Build the system prompt with guardrails and knowledge limits
    const systemPrompt = this.buildSystemPrompt(settings, req.platform, pastReplies);

    // 3. Build user prompt
    const userPrompt = `
PIATTAFORMA: ${req.platform.toUpperCase()}
AUTORE DEL COMMENTO: @${req.authorUsername}
${req.postSnippet ? `CONTESTO DEL POST: "${req.postSnippet}"` : ''}
TESTO DEL COMMENTO RICEVUTO:
"${req.commentText}"

Genera ora la migliore risposta per questo commento, rispettando tutte le regole, i limiti di conoscenza e lo stile indicato. Rispondi SOLO con il testo del messaggio da pubblicare, senza virgolette o spiegazioni aggiuntive.
`.trim();

    // 4. Resolve API key
    const apiKey = this.getApiKey(settings, provider);

    if (!apiKey) {
      return {
        proposedReply: `[Bozza Automatica]: Ciao @${req.authorUsername}, grazie per il tuo commento! (Nota: Inserisci una chiave API in Dashboard per attivare l'AI ${provider.toUpperCase()})`,
        modelUsed: 'mock-no-key',
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    }

    try {
      let reply = '';
      if (provider === 'openai' || provider === 'groq') {
        reply = await this.callOpenAICompatible(provider, model, apiKey, systemPrompt, userPrompt);
      } else if (provider === 'gemini') {
        reply = await this.callGemini(model, apiKey, systemPrompt, userPrompt);
      } else if (provider === 'anthropic') {
        reply = await this.callAnthropic(model, apiKey, systemPrompt, userPrompt);
      } else {
        throw new Error(`Provider non supportato: ${provider}`);
      }

      // Enforce max length constraint
      if (settings.max_reply_length > 0 && reply.length > settings.max_reply_length) {
        reply = reply.substring(0, settings.max_reply_length).trim();
      }

      return {
        proposedReply: reply.trim(),
        modelUsed: model,
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    } catch (err: any) {
      console.error(`[AIOrchestrator] Error generating reply with ${provider}:`, err.message);
      return {
        proposedReply: `[Errore AI ${provider}]: ${err.message}. Verifica la chiave API e la connessione.`,
        modelUsed: model,
        providerUsed: provider,
        fewShotExamplesCount: pastReplies.length,
      };
    }
  }

  private static buildSystemPrompt(settings: AppSettings, platform: string, pastReplies: any[]): string {
    const toneMap: Record<string, string> = {
      friendly: 'Amichevole, caloroso, empatico, con emoji appropriate ma senza esagerare.',
      professional: 'Formale, professionale, chiaro, cordiale e istituzionale. Limita o evita emoji.',
      concise: 'Estremamente sintetico, rapido, dritto al punto, senza fronzoli.',
      humorous: 'Brillante, simpatico, ironico con garbo, amichevole.',
      custom: settings.custom_tone_instructions || 'Naturale e autentico.',
    };

    const chosenTone = toneMap[settings.tone_of_voice] || toneMap.friendly;

    let prompt = `Sei l'assistente ufficiale dedicato alla gestione delle risposte ai commenti sui canali social del nostro brand.
Il tuo compito è elaborare una risposta di alta qualità, calibrata sul commento ricevuto.

### LINEE GUIDA GENERALI:
1. Piattaforma attuale: ${platform.toUpperCase()}. Adatta il formato e lo stile (es. brevità su X, professionale su LinkedIn, dinamico ed empatico su Instagram/TikTok).
2. Tono di voce: ${chosenTone}
${settings.custom_tone_instructions ? `3. Istruzioni specifiche di stile: ${settings.custom_tone_instructions}` : ''}
4. Lunghezza massima: massimo ${settings.max_reply_length || 280} caratteri.

### LIMITI DI CONOSCENZA & GUARDRAILS (DA RISPETTARE TASSATIVAMENTE):
${settings.business_knowledge ? `INFORMAZIONI AZIENDALI & FAQ (Usa SOLO queste informazioni per prezzi, orari, spedizioni, policy):\n${settings.business_knowledge}` : 'Rispondi con cortesia invitando a contattare il supporto o il sito web per dettagli specifici.'}
${settings.forbidden_words ? `PAROLE O ARGOMENTI VIETATI (Non usare mai questi termini):\n${settings.forbidden_words}` : ''}
- Non inventare informazioni non presenti nella base di conoscenza. Se non conosci un dettaglio tecnico o privato, invita cortesemente l'utente a scrivere in Direct Message (DM) o all'assistenza.
- Mantieni sempre la calma, anche di fronte a commenti provocatori o critici.
`;

    // Inject Few-Shot Examples (Learning Loop)
    if (pastReplies.length > 0) {
      prompt += `\n### ESEMPI DI RISPOSTE REALI APPROVATE IN PASSATO DALL'OPERATORE UMANO:\n`;
      prompt += `Impara da questi esempi per replicare esattamente lo stile, le abitudini e le formule approvate:\n`;
      pastReplies.forEach((item, index) => {
        prompt += `\n[Esempio ${index + 1} - ${item.platform.toUpperCase()}]\nCommento: "${item.comment_text}"\nRisposta Approvata: "${item.approved_reply}"\n`;
      });
    }

    return prompt;
  }

  private static getApiKey(settings: AppSettings, provider: AIProvider): string {
    switch (provider) {
      case 'openai': return settings.api_key_openai || process.env.OPENAI_API_KEY || '';
      case 'gemini': return settings.api_key_gemini || process.env.GEMINI_API_KEY || '';
      case 'anthropic': return settings.api_key_anthropic || process.env.ANTHROPIC_API_KEY || '';
      case 'groq': return settings.api_key_groq || process.env.GROQ_API_KEY || '';
      default: return '';
    }
  }

  private static getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case 'openai': return 'gpt-4o-mini';
      case 'gemini': return 'gemini-1.5-flash';
      case 'anthropic': return 'claude-3-5-sonnet-20241022';
      case 'groq': return 'llama-3.1-70b-versatile';
      default: return 'gpt-4o-mini';
    }
  }

  private static async callOpenAICompatible(
    provider: 'openai' | 'groq',
    model: string,
    apiKey: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const baseUrl = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(baseUrl, {
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
      const errText = await res.text();
      throw new Error(`API error (${res.status}): ${errText}`);
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
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
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
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    return data.content?.[0]?.text || '';
  }
}
