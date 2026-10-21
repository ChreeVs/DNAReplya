import { dbRepository, ProfileRecord, GlobalSettings } from '../../db/index.js';
import { AIProvider, GenerateReplyRequest, GenerateReplyResponse } from './types.js';

export class AIOrchestrator {
  /**
   * Generates a context-aware, guardrail-compliant reply using the configured LLM and profile memory.
   */
  static async generateReply(req: GenerateReplyRequest): Promise<GenerateReplyResponse> {
    const profile = await dbRepository.getProfileById(req.profileId);
    const globalSettings = await dbRepository.getGlobalSettings();

    // Clean username to avoid double @@
    const cleanUsername = (req.authorUsername || '').replace(/^@+/, '');

    // 1. Resolve provider and API key with smart auto-fallback
    let provider = (profile?.ai_provider || globalSettings.default_ai_provider || 'openai') as AIProvider;
    let apiKey = this.getApiKey(globalSettings, provider);

    // If the selected provider has no API key, automatically fallback to whichever provider has a key
    if (!apiKey) {
      if (this.getApiKey(globalSettings, 'gemini')) {
        provider = 'gemini';
        apiKey = this.getApiKey(globalSettings, 'gemini');
      } else if (this.getApiKey(globalSettings, 'openai')) {
        provider = 'openai';
        apiKey = this.getApiKey(globalSettings, 'openai');
      } else if (this.getApiKey(globalSettings, 'anthropic')) {
        provider = 'anthropic';
        apiKey = this.getApiKey(globalSettings, 'anthropic');
      }
    }

    // Ensure model matches provider
    let model = profile?.ai_model || '';
    if (provider === 'gemini') {
      if (!model || !model.toLowerCase().includes('gemini') || model === 'gemini-1.5-flash') {
        model = 'gemini-2.0-flash';
      }
    } else if (provider === 'openai') {
      if (!model || !model.toLowerCase().includes('gpt')) model = 'gpt-4o-mini';
    } else if (provider === 'anthropic') {
      if (!model || !model.toLowerCase().includes('claude')) model = 'claude-3-5-sonnet-20241022';
    }

    // 2. Retrieve dynamic few-shot examples strictly isolated for this client/profile
    const pastReplies = await dbRepository.getApprovedRepliesByProfile(req.profileId, 5);

    // 3. Build system prompt tailored to this profile's brand persona and boundaries
    const systemPrompt = this.buildSystemPrompt(profile, req.platform, pastReplies);

    // 4. Build user prompt
    const userPrompt = `
CLIENTE / BRAND: ${profile ? profile.name : 'Brand'}
PIATTAFORMA: ${req.platform.toUpperCase()}
AUTORE DEL COMMENTO: @${cleanUsername}
${req.postSnippet ? `POST DI RIFERIMENTO: "${req.postSnippet}"` : ''}
TESTO DEL COMMENTO RICEVUTO:
"${req.commentText}"

Elabora ora la migliore risposta rispettando rigorosamente le linee guida del brand, il tono e i limiti imposti. Rispondi SOLO con il testo del messaggio finale senza virgolette né spiegazioni.
`.trim();

    if (!apiKey) {
      return {
        proposedReply: `[Bozza]: Ciao @${cleanUsername}, grazie per il tuo commento! (Configura la chiave API ${provider.toUpperCase()} nella Dashboard per attivare l'AI).`,
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
      case 'gemini': return 'gemini-2.0-flash';
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
    // 1. Sanitize model name
    const requestedModel = (model || 'gemini-2.0-flash').replace(/^models\//, '').trim();
    const primary = (requestedModel === 'gemini-1.5-flash' || !requestedModel)
      ? 'gemini-2.0-flash'
      : requestedModel;

    // High-priority candidate list to try sequentially
    const candidateModels = Array.from(new Set([
      primary,
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash-002',
      'gemini-1.5-pro-latest',
      'gemini-pro',
    ].filter(Boolean)));

    // Helper to attempt generation on a specific model
    const tryModel = async (targetModel: string, useSystemInstruction = true): Promise<string | null> => {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;
      const body: any = {
        contents: [{
          parts: [{
            text: useSystemInstruction
              ? userPrompt
              : (systemPrompt ? `${systemPrompt}\n\n---\n\n${userPrompt}` : userPrompt)
          }]
        }],
        generationConfig: { temperature: 0.7 },
      };

      if (useSystemInstruction && systemPrompt) {
        body.systemInstruction = { parts: [{ text: systemPrompt }] };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const errText = await res.text();

      // If 400 error mentions unsupported systemInstruction, retry without it
      if (res.status === 400 && useSystemInstruction && (errText.includes('systemInstruction') || errText.includes('system_instruction'))) {
        return tryModel(targetModel, false);
      }

      // If 404 Not Found, return null so loop can try the next candidate
      if (res.status === 404 || errText.includes('not found')) {
        console.warn(`[AIOrchestrator] Gemini model "${targetModel}" returned 404 Not Found. Trying next candidate...`);
        return null;
      }

      // Any other error (400 invalid key, 429 quota, etc.) should fail immediately
      throw new Error(`Gemini error (${res.status}): ${errText}`);
    };

    // Step 1: Try static candidate models
    for (const cand of candidateModels) {
      try {
        const result = await tryModel(cand);
        if (result !== null) {
          return result;
        }
      } catch (err: any) {
        // Only bubble up if it's not a 404 candidate miss
        throw err;
      }
    }

    // Step 2: If all static names return 404, query ListModels dynamically
    try {
      console.log('[AIOrchestrator] Interrogazione ModelService.ListModels per trovare modelli supportati dalla chiave API...');
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (listRes.ok) {
        const listData = await listRes.json() as any;
        const availableModels: any[] = listData.models || [];
        const supported = availableModels
          .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => String(m.name).replace(/^models\//, ''));

        // Pick best available model (prefer flash > gemini > first available)
        const best = supported.find(m => m.includes('2.0') && m.includes('flash'))
          || supported.find(m => m.includes('flash'))
          || supported.find(m => m.includes('gemini'))
          || supported[0];

        if (best) {
          console.log(`[AIOrchestrator] Trovato modello attivo compatibile: ${best}`);
          const resText = await tryModel(best, true);
          if (resText !== null) return resText;
        }
      }
    } catch (listErr: any) {
      console.warn('[AIOrchestrator] ListModels fallback non riuscito:', listErr.message);
    }

    throw new Error('Nessun modello Gemini abilitato trovato per questa API key. Crea una chiave gratuita su https://aistudio.google.com/ e incollala in Configurazione.');
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
