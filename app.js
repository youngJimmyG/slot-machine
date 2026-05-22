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
}

// ─── Event listeners ───
spinBtn.addEventListener('click', spin);
respinBtn.addEventListener('click', respin);

// ─── Init ───
initReels();
