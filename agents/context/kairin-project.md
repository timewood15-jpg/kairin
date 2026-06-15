# Kairin Project Context

Project: Kairin
Type: AI Personal Finance Assistant

Stack:
- Node.js
- Telegram Bot
- Supabase
- Railway
- Claude AI
- Google Sheets API

Core Features:
- Text transaction parsing
- OCR receipt parsing
- AI financial assistant
- Google Sheet sync
- Monthly finance summary

Architecture:

## Main Flows

### Text Transaction Flow
messageRouter
→ transactionFlow.js
→ parser.js
→ transactionRepo
→ database.js
→ Supabase

### OCR Flow
ocrFlow.js
→ Claude Vision
→ OCR session
→ confirmation
→ database.js

### AI Chat
aiFlow.js
→ claude.js

Important Files:
- src/utils/parser.js → offline parser
- src/services/claude.js → AI parser + OCR
- src/flows/transactionFlow.js → text save flow
- src/flows/ocrFlow.js → OCR pipeline
- src/flows/ocrSessionFlow.js → OCR confirmation/edit
- src/services/database.js → DB layer
- src/services/google/sheets.js → Google Sheet sync

Current Architecture Rules:
- minimal patch first
- diff proposal before apply
- regression mandatory
- read-only unless approved
- no business logic rewrite without approval
- no temp test files unless approved
- cleanup temp files after testing
- never expose token/access_token/refresh_token

Known Improvements Already Done:
- Indonesian nominal parser hardened
- duplicate prevention added
- parserRules extracted
- validation extracted
- duplicateGuard extracted
- Google token logging hardened

Known Risks:
- ambiguous transfer intent
- OCR confidence still basic
- category coverage still limited
- duplicate prevention is in-memory only

Coding Philosophy:
- safe > clever
- minimal change > rewrite
- stable production > perfect architecture