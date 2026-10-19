# BidNest

An online auction platform where sellers list items, buyers bid in real time, and administrators approve and moderate listings.

> **Status:** the overhaul is complete: a Next.js and TypeScript front end, an Express, Prisma and PostgreSQL API, and live bidding over Socket.io. The original ASP.NET Core application, built as a team project at Aptech, is kept in [`legacy/`](legacy).

## The overhaul

| Part | Stack |
|---|---|
| [`web/`](web) | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, socket.io-client, GSAP and react-three-fiber on the landing page |
| [`api/`](api) | Express 4, TypeScript, Prisma 6, PostgreSQL, zod validation, cookie-based JWT sessions, multer uploads, Socket.io |
| Tests | Vitest and supertest for the API (with an embedded PostgreSQL), Playwright end-to-end tests for the web app |

**Highlights**

- Bidding runs inside a transaction that locks the item row, so two simultaneous bids can never both win. Every accepted bid is pushed instantly to everyone watching that auction, and outbid, won and approval notifications reach the right user in real time.
- A background timer closes finished auctions, picks the winner and sends "ending soon" reminders at 30, 15, 5 and 1 minutes.
- Listings go through admin approval. Admins manage users, categories, listings, bids and contact messages.
- Buyers get a dashboard (bids, won items with payment and seller rating, watchlist, notifications). Sellers get listing management and earnings stats.
- The landing page keeps the original look. Its 3D scenes load only when scrolled near, pause when off screen, and use compressed models (about 42 MB of models became about 1.5 MB).

### Running it

You need Node.js 20 or newer.

```bash
cd api
cp .env.example .env        # set JWT_SECRET (instructions inside)
npm install
npm run db:dev              # local PostgreSQL on :5432 (or run `docker compose up -d` in the repo root)
npm run db:push && npm run db:seed
npm run dev                 # API on http://localhost:4000
```

```bash
cd web
cp .env.example .env
npm install
npm run dev                 # web app on http://localhost:3000
```

The seed creates demo data and accounts such as `admin@bidnest.test` and `maya@bidnest.test`; the shared demo password is in [`api/prisma/seed.ts`](api/prisma/seed.ts). It is for local development only.

Tests: `npm test` in `api/`, and `npm run test:e2e` in `web/` (with the API and web app running).

## The original application (in `legacy/`)

- **Stack:** ASP.NET Core 8 MVC, SQL Server with Entity Framework Core, cookie authentication, SignalR for live bidding, Razor views with Bootstrap, BCrypt password hashing.
- **Roles:** administrators, sellers and buyers, each with their own panel.
- **Features:** item listings with images and documents, categories, search, auctions and bidding, watchlist, notifications, ratings, contact messages and an admin panel.
- **Data model:** Users, Roles, Items, ItemImages, ItemDocuments, Categories, Bids, Watchlist, Notifications, Ratings and ContactMessages. The schema is in [`legacy/Database/`](legacy/Database).
- **Documentation:** the team's detailed analysis and screenshots are in [`Documentation/ORIGINAL_README.md`](Documentation/ORIGINAL_README.md), and the project presentation is in [`Documentation/`](Documentation).

### Running the original

1. Create a SQL Server database named `bidnest` from [`legacy/Database/database.sql`](legacy/Database/database.sql) (and the stored procedures in [`legacy/Database/Stored_procedure.sql`](legacy/Database/Stored_procedure.sql)).
2. Put your own SQL Server login in the `DefaultConnection` string of `legacy/BidNest/BidNest/appsettings.json`. The connection string is also hard-coded in `OnConfiguring` of `legacy/BidNest/BidNest/Models/BidnestContext.cs`; update it there as well. The original login was removed from this repository's history.
3. From `legacy/BidNest/BidNest`, run `dotnet run`.

## Credits

| Contributor | Part in this repository (from the commit history) |
|---|---|
| **S A M E E R** ([Konete326](https://github.com/Konete326), original repository: [Konete326/BidNest](https://github.com/Konete326/BidNest)) | Original author of the application: project structure, models, authentication, categories, items, admin and user panels, the bidding system, UI themes, documentation and the presentation. 10 of the 13 commits. |
| **Shahneel Sohail** (commits as `shahneel` and `Neel455`) | The UI redesign ("Complete UI change") and the React landing page ("Landing page added"). |
| **zahashakirali** | A bug-fix commit ("error solve"). |

### Landing page

The landing page is built with React, Vite, Tailwind CSS, GSAP and three.js. It is adapted from the **JavaScript Mastery** tutorial "Stunning GSAP Cocktail Website" by Adrian Hajdin, then rebranded and extended for BidNest by Shahneel Sohail: new hero, sections, 3D scenes, content and styling.

### Third-party assets

The Bootstrap theme in [`legacy/Theme/`](legacy/Theme), the 3D models in `legacy/BidNest/BidNest/wwwroot/models`, and the "Modern Negra" demo font are third-party assets used under their own licences. Check those licences before any commercial use.

## History note

Generated build output (`bin/`, `obj/`, `.vs/`) and a local database login were removed from this repository's history. Authors, dates and commit messages were preserved. One early commit made up only of build output no longer exists as a result.
