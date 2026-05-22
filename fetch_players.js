const https = require('https');

const url = 'https://stats.nba.com/stats/leagueLeaders?LeagueID=00&PerMode=Totals&Scope=S&Season=2024-25&SeasonType=Regular%20Season&StatCategory=PTS&ActiveFlag=';

const options = {
  headers: {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.nba.com/',
    'Accept': 'application/json'
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const rows = json.resultSet.rowSet.slice(0, 100);
    const players = rows.map(r => ({
      id: r[0],
      rank: r[1],
      name: r[2],
      team: r[4],
      pts: r[24],
      ppg: (r[24] / r[5]).toFixed(1),
      headshot: `https://cdn.nba.com/headshots/nba/latest/1040x760/${r[0]}.png`
    }));
    require('fs').writeFileSync('players.json', JSON.stringify(players, null, 2));
    console.log(`Saved ${players.length} players`);
    console.log('Top 5:', players.slice(0,5).map(p => `${p.name} (${p.team}) - ${p.pts} pts`));
    console.log('Last 5:', players.slice(-5).map(p => `${p.name} (${p.team}) - ${p.pts} pts`));
  });
}).on('error', e => console.error(e));
