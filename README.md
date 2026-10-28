# b3-portal-api

Node 20+, Express, MongoDB, Bunny Stream.

```bash
npm install
cp .env.example .env
npm run keys            # paste the 4 JWT lines into .env
npm run seed            # products + offers (idempotent)
npm run create-owner -- you@consultb3.com "StrongPass123" Kristi Stanbery-Bedgood
npm run dev
```

Layering rule: `api/` (HTTP only) -> `services/` (business logic) -> `db/models/` (schemas only).
Integrations (`integrations/bunny`, `integrations/hubspot`) are called by services, never by controllers.
