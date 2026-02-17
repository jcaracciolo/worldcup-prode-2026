import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yzcimgrudhtnjdlvgnhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y2ltZ3J1ZGh0bmpkbHZnbmhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM0ODQyMiwiZXhwIjoyMDg1OTI0NDIyfQ.KxC3zx7IWV1WKqu4BR5_HmT_eAlAt4f0QfoMNjjNaiQ'
);

async function main() {
  // Try to fetch matches from the running app
  try {
    const resp = await fetch('http://localhost:3000/api/matches');
    if (resp.ok) {
      const data = await resp.json();
      const matches = data.matches || [];
      console.log('API matches count:', matches.length);
      
      // Show knockout matches
      const ko = matches.filter((m: any) => m.stage !== 'GROUP_STAGE');
      console.log('Knockout matches:', ko.length);
      
      // Show the specific tied knockout matches (78, 85, 92, 99)
      const tiedIds = [78, 85, 92, 99];
      console.log('\nTied knockout matches:');
      for (const id of tiedIds) {
        const m = matches.find((m: any) => m.id === id);
        if (m) {
          console.log(`  match ${id}: ${m.homeTeam?.name || 'TBD'} (id:${m.homeTeam?.id}) vs ${m.awayTeam?.name || 'TBD'} (id:${m.awayTeam?.id}) [${m.stage}]`);
        } else {
          console.log(`  match ${id}: NOT FOUND`);
        }
      }
      
      // Show all group match teams to see available team IDs
      const groupMatches = matches.filter((m: any) => m.stage === 'GROUP_STAGE');
      const teams = new Map<number, string>();
      groupMatches.forEach((m: any) => {
        if (m.homeTeam?.id) teams.set(m.homeTeam.id, m.homeTeam.name || m.homeTeam.shortName);
        if (m.awayTeam?.id) teams.set(m.awayTeam.id, m.awayTeam.name || m.awayTeam.shortName);
      });
      console.log('\nAvailable teams:', teams.size);
      const sortedTeams = [...teams.entries()].sort((a, b) => a[0] - b[0]);
      sortedTeams.forEach(([id, name]) => console.log(`  ${id}: ${name}`));
    } else {
      console.log('API returned', resp.status);
    }
  } catch (e) {
    console.log('App not running, cannot fetch matches');
  }
}

main();
