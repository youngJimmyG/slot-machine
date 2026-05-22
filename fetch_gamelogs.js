const https = require('https');
const fs = require('fs');
const players = require('./players.json');

const SEASON = '2024-25';
const delay = ms => new Promise(r => setTimeout(r, ms));

function fetchGameLog(playerId) {
  return new Promise((resolve, reject) => {
    const url = `https://stats.nba.com/stats/playergamelog?PlayerID=${playerId}&Season=${SEASON}&SeasonType=Regular%20Season`;
    const opts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Referer': 'https://www.nba.com/',
        'Accept': 'application/json'
      }
    };
    https.get(url, opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const headers = json.resultSets[0].headers;
          const rows = json.resultSets[0].rowSet;
          const dateIdx = headers.indexOf('GAME_DATE');
          const ptsIdx = headers.indexOf('PTS');
          const matchupIdx = headers.indexOf('MATCHUP');
          const wlIdx = headers.indexOf('WL');
          const games = rows.map(r => ({
            date: r[dateIdx],       // "MAR 15, 2025"
            pts: r[ptsIdx],
            matchup: r[matchupIdx], // "OKC vs. LAL"
            wl: r[wlIdx]
          }));
          resolve(games);
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const gameLogs = {};
  let done = 0;

  for (const player of players) {
    try {
      const games = await fetchGameLog(player.id);
      gameLogs[player.id] = games;
      done++;
      if (done % 10 === 0) console.log(`${done}/100 fetched...`);
      // Rate limit - NBA API is touchy
      await delay(600);
    } catch(e) {
      console.error(`Failed: ${player.name} (${player.id}): ${e.message}`);
      gameLogs[player.id] = [];
      done++;
      await delay(1000);
    }
  }

  fs.writeFileSync('gamelogs.json', JSON.stringify(gameLogs));
  const size = (fs.statSync('gamelogs.json').size / 1024).toFixed(0);
  console.log(`Done! gamelogs.json = ${size} KB`);
}

main();
