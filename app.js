// ─── State ───
let currentPicks = [];     // 6 selected players
let respinAvailable = false;
let respinUsed = false;
let isSpinning = false;
let selectingRespin = false;
let selectedForRespin = new Set(); // slot indices to respin

const SLOT_COUNT = 6;
const REEL_SPIN_ITEMS = 20;       // how many items fly by during spin
const BASE_SPIN_MS = 1800;        // base spin duration
const STAGGER_MS = 300;           // extra ms per slot

const spinBtn = document.getElementById('spin-btn');
const respinBtn = document.getElementById('respin-btn');
const instructions = document.getElementById('instructions');
const battleSection = document.getElementById('battle-section');
const battleBtn = document.getElementById('battle-btn');
const battleResult = document.getElementById('battle-result');

// ─── Init reels with random faces ───
function initReels() {
  for (let i = 0; i < SLOT_COUNT; i++) {
    const reel = document.querySelector(`#slot-${i} .reel`);
    reel.innerHTML = '';
    const p = PLAYERS[Math.floor(Math.random() * PLAYERS.length)];
    reel.appendChild(makeReelItem(p));
    reel.style.top = '0px';
  }
}

function makeReelItem(player) {
  const div = document.createElement('div');
  div.className = 'reel-item';
  div.innerHTML = `
    <img src="${player.headshot}" alt="${player.name}" loading="lazy"
         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%2276%22><rect fill=%22%231a1a2e%22 width=%22100%22 height=%2276%22/><text x=%2250%22 y=%2242%22 fill=%22%23555%22 text-anchor=%22middle%22 font-size=%2212%22>?</text></svg>'">
    <div class="player-name">${player.name}</div>
    <div class="player-info">${player.team} &bull; ${player.ppg} PPG</div>
  `;
  return div;
}

// ─── Pick N unique random players ───
function pickUnique(n, exclude = []) {
  const excludeIds = new Set(exclude.map(p => p.id));
  const pool = PLAYERS.filter(p => !excludeIds.has(p.id));
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// ─── Spin animation for one slot ───
function spinSlot(slotIdx, finalPlayer, duration) {
  return new Promise(resolve => {
    const slotEl = document.getElementById(`slot-${slotIdx}`);
    const reel = slotEl.querySelector('.reel');
    const slotHeight = slotEl.offsetHeight;

    // Build reel: random players + final player at end
    reel.innerHTML = '';
    const flybyCount = REEL_SPIN_ITEMS + Math.floor(Math.random() * 5);
    for (let i = 0; i < flybyCount; i++) {
      reel.appendChild(makeReelItem(PLAYERS[Math.floor(Math.random() * PLAYERS.length)]));
    }
    reel.appendChild(makeReelItem(finalPlayer));

    // Position at top
    reel.style.transition = 'none';
    reel.style.top = '0px';

    slotEl.classList.add('spinning');
    slotEl.classList.remove('landed', 'locked', 'selectable', 'selected');

    // Force reflow
    reel.offsetHeight;

    // Animate to final position
    const finalTop = -(flybyCount * slotHeight);
    reel.style.transition = `top ${duration}ms cubic-bezier(0.15, 0.85, 0.35, 1)`;
    reel.style.top = `${finalTop}px`;

    setTimeout(() => {
      slotEl.classList.remove('spinning');
      slotEl.classList.add('landed');
      resolve();
    }, duration);
  });
}

// ─── Full spin ───
async function spin() {
  if (isSpinning) return;
  isSpinning = true;
  respinAvailable = false;
  respinUsed = false;
  selectingRespin = false;
  selectedForRespin.clear();

  spinBtn.disabled = true;
  respinBtn.disabled = true;
  respinBtn.textContent = '🔄 RESPIN UNLOCKED';
  instructions.textContent = 'Drafting teams...';

  // Clear states
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    slotEl.classList.remove('locked', 'selectable', 'selected');
  }

  // Pick 6 unique players
  currentPicks = pickUnique(6);

  // Spin all slots with stagger
  const promises = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const duration = BASE_SPIN_MS + (i * STAGGER_MS);
    promises.push(spinSlot(i, currentPicks[i], duration));
  }

  await Promise.all(promises);

  isSpinning = false;
  spinBtn.disabled = false;
  respinAvailable = true;
  respinBtn.disabled = false;
  instructions.textContent = 'Click players to respin, or SPIN for all new teams';

  // Show battle section
  showBattle();
  battleBtn.textContent = '⚔️ BATTLE';

  // Enable respin selection
  enableRespinSelection();
}

// ─── Respin logic ───
function enableRespinSelection() {
  selectingRespin = true;
  for (let i = 0; i < SLOT_COUNT; i++) {
    const slotEl = document.getElementById(`slot-${i}`);
    slotEl.classList.add('selectable');
    slotEl.onclick = () => toggleSlotForRespin(i);
  }
}

function toggleSlotForRespin(idx) {
  if (!selectingRespin || isSpinning) return;

  const slotEl = document.getElementById(`slot-${idx}`);

  if (selectedForRespin.has(idx)) {
    selectedForRespin.delete(idx);
    slotEl.classList.remove('selected');
    slotEl.classList.add('selectable');
  } else {
    selectedForRespin.add(idx);
    slotEl.classList.add('selected');
    slotEl.classList.remove('selectable');
  }

  // Update non-selected as locked preview
  for (let i = 0; i < SLOT_COUNT; i++) {
    const el = document.getElementById(`slot-${i}`);
    if (!selectedForRespin.has(i) && selectedForRespin.size > 0) {
      el.classList.add('locked');
      el.classList.remove('selectable');
    } else if (!selectedForRespin.has(i)) {
      el.classList.remove('locked');
      el.classList.add('selectable');
    }
  }

  // Update respin button
  if (selectedForRespin.size > 0) {
    respinBtn.textContent = `🔄 RESPIN ${selectedForRespin.size} PLAYER${selectedForRespin.size > 1 ? 'S' : ''}`;
  } else {
    respinBtn.textContent = '🔄 RESPIN UNLOCKED';
  }
}

async function respin() {
  if (isSpinning || !respinAvailable || selectedForRespin.size === 0) return;

  isSpinning = true;
  respinAvailable = false;
  selectingRespin = false;
  spinBtn.disabled = true;
  respinBtn.disabled = true;
  instructions.textContent = 'Respinning...';

  // Disable click handlers
  for (let i = 0; i < SLOT_COUNT; i++) {
    document.getElementById(`slot-${i}`).onclick = null;
    document.getElementById(`slot-${i}`).classList.remove('selectable');
  }

  // Pick new players for selected slots (exclude locked players)
  const lockedPlayers = currentPicks.filter((_, i) => !selectedForRespin.has(i));
  const newPlayers = pickUnique(selectedForRespin.size, lockedPlayers);

  let newIdx = 0;
  const promises = [];
  const slotsToRespin = [...selectedForRespin].sort();

  for (const slotIdx of slotsToRespin) {
    const newPlayer = newPlayers[newIdx++];
    currentPicks[slotIdx] = newPlayer;

    const el = document.getElementById(`slot-${slotIdx}`);
    el.classList.remove('selected');

    const duration = BASE_SPIN_MS + (slotsToRespin.indexOf(slotIdx) * STAGGER_MS);
    promises.push(spinSlot(slotIdx, newPlayer, duration));
  }

  await Promise.all(promises);

  selectedForRespin.clear();
  respinUsed = true;
  isSpinning = false;
  spinBtn.disabled = false;
  respinBtn.disabled = true;
  respinBtn.textContent = '🔄 RESPIN USED';
  instructions.textContent = 'Final teams set! Hit SPIN for a fresh draft';

  // Mark all as locked (final state)
  for (let i = 0; i < SLOT_COUNT; i++) {
    const el = document.getElementById(`slot-${i}`);
    el.classList.remove('selectable', 'selected');
    el.classList.add('locked');
    el.onclick = null;
  }

  // Keep battle section visible
  showBattle();
  battleBtn.textContent = '⚔️ BATTLE';
}

// ─── Battle System ───

// Season date range: Oct 22 2024 – Apr 13 2025
const SEASON_START = new Date('2024-10-22');
const SEASON_END = new Date('2025-04-13');

function showBattle() {
  battleSection.classList.remove('hidden');
  battleResult.classList.add('hidden');
  document.getElementById('winner-banner').classList.add('hidden');
}

function hideBattle() {
  battleSection.classList.add('hidden');
}

function randomSeasonDate() {
  const start = SEASON_START.getTime();
  const end = SEASON_END.getTime();
  const random = start + Math.random() * (end - start);
  return new Date(random);
}

function formatDate(d) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function findClosestGame(playerId, targetDate) {
  const games = GAME_LOGS[playerId];
  if (!games || games.length === 0) return null;

  const targetMs = targetDate.getTime();
  let closest = null;
  let closestDiff = Infinity;

  for (const game of games) {
    const gameDate = new Date(game.date);
    const diff = Math.abs(gameDate.getTime() - targetMs);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = game;
    }
  }
  return closest;
}

async function animateDateReveal(finalDate) {
  const el = document.getElementById('date-reveal');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  // Spin through random dates
  for (let i = 0; i < 20; i++) {
    const d = randomSeasonDate();
    el.innerHTML = `<span class="date-spinning">${formatDate(d)}</span>`;
    await sleep(60 + i * 8);
  }

  // Land on final date
  el.innerHTML = `<span class="date-final">📅 ${formatDate(finalDate)}</span>`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function animateScoreCard(card, pts) {
  card.classList.add('revealed');
  const ptsEl = card.querySelector('.score-card-pts');

  // Count up
  const duration = 600;
  const steps = 15;
  const stepTime = duration / steps;

  for (let i = 1; i <= steps; i++) {
    const val = Math.round((i / steps) * pts);
    ptsEl.textContent = val;
    ptsEl.classList.add('counting');
    await sleep(stepTime);
    ptsEl.classList.remove('counting');
  }
  ptsEl.textContent = pts;
}

function createScoreCard(player, game) {
  const card = document.createElement('div');
  card.className = 'score-card' + (game ? '' : ' no-game');

  const gameDate = game ? new Date(game.date) : null;
  const dateStr = gameDate ? formatDate(gameDate) : '';
  const wlClass = game ? (game.wl === 'W' ? 'win' : 'loss') : '';

  card.innerHTML = `
    <img src="${player.headshot}" alt="${player.name}"
         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2250%22 height=%2238%22><rect fill=%22%231a1a2e%22 width=%2250%22 height=%2238%22/></svg>'">
    <div class="score-card-info">
      <div class="score-card-name">${player.name}</div>
      <div class="score-card-matchup">
        ${game ? `${dateStr} &bull; ${game.matchup}` : 'No game found'}
        ${game ? `<span class="score-card-wl ${wlClass}">${game.wl}</span>` : ''}
      </div>
    </div>
    <div class="score-card-pts">${game ? '0' : 'DNP'}</div>
  `;
  return card;
}

async function battle() {
  if (currentPicks.length !== 6) {
    instructions.textContent = 'Spin first to draft teams!';
    return;
  }

  battleBtn.disabled = true;
  battleResult.classList.remove('hidden');

  // Clear previous
  document.getElementById('score-cards-a').innerHTML = '';
  document.getElementById('score-cards-b').innerHTML = '';
  document.getElementById('score-total-a').textContent = '0';
  document.getElementById('score-total-b').textContent = '0';

  // Random date
  const targetDate = randomSeasonDate();
  await animateDateReveal(targetDate);
  await sleep(500);

  // Find closest games for each player
  const teamAPlayers = currentPicks.slice(0, 3);
  const teamBPlayers = currentPicks.slice(3, 6);

  const teamAGames = teamAPlayers.map(p => findClosestGame(p.id, targetDate));
  const teamBGames = teamBPlayers.map(p => findClosestGame(p.id, targetDate));

  // Build score cards
  const cardsA = document.getElementById('score-cards-a');
  const cardsB = document.getElementById('score-cards-b');

  const cardElsA = [];
  const cardElsB = [];

  for (let i = 0; i < 3; i++) {
    const cardA = createScoreCard(teamAPlayers[i], teamAGames[i]);
    cardsA.appendChild(cardA);
    cardElsA.push({ el: cardA, pts: teamAGames[i]?.pts || 0 });

    const cardB = createScoreCard(teamBPlayers[i], teamBGames[i]);
    cardsB.appendChild(cardB);
    cardElsB.push({ el: cardB, pts: teamBGames[i]?.pts || 0 });
  }

  // Animate reveals one by one, alternating teams
  let totalA = 0, totalB = 0;

  for (let i = 0; i < 3; i++) {
    // Team A player
    await animateScoreCard(cardElsA[i].el, cardElsA[i].pts);
    totalA += cardElsA[i].pts;
    document.getElementById('score-total-a').textContent = totalA;
    await sleep(300);

    // Team B player
    await animateScoreCard(cardElsB[i].el, cardElsB[i].pts);
    totalB += cardElsB[i].pts;
    document.getElementById('score-total-b').textContent = totalB;
    await sleep(300);
  }

  // Scroll to results
  battleSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

  // Winner
  await sleep(500);
  const banner = document.getElementById('winner-banner');
  banner.className = 'winner-banner';

  if (totalA > totalB) {
    banner.textContent = '🏆 TEAM A WINS';
    banner.classList.add('team-a-wins');
  } else if (totalB > totalA) {
    banner.textContent = '🏆 TEAM B WINS';
    banner.classList.add('team-b-wins');
  } else {
    banner.textContent = '🤝 TIE GAME';
    banner.classList.add('tie');
  }
  banner.classList.remove('hidden');

  // Re-enable for another battle with same teams
  battleBtn.disabled = false;
  battleBtn.textContent = '⚔️ BATTLE AGAIN';
  instructions.textContent = 'Play again or SPIN for new teams';
}

// ─── Event listeners ───
spinBtn.addEventListener('click', spin);
respinBtn.addEventListener('click', respin);
battleBtn.addEventListener('click', battle);

// ─── Init ───
initReels();
