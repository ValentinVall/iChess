# iChess

`beta 0.3.1`

iChess is a full-stack chess platform with local account authentication, AI games, online multiplayer, public player profiles, friends, notifications, and persistent game state for active matches.

The project is currently in beta and is intended for internal evaluation and controlled testing.

## Current Scope

- Local username and password authentication
- JWT-based access flow with refresh token rotation
- AI games powered by Stockfish
- Online multiplayer over Socket.IO
- Separate stats for `bullet`, `blitz`, `rapid`, and AI play
- Public profiles by player number
- Friends system with incoming and outgoing requests
- Notification center for friend requests and active-match rejoin
- Unique URLs for active games:
  - `/game/live/:gameId`
  - `/game/ai/:gameId`
- Theme persistence across page reloads
- Password change from profile settings
- Registration protection with server-side rate limiting

## Stack

- React
- TypeScript
- Vite
- Node.js
- Express
- PostgreSQL
- Socket.IO
- Stockfish

## Local Development

### Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL 15 or compatible local instance

Optional:

- Docker Desktop, if you want PostgreSQL through `docker compose`

### Environment Variables

The repository uses environment configuration files for local runtime, frontend configuration, backend runtime, and deployment-specific setup.

These files exist in the project, but the exact keys and values are intentionally not documented publicly in this README.

Sensitive runtime values should remain private and should not be committed or published.

## Running the Project Locally

### Option 1: Run services manually

Start PostgreSQL first, then run backend and frontend separately.

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

### Option 2: Start PostgreSQL with Docker and run app manually

```bash
docker compose up -d postgres
```

Then run backend and frontend with the manual commands above.

### Option 3: Full development stack with Docker Compose

The repository also includes a development-oriented Docker Compose setup.

```bash
docker compose up
```

This setup is intended for local development.

## Useful Scripts

Common commands:

```bash
cd backend
npm run dev
npm run build
npm run start
```

```bash
cd frontend
npm run dev
npm run build
npm run type-check
```

## Authentication Model

iChess currently uses local account authentication.

- Registration requires a lowercase username and password
- Password changes are available for local accounts from the profile screen

Registration is protected with backend rate limiting to reduce automated account creation.

## AI and Online Play

### AI Games

- AI games are served through the backend engine integration
- Active AI games can be revisited through unique game URLs

### Online Games

- Matchmaking and live moves are handled with Socket.IO
- Active live matches use unique URLs for ongoing sessions

## Profiles, Stats, and Social Features

- Profiles support mode-specific stats
- AI stats are separated from online mode stats
- Friends are managed through a dedicated page
- Notifications surface friend requests and active match reminders

## Licensing

This repository is proprietary.

See `LICENSE` for the full terms. In short, the project is distributed as `All rights reserved`, and no permission is granted to reuse, redistribute, or claim the code as your own without prior written permission.

## Version

Current application label:

- `beta 0.3.1`

Release summary:

- local auth
- public profiles
- friends system
- AI stats
- online clock polish
- profile UX improvements
- registration rate limiting
