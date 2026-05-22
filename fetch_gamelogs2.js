const https = require('https');
const fs = require('fs');
const players = require('./players.json');
const playerIds = new Set(players.map(p => p.id));

// Fetch ALL league game logs in one big request
function fetchLeagueGameLog() {
  return new Promise((resolve, reject) => {
    const url = 'https://stats.nba.com/stats/leaguegamelog?Counter=0&DateFrom=&DateTo=&Direction=ASC&LeagueID=00&PlayerOrTeam=P&Season=2024-25&SeasonType=Regular%20Season&Sorter=DATE';
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.nba.com/stats/',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true'
      }
    };
    
    https.get(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch(e) {
          console.error('Parse error, first 200 chars:', data.slice(0, 200));
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching league game log...');
  const json = await fetchLeagueGameLog();
  
  const headers = json.resultSets[0].headers;
  const rows = json.resultSets[0].rowSet;
  
  console.log(`Total game entries: ${rows.length}`);
  console.log('Headers:', headers.join(', '));
  
  // Find indices
  const pidIdx = headers.indexOf('PLAYER_ID');
  const dateIdx = headers.indexOf('GAME_DATE');
  const ptsIdx = headers.indexOf('PTS');
  const matchupIdx = headers.indexOf('MATCHUP');
  const wlIdx = headers.indexOf('WL');
  
  // Group by player, only keep our top 100
  const gameLogs = {};
  let kept = 0;
  
  for (const row of rows) {
    const pid = row[pidIdx];
    if (!playerIds.has(pid)) continue;
    
    if (!gameLogs[pid]) gameLogs[pid] = [];
    gameLogs[pid].push({
      date: row[dateIdx],      // "2025-01-15"
      pts: row[ptsIdx],
      matchup: row[matchupIdx],
      wl: row[wlIdx]
    });
    kept++;
  }
  
  const playersWithGames = Object.keys(gameLogs).length;
  console.log(`Kept ${kept} game entries for ${playersWithGames} of our 100 players`);
  
  // Save as JS
  const jsContent = 'const GAME_LOGS = ' + JSON.stringify(gameLogs) + ';';
  fs.writeFileSync('gamelogs.js', jsContent);
  
  const size = (fs.statSync('gamelogs.js').size / 1024).toFixed(0);
  console.log(`gamelogs.js = ${size} KB`);
  
  // Sanity check - SGA
  if (gameLogs[1628983]) {
    console.log(`SGA games: ${gameLogs[1628983].length}`);
    console.log('First:', gameLogs[1628983][0]);
    console.log('Last:', gameLogs[1628983][gameLogs[1628983].length-1]);
  }
}

main().catch(e => console.error(e));
