import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yzcimgrudhtnjdlvgnhg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Y2ltZ3J1ZGh0bmpkbHZnbmhnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM0ODQyMiwiZXhwIjoyMDg1OTI0NDIyfQ.KxC3zx7IWV1WKqu4BR5_HmT_eAlAt4f0QfoMNjjNaiQ'
);

const userId = 'a7f1057c-d797-49ce-bb0c-d78534a5e7e9';

// Get user profile
const { data: profile, error: e1 } = await supabase.from('profiles').select('*').eq('id', userId).single();
if (e1) console.log('profile error:', e1);
else console.log('Profile:', profile.display_name, profile.email);

// Get knockout predictions
const { data: preds, error: e2 } = await supabase
  .from('predictions')
  .select('match_id, home_goals, away_goals, winner_id, competition_id')
  .eq('user_id', userId)
  .gte('match_id', 73)
  .order('match_id');

if (e2) { console.log('preds error:', e2); process.exit(1); }

console.log('\nAll knockout predictions:');
preds.forEach(p => {
  const stage = p.match_id <= 88 ? 'R32' : p.match_id <= 96 ? 'R16' : p.match_id <= 100 ? 'QF' : p.match_id <= 102 ? 'SF' : p.match_id === 103 ? '3rd' : 'Final';
  const tie = p.home_goals === p.away_goals ? ' *** TIE - winner_id:' + p.winner_id : '';
  console.log(`  match ${p.match_id} ${stage} ${p.home_goals}-${p.away_goals}${tie}`);
});

const ties = preds.filter(p => p.home_goals === p.away_goals);
console.log(`\nTotal knockout ties missing winner_id: ${ties.filter(t => !t.winner_id).length} / ${ties.length}`);

// Also check ALL users for this issue
const { data: allKnockoutTies, error: e3 } = await supabase
  .from('predictions')
  .select('user_id, match_id, home_goals, away_goals, winner_id')
  .gte('match_id', 73)
  .is('winner_id', null);

if (!e3 && allKnockoutTies) {
  const knockoutTiesNoWinner = allKnockoutTies.filter(p => p.home_goals === p.away_goals);
  const uniqueUsers = new Set(knockoutTiesNoWinner.map(p => p.user_id));
  console.log(`\nGlobal: ${knockoutTiesNoWinner.length} knockout ties with null winner_id across ${uniqueUsers.size} users`);
}
