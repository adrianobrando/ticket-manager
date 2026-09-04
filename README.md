This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Avvio e configurazione

Requisiti: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npx prisma generate
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000). Per una verifica di produzione:

```bash
npm run build
npm start
```

## Variabili d'ambiente

Copia `.env.example` in `.env`. `DATABASE_URL` indica il database SQLite locale,
mentre `ADMIN_PASSWORD` protegge la dashboard e le API amministrative.

Per le notifiche email configura `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
`SMTP_PASS`, `EMAIL_FROM` e `APP_URL`. Se il server SMTP non è configurato,
la creazione o l'aggiornamento che richiedono una notifica restituiscono un
errore esplicito.

### Mailpit in locale con Docker

Per provare le notifiche senza un account email reale, avvia Mailpit:

```bash
docker run -d --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

La configurazione Mailpit è già presente in `.env.example`: non richiede
`SMTP_USER` o `SMTP_PASS`. Dopo aver avviato l'app, le email catturate sono
visibili su [http://localhost:8025](http://localhost:8025).

Se il container esiste già ma è fermo, usa `docker start mailpit`. Per
controllare lo stato usa `docker ps`.

## Funzionalità

- `/new`: form pubblico per creare un ticket.
- `/t/[token]`: tracking pubblico, dettagli e commenti.
- `/admin`: dashboard protetta da `ADMIN_PASSWORD`, filtri, paginazione,
  modifica ticket e ricalcolo dello schedule.
- `POST /api/admin/schedule/run`: ricalcola le attività pianificate.
- Le email vengono inviate alla creazione del ticket e al cambio di stato.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
