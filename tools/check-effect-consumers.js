const fs = require('fs');

// All profile keys and mod keys written by events
const profileKeys = ['leadership','mediaTrust','mediaPressure','coachTrust','staminaLoad','lockerRoomTrust','teamChemistry','injuryRiskBonus','formVariance','fame','businessValue','controversy','loyalty','fanSupport','legacyBonus','chinaPopularity'];
const modKeys = ['mediaPressure','formVariance','teamChemistry','injuryRiskBonus','staminaLoad','moraleBonus','chemistryBonus','fatigueBonus'];

const files = fs.readdirSync('assets/js').filter(f=>f.endsWith('.js')).map(f=>'assets/js/'+f);
files.push('nba-perfect-player.html');

function countUsages(key) {
  let reads = [];
  for (const f of files) {
    const s = fs.readFileSync(f,'utf8');
    const lines = s.split('\n');
    lines.forEach((l,i)=>{
      // read patterns: .key (property access) not inside addProfileDelta/addSeasonMod write calls
      if (l.includes("addProfileDelta('"+key+"'") || l.includes('addSeasonMod(\''+key+'\'')) return;
      if (l.includes('profile.'+key) || l.includes('profile["'+key+'"]') ||
          l.includes("profile['"+key+"']") ||
          l.includes('mods.'+key) || l.includes('mods["'+key+'"]') || l.includes("mods['"+key+"']") ||
          l.includes('nextSeasonMods.'+key) ||
          l.includes('m.'+key+')') || l.includes('p.'+key+')')) {
        // filter out writes like mods.key = or profile.key =
        if (/\.(?:nextSeasonMods|mods|profile)\s*\.\s*'+/.test(l)) return;
        reads.push(f.split('/').pop()+':'+(i+1));
      }
    });
  }
  return reads;
}

console.log('=== PROFILE KEYS (STATE.career.profile.*) ===');
for (const k of profileKeys) {
  const r = countUsages(k);
  console.log(k + ': ' + (r.length ? r.length + ' read sites → e.g. ' + r.slice(0,4).join(', ') : '*** NO READS FOUND ***'));
}
console.log('\n=== MOD KEYS (nextSeasonMods.*) ===');
for (const k of modKeys) {
  const r = countUsages(k);
  console.log(k + ': ' + (r.length ? r.length + ' read sites → e.g. ' + r.slice(0,4).join(', ') : '*** NO READS FOUND ***'));
}
