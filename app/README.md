# WorldCupProde

Fantasy predictions app for FIFA World Cup 2026.

## Tech Stack

- **Frontend:** Next.js 15 with TypeScript and Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Match Data:** Football-Data.org API
- **Hosting:** Azure App Service

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase account
- Football-Data.org API key
- (For deployment) Azure account

### Setup

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd WorldCupProde/app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a new Supabase project
   - Run the schema from `supabase/schema.sql` in Supabase SQL Editor
   - Disable "Confirm email" in Authentication → Settings → Email Auth
   - Copy your project URL and keys

4. **Configure environment variables**

   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_TOKEN`
   - `NEXT_PUBLIC_APP_URL`

5. **Create first admin user**
   - Sign up manually in Supabase Auth dashboard
   - Update the user's profile: `UPDATE profiles SET is_admin = true WHERE email = 'your@email.com'`

6. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000)

## Deployment to Azure App Service

### Using GitHub Actions (Recommended)

1. Create an Azure App Service (Linux, Node 20)
2. Download the Publish Profile from Azure Portal
3. Add GitHub secrets:
   - `AZURE_WEBAPP_PUBLISH_PROFILE`: Paste the publish profile XML
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL`: Your Azure app URL
4. Push to `main` branch to trigger deployment

### Azure App Service Configuration

Add these environment variables in Azure Portal → Configuration:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FOOTBALL_DATA_API_TOKEN`
- `NEXT_PUBLIC_APP_URL`

## Project Structure

```
app/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   ├── admin/           # Admin panel
│   │   ├── login/           # Auth pages
│   │   ├── predictions/     # User predictions
│   │   ├── settings/        # User settings
│   │   ├── user/[userId]/   # View other user's predictions
│   │   └── match/[matchId]/ # Match detail
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   └── types/               # TypeScript types
├── supabase/
│   └── schema.sql           # Database schema
└── .env.local.example       # Environment template
```

## Features

- **Public:** View matches, scores, leaderboard
- **Users:** Make predictions for group & knockout stages
- **Admin:** Generate invite codes, control tournament phases
