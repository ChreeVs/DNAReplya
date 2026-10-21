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
    const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    const cleanRequested = (model || '').replace(/^models\//, '').trim();

    // High-priority candidate list across both v1 and v1beta
    // Note: 'gemini-1.5-flash' is GA on v1, while 'gemini-2.0-flash' is on v1beta/v1
    const candidatePairs: Array<{ ver: 'v1' | 'v1beta'; name: string }> = [
      ...(cleanRequested ? [
        { ver: 'v1' as const, name: cleanRequested },
        { ver: 'v1beta' as const, name: cleanRequested },
      ] : []),
      // Primary GA models
      { ver: 'v1', name: 'gemini-1.5-flash' },
      { ver: 'v1beta', name: 'gemini-2.0-flash' },
      { ver: 'v1', name: 'gemini-2.0-flash' },
      { ver: 'v1', name: 'gemini-1.5-pro' },
      { ver: 'v1beta', name: 'gemini-1.5-flash-latest' },
      { ver: 'v1beta', name: 'gemini-1.5-flash' },
      { ver: 'v1beta', name: 'gemini-2.0-flash-lite' },
      { ver: 'v1beta', name: 'gemini-pro' },
    ];

    // Deduplicate candidate pairs
    const seen = new Set<string>();
    const uniquePairs = candidatePairs.filter(p => {
      const key = `${p.ver}:${p.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let lastErrorMsg = '';

    // Helper to attempt generation on a specific (version, model) pair
    const tryModel = async (
      ver: 'v1' | 'v1beta',
      targetModel: string
    ): Promise<string | null> => {
      const endpoint = `https://generativelanguage.googleapis.com/${ver}/models/${targetModel}:generateContent?key=${cleanKey}`;

      // Combine system prompt and user input so it works seamlessly on both v1 and v1beta
      const combinedText = systemPrompt
        ? `${systemPrompt}\n\n### RICHIESTA COMMENTO:\n${userPrompt}`
        : userPrompt;

      const body = {
        contents: [{
          role: 'user',
          parts: [{ text: combinedText }],
        }],
        generationConfig: {
          temperature: 0.7,
        },
      };

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
      let parsedErr: any = null;
      try { parsedErr = JSON.parse(errText); } catch (_) {}
      const errMsg = parsedErr?.error?.message || errText;

      // If status 404 (endpoint or model name not found in this version), allow trying next candidate
      if (res.status === 404 || parsedErr?.error?.status === 'NOT_FOUND') {
        console.warn(`[AIOrchestrator] Gemini (${ver}/${targetModel}) 404: ${errMsg}`);
        lastErrorMsg = errMsg;
        return null;
      }

      // If status is 400 (invalid API key) or 403 (unregistered / permissions), fail immediately!
      throw new Error(`Google API (${res.status}): ${errMsg}`);
    };

    // Step 1: Try static candidate models
    for (const cand of uniquePairs) {
      try {
        const result = await tryModel(cand.ver, cand.name);
        if (result !== null) {
          return result;
        }
      } catch (err: any) {
        // Real API errors (invalid key, project not found, billing) should bubble up immediately
        throw err;
      }
    }

    // Step 2: Fallback - query ModelService.ListModels on v1 and v1beta
    try {
      console.log('[AIOrchestrator] Interrogazione ModelService.ListModels...');
      for (const ver of ['v1', 'v1beta'] as const) {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/${ver}/models?key=${cleanKey}`);
        if (!listRes.ok) {
          const listErr = await listRes.text();
          console.warn(`[AIOrchestrator] ListModels (${ver}) non riuscito:`, listRes.status, listErr);
          continue;
        }

        const listData = await listRes.json() as any;
        const availableModels: any[] = listData.models || [];
        const supported = availableModels
          .filter(m => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
          .map(m => String(m.name).replace(/^models\//, ''));

        const best = supported.find(m => m.includes('flash'))
          || supported.find(m => m.includes('gemini'))
          || supported[0];

        if (best) {
          console.log(`[AIOrchestrator] Trovato modello attivo compatibile da ListModels (${ver}): ${best}`);
          const resText = await tryModel(ver, best);
          if (resText !== null) return resText;
        }
      }
    } catch (listErr: any) {
      console.warn('[AIOrchestrator] ListModels fallback fallito:', listErr.message);
    }

    throw new Error(`Google Gemini: Impossibile generare la risposta (${lastErrorMsg || 'Modello non raggiungibile'}). Verifica la chiave API creata su https://aistudio.google.com/`);
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
