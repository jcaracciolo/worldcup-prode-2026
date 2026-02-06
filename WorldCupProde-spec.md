# WorldCupProde Specification

## Overview

WorldCupProde is a fantasy betting application for the FIFA World Cup. The application is designed to track user selections and scores during the tournament.

**Note:** This is not a real-money betting application. It's for tracking predictions and scores among friends/groups.

## Core Features

- Track match selections/predictions
- Track scores
- World Cup match data integration

## API

**Provider:** [Football-Data.org](https://www.football-data.org/)  
**Base URL:** `https://api.football-data.org/v4/`  
**Authentication:** API key in `X-Auth-Token` header  
**Token Storage:** `.secrets` file (git-ignored)  
**Free Tier:** 10 requests/minute

### World Cup 2026 Data

- **Competition Code:** `WC`
- **Competition ID:** `2000`
- **Tournament Dates:** June 11 - July 19, 2026
- **Season ID:** `2398`

### Key Endpoints

| Endpoint                         | Description                |
| -------------------------------- | -------------------------- |
| `GET /competitions/WC`           | World Cup competition info |
| `GET /competitions/WC/matches`   | All matches/fixtures       |
| `GET /competitions/WC/teams`     | Participating teams        |
| `GET /competitions/WC/standings` | Group standings            |

### Example Request

```bash
curl -H "X-Auth-Token: YOUR_TOKEN" https://api.football-data.org/v4/competitions/WC/matches
```
