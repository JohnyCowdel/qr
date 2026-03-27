## Territory QR

Database-backed Next.js prototype for a GPS-verified territory claiming game.

### What it includes

- QR route per location at `/l/[slug]`
- SQLite database via Prisma for teams, users, locations, and claim history
- GPS claim verification with a configurable meter radius
- Message log per claim event
- OpenStreetMap view with team-colored claim overlays
- QR code image route for printing or embedding

### Tech stack

- Next.js App Router
- TypeScript
- Prisma + SQLite for development
- React Leaflet + OpenStreetMap tiles

### Local setup

1. Install dependencies:

```bash
npm install
```

2. Create the database and run the first migration:

```bash
npm run db:migrate -- --name init
```

3. Seed the sample teams, locations, and claim history:

```bash
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

5. Open `http://localhost:3000`

### Key routes

- `/` overview dashboard with map and recent claims
- `/l/[slug]` location detail page opened by QR code
- `/qr/[slug]` raw QR code image route for a location

### Deployment notes

- For production, switch `DATABASE_URL` from SQLite to PostgreSQL.
- Replace the local claim circles with stored polygons by filling `territoryGeoJson`.
- Add real auth before a public launch; this prototype uses player handle + team selection.
