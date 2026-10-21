# Studio di Fattibilità & Analisi Punti Critici: DNAReplya

## 1. Executive Summary & Verdetto

Il progetto **DNAReplya** ha un altissimo valore pratico e ricalca logiche già validate da strumenti come *Manychat*, *Brand24* e *Gorgias*, con il differenziale competitivo dell'integrazione con **Telegram** (per human-in-the-loop / approvazione one-click) e di un **motore di apprendimento continuo basato su LLM (BYOK)**.

> **Verdetto di Fattibilità**: **FATTIBILE con approccio incrementale (MVP in 3 Fasi)**.  
> La parte applicativa (Dashboard, Telegram Bot, orchestrazione LLM, apprendimento e database) è realizzabile senza vincoli bloccanti. Il vero punto critico **non è il codice**, bensì le **policy di accesso, i costi di licenza e i processi di approvazione (App Review) delle API dei singoli social network**.

---

## 2. Matrice di Fattibilità per Piattaforma

La tabella seguente riassume la disponibilità tecnica delle API ufficiali per ciascun social target:

| Piattaforma | Webhook Commenti Real-Time | Risposta via API | Requisiti di Accesso / App Review | Costo API | Livello di Rischio / Complessità |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Instagram** | ✅ Sì (`comments`, `mentions`) | ✅ Sì (`/replies`) | Meta Business Verification + App Review (`instagram_manage_comments`) | Gratuito | 🟡 Medio (burocrazia Meta) |
| **Facebook Pages** | ✅ Sì (`feed`) | ✅ Sì (`/{comment-id}/comments`) | Meta App Review (`pages_manage_posts`, `pages_read_engagement`) | Gratuito | 🟢 Basso / Standard |
| **Threads** | ✅ Sì (Threads API v1.0) | ✅ Sì (`reply_to_id`) | Meta Developer Portal + Threads API Review | Gratuito | 🟡 Medio (API recente, Giugno 2024) |
| **LinkedIn** | ⚠️ Parziale (Company Pages) | ✅ Sì (per Company Pages) | Community Management API / Marketing Partner. **Profili personali ESCLUSI**. | Gratuito (su approvazione) | 🔴 Alto (solo pagine aziendali; profili privati vietati dai ToS) |
| **TikTok** | ⚠️ Parziale (Business Account) | ✅ Sì (`/comment/reply/`) | TikTok for Developers Commercial API. Richiede account TikTok Business. | Gratuito (su approvazione) | 🔴 Alto (processo di approvazione partner selettivo) |
| **X (Twitter)** | ⚠️ Limitato (Account Activity API) | ✅ Sì (`POST /2/tweets`) | Livello Free = solo scrittura limitata. Lettura/Webhooks = **Basic Tier ($100/mese)** o Pro. | **A pagamento ($100+/mo)** | 🔴 Alto (barriera di costo imposta da X) |

---

## 3. I 5 Punti Critici Fondamentali

### 1. Il Muro delle Policy e App Review dei Social
* **Meta (FB, IG, Threads)**: In modalità sviluppo ("Development Mode") le API funzionano solo per gli account amministratori/tester dell'app Meta. Per andare in produzione e connettere account di clienti o utenti finali, serve la **Verifica Aziendale (Business Verification)** e l'**App Review** con screencast di conformità.
* **Profili Personali vs Pagine Aziendali (LinkedIn & Meta)**: Le API ufficiali consentono automazioni **solo su Pagine Aziendali** (Facebook Pages, Instagram Business/Creator, LinkedIn Organization Pages). Automatizzare commenti su profili personali viola i Termini di Servizio (rischio shadowban o ban dell'account).
* **Soluzione consigliata**: Progettare il sistema come **Self-Hosted / Single-Tenant** o richiedere agli utenti le proprie credenziali Meta Developer durante la fase alpha/beta, passando poi all'App Review ufficiale per la release SaaS.

### 2. Il Costo dell'API di X (Twitter)
* Dal 2023, l'accesso in lettura alle API di X non è più gratuito. Per monitorare menzioni e commenti in tempo reale con webhooks (Account Activity API) serve un tier Enterprise, oppure con il tier **Basic da $100/mese** bisogna effettuare polling periodico (`GET /2/users/:id/mentions`) con un tetto di 10.000 tweet/mese.
* **Soluzione consigliata**: Rendere X un modulo opzionale configurabile dall'utente solo se dispone del proprio piano sviluppatore a pagamento.

### 3. Latenza dei Webhook e Architettura Asincrona
* Le piattaforme social (in particolare Meta) pretendono che l'endpoint di webhook risponda con `HTTP 200 OK` entro **3-5 secondi**, altrimenti considerano la richiesta fallita, attivano retry a raffica e disabilitano il webhook.
* L'invocazione di un LLM (OpenAI, Gemini, Anthropic) per generare la risposta può richiedere da 1 a 4 secondi, e la consegna Telegram un altro secondo.
* **Architettura obbligatoria**: Webhook Ingestion ultra-veloce con **Coda di Lavoro Asincrona** (es. Redis + BullMQ oppure background job SQLite/Postgres). Il webhook riceve l'evento, lo inserisce in coda e risponde istantaneamente `200 OK`; il worker elabora l'LLM e notifica Telegram in background.

### 4. Il Meccanismo di "Apprendimento" (Learning Loop)
* Il prompt richiede: *"deve imparare dai messaggi a cui abbiamo già risposto e che approviamo dalle sue proposte"*.
* **Cosa NON fare**: Eseguire fine-tuning periodico del modello (costosissimo, lento, rischia "allucinazioni" e overfitting catastrofico).
* **Cosa fare (Dynamic Few-Shot RAG)**:
  1. Ogni volta che una proposta viene approvata (o modificata dall'operatore su Telegram/Dashboard), la coppia `(Commento Ricevuto, Risposta Finale Approvata)` viene salvata in un database con **embedding vettoriale**.
  2. Quando arriva un nuovo commento, il sistema cerca tramite similarità semantica i 3-5 esempi passati più pertinenti.
  3. Questi esempi vengono iniettati dinamicamente nel prompt dell'LLM come **esempi Few-Shot**: *"Ecco come l'utente ha risposto in passato a commenti simili"*.
  4. In questo modo l'LLM replica immediatamente lo stile, il tono e le policy aziendali senza costi di training e in tempo reale.

### 5. Esperienza Telegram Human-in-the-Loop
* L'interfaccia su Telegram deve essere istantanea e chiara.
* Per ogni commento ricevuto, il Bot Telegram invia una card formattata con **Inline Keyboard**:
  * 🟢 **Approva e Pubblica**: invia la risposta direttamente sulla piattaforma di origine.
  * ✏️ **Modifica**: permette all'operatore di scrivere una variante rapida prima della pubblicazione.
  * 🔄 **Rigenera**: richiede all'LLM una nuova opzione con tono differente.
  * ❌ **Ignora / Archivia**: non fa nulla.
  * ⚡ **Modalità Auto-Pilot**: impostabile dalla dashboard per rispondere automaticamente senza attesa se il livello di confidenza supera una certa soglia.

---

## 4. Architettura Tecnica Raccomandata

1. **Backend / Core Engine**:
   - Webhook Receiver ad alta reattività (Node.js/Next.js o FastAPI).
   - In-memory / persistent queue per processamento background.
2. **Dashboard Web**:
   - Gestione BYOK (OpenAI, Gemini, Anthropic, Groq).
   - Configurazione System Prompt, Guardrails (termini vietati, regole aziendali).
   - Modulo RAG (FAQ, schede prodotto, knowledge base).
   - Simulator & Debugger: per inviare commenti di prova e testare la risposta e Telegram senza dover postare sui veri social.
3. **Telegram Bot**:
   - Webhook Telegram Bot API con notifiche dettagliate e pulsanti di callback one-click.

---

## 5. Piano di Rilascio Suggerito (Roadmap Incrementale)

| Fase | Focus | Obiettivi |
| :--- | :--- | :--- |
| **Fase 1 (MVP)** | **Core Engine + Telegram + Meta (IG & FB)** | - Setup Next.js / Node.js + Database.<br>- Dashboard impostazioni (BYOK, Tone of Voice, Guardrails).<br>- Bot Telegram con bottoni Approva / Modifica / Scarta.<br>- Integrazione Webhook Facebook Pages & Instagram Business.<br>- Dynamic Few-Shot RAG store per memorizzare le risposte approvate. |
| **Fase 2** | **Espansione Piattaforme** | - Aggiunta Threads API.<br>- Aggiunta LinkedIn Community Management API (Pagine aziendali).<br>- Selettore regole personalizzate per piattaforma. |
| **Fase 3** | **TikTok & X + Auto-Pilot avanzato** | - Integrazione TikTok Business API.<br>- Integrazione modulo X (Twitter) con polling configurabile.<br>- Analisi del sentiment del commento con routing prioritario. |
