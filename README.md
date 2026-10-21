# DNAReplya 🧬💬

> AI-Powered Social Media Reply & Approval Assistant with Telegram Integration & Few-Shot Learning Loop.

DNAReplya è uno strumento web e automazione per gestire, filtrare e rispondere ai commenti provenienti dai social network (**Instagram, Facebook, Threads, LinkedIn, TikTok, X**), con notifica e approvazione in un click via **Telegram**, dashboard di controllo guardrails/limiti, e apprendimento continuo (Dynamic Few-Shot RAG) basato sulle risposte approvate con supporto **BYOK (Bring Your Own Key)** per i principali LLM.

---

## 📌 Documentazione & Studio di Fattibilità

Per l'analisi dettagliata delle API dei singoli social network, dei requisiti di approvazione e delle policy, consulta:
- 📄 [Studio di Fattibilità & Punti Critici](./docs/FEASIBILITY_STUDY.md)

---

## 🚀 Funzionalità Principali

1. **Social Ingestion Hub**:
   - Webhooks per Facebook Pages, Instagram Business, Threads, LinkedIn Pages, TikTok Biz e X.
   - Coda asincrona ad alta velocità per rispondere ai webhook entro i 3 secondi richiesti dalle piattaforme.

2. **Telegram Bot Human-in-the-Loop**:
   - Notifica istantanea del commento in arrivo con card contestuale (autore, post, testo, sentiment).
   - Proposta di risposta generata dall'LLM.
   - Inline Keyboard per:
     - 🟢 **Approva e Invia**
     - ✏️ **Modifica Rapida**
     - 🔄 **Rigenera con variante**
     - ❌ **Ignora / Archivia**

3. **Dashboard di Controllo & Guardrails**:
   - **BYOK (Bring Your Own Key)**: Supporto per OpenAI, Anthropic Claude, Google Gemini, Groq.
   - **Limiti & Conoscenza**: Tone of Voice, blacklist parole, FAQ e informazioni aziendali da cui attingere le risposte.
   - **Modalità Auto-Pilot**: Possibilità di attivare risposte automatiche dirette per categorie di commenti a basso rischio.

4. **Dynamic Few-Shot Learning Loop**:
   - Memorizzazione vettoriale delle risposte approvate e corrette manualmente.
   - Iniezione automatica degli esempi passati nel prompt per replicare fedelmente lo stile dell'operatore.
