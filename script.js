const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('current-score');
const comboEl = document.getElementById('combo-score');
const bambooScoreEl = document.getElementById('bamboo-score');
const comboPopup = document.getElementById('combo-popup');

// --- Web Audio Synthesizer ---
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playSound(type) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;

  if (type === 'jump') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.12);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    osc.start(now); osc.stop(now + 0.12);
  } else if (type === 'collect') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now); osc.stop(now + 0.2);
  } else if (type === 'golden') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(2093, now + 0.25);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    osc.start(now); osc.stop(now + 0.25);
  } else if (type === 'boost') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.4);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc.start(now); osc.stop(now + 0.4);
  } else if (type === 'hit') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    osc.start(now); osc.stop(now + 0.35);
  } else if (type === 'perfect') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(800, now + 0.06);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now); osc.stop(now + 0.15);
  }
}

// --- Game Variables ---
let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let runBamboo = 0;
let comboMultiplier = 1;
let perfectStreak = 0;
let screenShakeTimer = 0;
let screenShakeIntensity = 0;

let highScore = parseInt(localStorage.getItem('panda_high_score') || '0');

let gameSpeed = 5;
const initialSpeed = 5;
const maxSpeed = 26;
const acceleration = 0.004;
const groundY = 330;

let particles = [];
let floatingTexts = [];

// --- Juice Effects ---
function triggerScreenShake(duration = 10, intensity = 6) {
  screenShakeTimer = duration;
  screenShakeIntensity = intensity;
}

function addFloatingText(text, x, y, color = '#ffcc00') {
  floatingTexts.push({ text, x, y, color, vy: -2, life: 30, maxLife: 30 });
}

function triggerPopup(text) {
  comboPopup.textContent = text;
  comboPopup.classList.add('active');
  setTimeout(() => comboPopup.classList.remove('active'), 500);
}

function addParticles(x, y, color, count = 6, speedMult = 1) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 8 * speedMult,
      vy: (Math.random() - 0.5) * 8 * speedMult,
      size: Math.random() * 4 + 2,
      color, life: 25
    });
  }
}

// --- Player Object ---
const panda = {
  x: 80, y: groundY - 50,
  width: 32, height: 50,
  normalHeight: 50, duckHeight: 28,
  velocityY: 0, gravity: 0.65,
  jumpStrength: -14.5,
  pogoPhase: 0,
  isDucking: false, isGrounded: false,
  boostTimer: 0, magnetTimer: 0, invulnerableTimer: 0,

  reset() {
    this.y = groundY - this.normalHeight;
    this.velocityY = 0;
    this.height = this.normalHeight;
    this.isDucking = false;
    this.isGrounded = true;
    this.pogoPhase = 0;
    this.boostTimer = 0;
    this.magnetTimer = 0;
    this.invulnerableTimer = 0;
  },

  update() {
    if (this.boostTimer > 0) {
      this.boostTimer--;
      this.invulnerableTimer = 2;
      this.velocityY = -1;
      addParticles(this.x, this.y + this.height, '#ff9900', 3);
    } else {
      this.velocityY += this.gravity;
    }

    if (this.magnetTimer > 0) this.magnetTimer--;

    if (this.isDucking && this.boostTimer <= 0) {
      this.height = this.duckHeight;
      if (!this.isGrounded) this.velocityY += 1.8; // Slam down
    } else {
      this.height = this.normalHeight;
    }

    this.y += this.velocityY;
    if (this.y < 10) { this.y = 10; this.velocityY = 0; }

    if (this.y + this.height >= groundY) {
      if (!this.isGrounded && this.velocityY > 10) {
        triggerScreenShake(6, 4);
        addParticles(this.x + 16, groundY, '#74c69d', 10);
      }
      this.y = groundY - this.height;
      this.velocityY = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    if (this.isGrounded && this.boostTimer <= 0) {
      this.pogoPhase += 0.25 + (gameSpeed - initialSpeed) * 0.02;
      if (Math.sin(this.pogoPhase) < -0.8) {
        this.velocityY = -3.5 - (gameSpeed - initialSpeed) * 0.15;
      }
    }

    if (this.invulnerableTimer > 0) this.invulnerableTimer--;
  },

  jump() {
    if (this.isGrounded || this.y + this.height >= groundY - 14) {
      this.velocityY = this.jumpStrength;
      this.isGrounded = false;
      playSound('jump');
      addParticles(this.x + 16, groundY, '#ffffff', 8);
    }
  },

  activateBoost() {
    if (runBamboo >= 5 && this.boostTimer <= 0) {
      runBamboo -= 5;
      bambooScoreEl.textContent = `${runBamboo} 🎋`;
      this.boostTimer = 90;
      playSound('boost');
      triggerScreenShake(14, 9);
      addParticles(this.x, this.y, '#00ffff', 22);
      addFloatingText('HYPER BOOST! 🚀', this.x, this.y - 20, '#00ffff');
    }
  },

  activateMagnet() {
    if (runBamboo >= 3 && this.magnetTimer <= 0) {
      runBamboo -= 3;
      bambooScoreEl.textContent = `${runBamboo} 🎋`;
      this.magnetTimer = 350;
      playSound('boost');
      addFloatingText('MAGNET 🧲', this.x, this.y - 20, '#ff00ff');
    }
  },

  draw() {
    ctx.save();
    
    // Aura effects
    if (this.magnetTimer > 0) {
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 45, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.boostTimer > 0) {
      ctx.fillStyle = 'rgba(255, 200, 0, 0.45)';
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pogo Stick
    ctx.fillStyle = '#888888';
    ctx.fillRect(this.x + this.width / 2 - 2, this.y + this.height - 20, 4, 20);
    ctx.fillStyle = this.boostTimer > 0 ? '#ffaa00' : '#ff4444';
    ctx.fillRect(this.x + this.width / 2 - 8, this.y + this.height - 4, 16, 4);

    // Panda Body
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(this.x + this.width / 2, this.y + 24, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ears
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(this.x + 6, this.y + 8, 5, 0, Math.PI * 2);
    ctx.arc(this.x + this.width - 6, this.y + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes / Visor
    if (this.boostTimer > 0) {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(this.x + 6, this.y + 13, 20, 5);
    } else {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(this.x + 10, this.y + 16, 4, 5, -0.2, 0, Math.PI * 2);
      ctx.ellipse(this.x + 22, this.y + 16, 4, 5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 10, this.y + 15, 2, 2);
      ctx.fillRect(this.x + 22, this.y + 15, 2, 2);
    }

    ctx.restore();
  }
};

// --- Collectibles ---
let bamboos = [];
class BambooCollectible {
  constructor() {
    this.x = canvas.width;
    this.y = groundY - 50 - Math.random() * 90;
    this.width = 18; this.height = 24;
    this.collected = false;
    this.isGolden = Math.random() < 0.18;
  }
  update() {
    if (panda.magnetTimer > 0 && !this.collected) {
      const dx = (panda.x + panda.width / 2) - (this.x + this.width / 2);
      const dy = (panda.y + panda.height / 2) - (this.y + this.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist < 240) {
        this.x += (dx / dist) * 10;
        this.y += (dy / dist) * 10;
      } else {
        this.x -= gameSpeed;
      }
    } else {
      this.x -= gameSpeed;
    }
  }
  draw() {
    if (this.collected) return;
    ctx.fillStyle = this.isGolden ? '#ffd700' : '#52b788';
    ctx.fillRect(this.x + 4, this.y, 8, this.height);
    ctx.fillStyle = this.isGolden ? '#fff066' : '#74c69d';
    ctx.beginPath();
    ctx.ellipse(this.x + 2, this.y + 6, 6, 3, -0.5, 0, Math.PI * 2);
    ctx.ellipse(this.x + 14, this.y + 14, 6, 3, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Obstacles ---
let obstacles = [];
let spawnTimer = 0;
let nextSpawnTime = 95;

class Obstacle {
  constructor(type) {
    this.type = type;
    this.markedForDeletion = false;
    this.dodged = false;

    if (type === 'PIT') {
      this.width = 75 + Math.min(80, (gameSpeed - initialSpeed) * 5);
      this.height = 70;
      this.x = canvas.width;
      this.y = groundY;
    } else if (type === 'HUT') {
      this.width = 45;
      this.height = 55 + (Math.random() > 0.4 ? 18 : 0);
      this.x = canvas.width;
      this.y = groundY - this.height;
    } else if (type === 'BRANCH') {
      this.width = 65;
      this.height = 22;
      this.x = canvas.width;
      this.y = groundY - 70;
    }
  }

  update() {
    this.x -= gameSpeed;

    if (!this.dodged && this.x + this.width < panda.x) {
      this.dodged = true;
      perfectStreak++;
      comboMultiplier = Math.min(6, 1 + Math.floor(perfectStreak / 3));
      comboEl.textContent = `x${comboMultiplier}`;
      playSound('perfect');

      const bonus = 60 * comboMultiplier;
      score += bonus;
      addFloatingText(`PERFECT +${bonus}`, panda.x + 15, panda.y - 15, '#00ffcc');

      if (perfectStreak % 4 === 0) {
        triggerPopup(`${comboMultiplier}x COMBO! 🔥`);
      }
    }

    if (this.x + this.width < 0) this.markedForDeletion = true;
  }

  draw() {
    if (this.type === 'PIT') {
      ctx.fillStyle = '#0a1416';
      ctx.fillRect(this.x, groundY, this.width, canvas.height - groundY);
      ctx.fillStyle = '#221100';
      ctx.fillRect(this.x, groundY + 45, this.width, canvas.height - groundY - 45);
    } else if (this.type === 'HUT') {
      ctx.fillStyle = '#8b4513';
      ctx.fillRect(this.x, this.y + 15, this.width, this.height - 15);
      ctx.fillStyle = '#5c2c06';
      ctx.beginPath();
      ctx.moveTo(this.x - 5, this.y + 15);
      ctx.lineTo(this.x + this.width / 2, this.y);
      ctx.lineTo(this.x + this.width + 5, this.y + 15);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'BRANCH') {
      ctx.fillStyle = '#1b4332';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = '#40916c';
      ctx.beginPath();
      ctx.arc(this.x + 15, this.y + this.height + 5, 8, 0, Math.PI);
      ctx.arc(this.x + 45, this.y + this.height + 5, 10, 0, Math.PI);
      ctx.fill();
    }
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

// Background
const backgroundTrees = [];
for (let i = 0; i < 15; i++) {
  backgroundTrees.push({ x: i * 60, width: 12 + Math.random() * 8, color: i % 2 === 0 ? '#2d6a4f' : '#40916c' });
}

function drawBackground() {
  ctx.fillStyle = '#091518';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  backgroundTrees.forEach(tree => {
    if (gameState === 'PLAYING') {
      tree.x -= gameSpeed * 0.3;
      if (tree.x + tree.width < 0) tree.x = canvas.width + Math.random() * 20;
    }
    ctx.fillStyle = tree.color;
    ctx.fillRect(tree.x, 0, tree.width, groundY);
  });

  if (gameSpeed > 18) {
    ctx.fillStyle = 'rgba(255, 0, 150, 0.08)';
    ctx.fillRect(0, 0, canvas.width, groundY);
  }

  ctx.fillStyle = '#2d6a4f';
  ctx.fillRect(0, groundY, canvas.width, 15);
  ctx.fillStyle = '#1b4332';
  ctx.fillRect(0, groundY + 15, canvas.width, canvas.height - groundY - 15);
}

// --- Input Handling ---
window.addEventListener('keydown', e => {
  initAudio();

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    if (gameState === 'PLAYING') {
      panda.jump();
    } else if (gameState === 'GAMEOVER' || gameState === 'START') {
      resetGame();
      gameState = 'PLAYING';
    }
  }
  if (e.code === 'ArrowDown' && gameState === 'PLAYING') panda.isDucking = true;
  if ((e.code === 'KeyF' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && gameState === 'PLAYING') panda.activateBoost();
  if (e.code === 'KeyE' && gameState === 'PLAYING') panda.activateMagnet();
});

window.addEventListener('keyup', e => {
  if (e.code === 'ArrowDown') panda.isDucking = false;
});

function spawnLogic() {
  spawnTimer++;
  if (spawnTimer > nextSpawnTime) {
    const types = ['PIT', 'HUT', 'BRANCH'];
    obstacles.push(new Obstacle(types[Math.floor(Math.random() * types.length)]));
    if (Math.random() > 0.3) bamboos.push(new BambooCollectible());

    spawnTimer = 0;
    nextSpawnTime = Math.max(30, Math.floor(Math.random() * 30) + Math.max(30, 90 - (gameSpeed - initialSpeed) * 5));
  }
}

function checkCollision(player, obs) {
  if (player.invulnerableTimer > 0) return false;
  const boxA = { x: player.x + 4, y: player.y, width: player.width - 8, height: player.height };
  const boxB = obs.getBounds();

  if (obs.type === 'PIT') {
    return (player.y + player.height >= groundY && player.x + player.width > boxB.x + 10 && player.x < boxB.x + boxB.width - 10);
  }
  return (boxA.x < boxB.x + boxB.width && boxA.x + boxA.width > boxB.x && boxA.y < boxB.y + boxB.height && boxA.y + boxA.height > boxB.y);
}

function resetGame() {
  score = 0;
  runBamboo = 0;
  comboMultiplier = 1;
  perfectStreak = 0;
  bambooScoreEl.textContent = '0 🎋';
  comboEl.textContent = 'x1';
  gameSpeed = initialSpeed;
  obstacles = []; bamboos = []; particles = []; floatingTexts = [];
  spawnTimer = 0;
  panda.reset();
}

// --- Render UI ---
function showUI() {
  if (gameState === 'START') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#76c893';
    ctx.font = 'bold 32px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('PANDA-POGO 🐼⚡', canvas.width / 2, canvas.height / 2 - 45);

    ctx.font = '14px "Courier New"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Press SPACE or UP ARROW to Start!', canvas.width / 2, canvas.height / 2 + 10);
    
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('Collect 5 🎋 for Boost (F) | 3 🎋 for Magnet (E)', canvas.width / 2, canvas.height / 2 + 45);

  } else if (gameState === 'GAMEOVER') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 34px "Courier New"';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER 💥', canvas.width / 2, canvas.height / 2 - 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Courier New"';
    ctx.fillText(`Score: ${Math.floor(score)} | High Score: ${Math.floor(highScore)}`, canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = '#74c69d';
    ctx.fillText('Press SPACE to Play Again!', canvas.width / 2, canvas.height / 2 + 55);
  }
}

// --- Main Loop ---
function gameLoop() {
  ctx.save();

  if (screenShakeTimer > 0) {
    screenShakeTimer--;
    ctx.translate((Math.random() - 0.5) * screenShakeIntensity, (Math.random() - 0.5) * screenShakeIntensity);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  if (gameState === 'PLAYING') {
    gameSpeed = Math.min(maxSpeed, gameSpeed + acceleration);
    score += (gameSpeed * 0.06) * comboMultiplier;
    scoreEl.textContent = Math.floor(score);

    if (score > highScore) {
      highScore = score;
      localStorage.setItem('panda_high_score', highScore);
    }

    panda.update();
    panda.draw();
    spawnLogic();

    // Bamboo Logic
    for (let i = bamboos.length - 1; i >= 0; i--) {
      const b = bamboos[i];
      b.update();
      b.draw();

      if (!b.collected && panda.x < b.x + b.width && panda.x + panda.width > b.x && panda.y < b.y + b.height && panda.y + panda.height > b.y) {
        b.collected = true;
        const count = b.isGolden ? 3 : 1;
        runBamboo += count;
        bambooScoreEl.textContent = `${runBamboo} 🎋`;

        if (b.isGolden) {
          playSound('golden');
          addFloatingText('+3 GOLDEN! 🌟', b.x, b.y, '#ffd700');
          addParticles(b.x, b.y, '#ffd700', 14);
        } else {
          playSound('collect');
          addFloatingText('+1 🎋', b.x, b.y, '#52b788');
          addParticles(b.x, b.y, '#52b788', 6);
        }
      }
      if (b.x + b.width < 0 || b.collected) bamboos.splice(i, 1);
    }

    // Obstacles Logic
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.update();
      obs.draw();

      if (checkCollision(panda, obs)) {
        playSound('hit');
        triggerScreenShake(20, 14);
        addParticles(panda.x + 16, panda.y + 25, '#ff2222', 25, 2);
        gameState = 'GAMEOVER';
      }
      if (obs.markedForDeletion) obstacles.splice(i, 1);
    }

    // Update Particles/Text
    for (let i = particles.length - 1; i >= 0; i--) {
      let p = particles[i]; p.x += p.vx; p.y += p.vy; p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); });

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      let ft = floatingTexts[i]; ft.y += ft.vy; ft.life--;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
      ctx.save(); ctx.fillStyle = ft.color; ctx.globalAlpha = ft.life / ft.maxLife; ctx.font = 'bold 16px "Courier New"';
      ctx.fillText(ft.text, ft.x, ft.y); ctx.restore();
    }

  } else {
    panda.draw();
    obstacles.forEach(obs => obs.draw());
    bamboos.forEach(b => b.draw());
  }

  showUI();
  ctx.restore();
  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);