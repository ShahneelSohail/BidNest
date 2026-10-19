# BidNest

An online auction platform where sellers list items, buyers bid in real time, and administrators approve and moderate listings.

> **Status:** this repository holds the original ASP.NET Core application, built as a team project at Aptech. A full overhaul (Next.js, TypeScript, Express, PostgreSQL and Socket.io) is in progress on a separate branch.

## The original application

- **Stack:** ASP.NET Core 8 MVC, SQL Server with Entity Framework Core, cookie authentication, SignalR for live bidding, Razor views with Bootstrap, BCrypt password hashing.
- **Roles:** administrators, sellers and buyers, each with their own panel.
- **Features:** item listings with images and documents, categories, search, auctions and bidding, watchlist, notifications, ratings, contact messages and an admin panel.
- **Data model:** Users, Roles, Items, ItemImages, ItemDocuments, Categories, Bids, Watchlist, Notifications, Ratings and ContactMessages. The schema is in [`Database/`](Database).
- **Documentation:** the team's detailed analysis and screenshots are in [`Documentation/ORIGINAL_README.md`](Documentation/ORIGINAL_README.md), and the project presentation is in [`Documentation/`](Documentation).

### Running the original

1. Create a SQL Server database named `bidnest` from [`Database/database.sql`](Database/database.sql) (and the stored procedures in [`Database/Stored_procedure.sql`](Database/Stored_procedure.sql)).
2. Put your own SQL Server login in the `DefaultConnection` string of `BidNest/BidNest/appsettings.json`. The connection string is also hard-coded in `OnConfiguring` of `BidNest/BidNest/Models/BidnestContext.cs`; update it there as well. The original login was removed from this repository's history.
3. From `BidNest/BidNest`, run `dotnet run`.

## Credits

| Contributor | Part in this repository (from the commit history) |
|---|---|
| **S A M E E R** ([Konete326](https://github.com/Konete326), original repository: [Konete326/BidNest](https://github.com/Konete326/BidNest)) | Original author of the application: project structure, models, authentication, categories, items, admin and user panels, the bidding system, UI themes, documentation and the presentation. 10 of the 13 commits. |
| **Shahneel Sohail** (commits as `shahneel` and `Neel455`) | The UI redesign ("Complete UI change") and the React landing page ("Landing page added"). |
| **zahashakirali** | A bug-fix commit ("error solve"). |

### Landing page

The landing page is built with React, Vite, Tailwind CSS, GSAP and three.js. It is adapted from the **JavaScript Mastery** tutorial "Stunning GSAP Cocktail Website" by Adrian Hajdin, then rebranded and extended for BidNest by Shahneel Sohail: new hero, sections, 3D scenes, content and styling.

### Third-party assets

The Bootstrap theme in [`Theme/`](Theme), the 3D models in `BidNest/BidNest/wwwroot/models`, and the "Modern Negra" demo font are third-party assets used under their own licences. Check those licences before any commercial use.

## History note

Generated build output (`bin/`, `obj/`, `.vs/`) and a local database login were removed from this repository's history. Authors, dates and commit messages were preserved. One early commit made up only of build output no longer exists as a result.
