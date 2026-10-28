// --- AUDIO SYSTEM (Web Audio API Synthesizer) ---
class SoundController {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playHit(type) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'smash') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'lob') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else { // Drop / Normal Hit
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }

    playWhistle() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, now);
        osc.frequency.setValueAtTime(2200, now + 0.08);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

const audio = new SoundController();

// --- GAME STATE & CONSTANTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 480;
const GROUND_Y = 400;
const NET_X = CANVAS_WIDTH / 2;
const NET_HEIGHT = 110;
const GRAVITY = 0.35;

let gameMode = 'AI'; // 'AI' or '2P'
let targetScore = 11;
let scoreP1 = 0;
let scoreP2 = 0;
let isPlaying = false;
let isServing = true;
let server = 1; // 1 = P1, 2 = P2/AI
let particles = [];

// Keys Tracking
const keys = {};

window.addEventListener('keydown', (e) => {
    audio.init();
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// --- PLAYER CLASS ---
class Player {
    constructor(id, x, color) {
        this.id = id;
        this.startX = x;
        this.x = x;
        this.y = GROUND_Y - 70;
        this.width = 24;
        this.height = 70;
        this.vx = 0;
        this.vy = 0;
        this.speed = 5;
        this.jumpForce = -10.5;
        this.isGrounded = false;
        this.color = color;
        this.racketAngle = 0;
        this.swinging = false;
        this.swingTimer = 0;
    }

    reset() {
        this.x = this.startX;
        this.y = GROUND_Y - this.height;
        this.vx = 0;
        this.vy = 0;
        this.racketAngle = 0;
        this.swinging = false;
    }

    update() {
        // Apply Gravity
        this.vy += GRAVITY;
        this.y += this.vy;
        this.x += this.vx;

        // Ground Collision
        if (this.y >= GROUND_Y - this.height) {
            this.y = GROUND_Y - this.height;
            this.vy = 0;
            this.isGrounded = true;
        } else {
            this.isGrounded = false;
        }

        // Court Boundary Constraints
        if (this.id === 1) {
            if (this.x < 30) this.x = 30;
            if (this.x > NET_X - this.width - 10) this.x = NET_X - this.width - 10;
        } else {
            if (this.x < NET_X + 10) this.x = NET_X + 10;
            if (this.x > CANVAS_WIDTH - 30 - this.width) this.x = CANVAS_WIDTH - 30 - this.width;
        }

        // Handle Racket Swing Animation
        if (this.swinging) {
            this.swingTimer += 0.2;
            this.racketAngle = Math.sin(this.swingTimer) * (this.id === 1 ? 1.5 : -1.5);
            if (this.swingTimer >= Math.PI) {
                this.swinging = false;
                this.swingTimer = 0;
                this.racketAngle = 0;
            }
        }
    }

    swing() {
        if (!this.swinging) {
            this.swinging = true;
            this.swingTimer = 0;
        }
    }

    draw() {
        // Draw Body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 8);
        ctx.fill();

        // Draw Head / Cap
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y - 10, 12, 0, Math.PI * 2);
        ctx.fill();

        // Draw Racket
        ctx.save();
        const handX = this.id === 1 ? this.x + this.width : this.x;
        const handY = this.y + 25;
        ctx.translate(handX, handY);
        ctx.rotate(this.racketAngle);

        // Shaft
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const dir = this.id === 1 ? 1 : -1;
        ctx.lineTo(25 * dir, -25);
        ctx.stroke();

        // Head
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(32 * dir, -32, 12, 16, Math.PI / 4 * dir, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// --- SHUTTLECOCK CLASS ---
class Shuttlecock {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 200;
        this.y = 200;
        this.vx = 0;
        this.vy = 0;
        this.radius = 6;
        this.drag = 0.988; // Air resistance
        this.angle = 0;
        this.lastHitter = null;
    }

    update() {
        this.vy += GRAVITY * 0.65; // Lighter gravity for shuttlecock
        this.vx *= this.drag;
        this.vy *= this.drag;

        this.x += this.vx;
        this.y += this.vy;

        // Angle based on velocity trajectory
        this.angle = Math.atan2(this.vy, this.vx);

        // Net Collision
        if (Math.abs(this.x - NET_X) < this.radius + 3 && this.y > GROUND_Y - NET_HEIGHT) {
            this.vx = -this.vx * 0.4;
            if (this.x < NET_X) this.x = NET_X - this.radius - 4;
            else this.x = NET_X + this.radius + 4;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Shuttlecock Feathers (White cone)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-8, -6);
        ctx.lineTo(-8, 6);
        ctx.closePath();
        ctx.fill();

        // Shuttlecock Cork (Red Base)
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(6, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Speed Trail Effect for High Speed Hits
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > 12) {
            particles.push({
                x: this.x,
                y: this.y,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                life: 1.0,
                color: '#38bdf8'
            });
        }
    }
}

// --- INSTANTIATE OBJECTS ---
const player1 = new Player(1, 150, '#0284c7');
const player2 = new Player(2, 720, '#f43f5e');
const shuttle = new Shuttlecock();

// --- AI LOGIC ---
function updateAI() {
    if (gameMode !== 'AI' || isServing) return;

    const targetX = shuttle.x + 40;
    const distanceToShuttle = shuttle.x - player2.x;

    // AI Movement
    if (shuttle.x > NET_X) {
        if (player2.x < targetX - 10) player2.vx = player2.speed * 0.85;
        else if (player2.x > targetX + 10) player2.vx = -player2.speed * 0.85;
        else player2.vx = 0;
    } else {
        // Return to center position when shuttle is on player side
        const homeX = 700;
        if (player2.x < homeX - 10) player2.vx = player2.speed * 0.6;
        else if (player2.x > homeX + 10) player2.vx = -player2.speed * 0.6;
        else player2.vx = 0;
    }

    // AI Shot Decision
    const dist = Math.hypot(shuttle.x - player2.x, shuttle.y - player2.y);
    if (dist < 65 && shuttle.x > NET_X) {
        // Jump if shuttle is high
        if (shuttle.y < player2.y - 10 && player2.isGrounded && Math.random() < 0.6) {
            player2.vy = player2.jumpForce;
        }

        // Random Shot Type Decision
        const rand = Math.random();
        if (shuttle.y < player2.y - 20 && rand < 0.45) {
            executeHit(player2, 'smash');
        } else if (rand < 0.8) {
            executeHit(player2, 'lob');
        } else {
            executeHit(player2, 'drop');
        }
    }
}

// --- SHOT EXECUTION ---
function executeHit(player, type) {
    const dist = Math.hypot(shuttle.x - (player.x + player.width / 2), shuttle.y - player.y);
    if (dist > 75) return; // Out of reach

    player.swing();
    shuttle.lastHitter = player.id;
    audio.playHit(type);

    // Particle Burst on Hit
    for (let i = 0; i < 8; i++) {
        particles.push({
            x: shuttle.x,
            y: shuttle.y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            life: 1.0,
            color: type === 'smash' ? '#f59e0b' : '#ffffff'
        });
    }

    const dir = player.id === 1 ? 1 : -1;

    if (type === 'lob') {
        shuttle.vx = dir * (11 + Math.random() * 2);
        shuttle.vy = -13 - Math.random() * 2;
    } else if (type === 'smash') {
        shuttle.vx = dir * (17 + Math.random() * 3);
        shuttle.vy = 6 + Math.random() * 2;
    } else if (type === 'drop') {
        shuttle.vx = dir * (5 + Math.random() * 2);
        shuttle.vy = -4;
    }
}

// --- PROCESS CONTROLS ---
function processInput() {
    // Player 1
    if (keys['a'] || keys['A']) player1.vx = -player1.speed;
    else if (keys['d'] || keys['D']) player1.vx = player1.speed;
    else player1.vx = 0;

    if ((keys['w'] || keys['W']) && player1.isGrounded) {
        player1.vy = player1.jumpForce;
    }

    if (keys['j'] || keys['J']) { executeHit(player1, 'lob'); keys['j'] = false; keys['J'] = false; }
    if (keys['k'] || keys['K']) { executeHit(player1, 'smash'); keys['k'] = false; keys['K'] = false; }
    if (keys['l'] || keys['L']) { executeHit(player1, 'drop'); keys['l'] = false; keys['L'] = false; }

    // Player 2 (If in 2P Mode)
    if (gameMode === '2P') {
        if (keys['ArrowLeft']) player2.vx = -player2.speed;
        else if (keys['ArrowRight']) player2.vx = player2.speed;
        else player2.vx = 0;

        if (keys['ArrowUp'] && player2.isGrounded) {
            player2.vy = player2.jumpForce;
        }

        if (keys['1']) { executeHit(player2, 'lob'); keys['1'] = false; }
        if (keys['2']) { executeHit(player2, 'smash'); keys['2'] = false; }
        if (keys['3']) { executeHit(player2, 'drop'); keys['3'] = false; }
    }
}

// --- SERVE SYSTEM ---
function handleServe() {
    if (!isServing) return;

    if (server === 1) {
        shuttle.x = player1.x + player1.width + 10;
        shuttle.y = player1.y + 20;
        shuttle.vx = 0;
        shuttle.vy = 0;

        if (keys['j'] || keys['k'] || keys['l'] || keys['J'] || keys['K'] || keys['L']) {
            isServing = false;
            executeHit(player1, 'lob');
        }
    } else {
        shuttle.x = player2.x - 10;
        shuttle.y = player2.y + 20;
        shuttle.vx = 0;
        shuttle.vy = 0;

        setTimeout(() => {
            if (isServing && server === 2) {
                isServing = false;
                executeHit(player2, 'lob');
            }
        }, 1000);
    }
}

// --- SCORING SYSTEM ---
function checkScoring() {
    if (isServing) return;

    // Check if Shuttlecock touches ground
    if (shuttle.y >= GROUND_Y - shuttle.radius) {
        audio.playWhistle();
        
        if (shuttle.x < NET_X) {
            // Point for Player 2 / AI
            scoreP2++;
            server = 2;
            document.getElementById('game-status').innerText = 'Mata untuk ' + (gameMode === 'AI' ? 'AI Lawan' : 'Pemain 2');
        } else {
            // Point for Player 1
            scoreP1++;
            server = 1;
            document.getElementById('game-status').innerText = 'Mata untuk Pemain 1';
        }

        updateScoreboard();
        checkMatchPoint();
        resetPositions();
    }
}

function updateScoreboard() {
    document.getElementById('score-p1').innerText = scoreP1;
    document.getElementById('score-p2').innerText = scoreP2;
}

function resetPositions() {
    player1.reset();
    player2.reset();
    shuttle.reset();
    isServing = true;
}

function checkMatchPoint() {
    if (scoreP1 >= targetScore || scoreP2 >= targetScore) {
        isPlaying = false;
        const winner = scoreP1 >= targetScore ? 'PEMAIN 1' : (gameMode === 'AI' ? 'AI LAWAN' : 'PEMAIN 2');
        document.getElementById('winner-text').innerText = `${winner} MENANG!`;
        document.getElementById('final-score-text').innerText = `Skor Akhir: ${scoreP1} - ${scoreP2}`;
        document.getElementById('gameover-overlay').classList.remove('hidden');
    }
}

// --- RENDER FUNCTIONS ---
function drawCourt() {
    // Sky/Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    bgGrad.addColorStop(0, '#0f172a');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Green Court Floor
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Court Lines (White)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.strokeRect(30, GROUND_Y, CANVAS_WIDTH - 60, 5);

    // Boundary Lines
    ctx.beginPath();
    ctx.moveTo(30, GROUND_Y); ctx.lineTo(30, GROUND_Y + 70);
    ctx.moveTo(CANVAS_WIDTH - 30, GROUND_Y); ctx.lineTo(CANVAS_WIDTH - 30, GROUND_Y + 70);
    ctx.stroke();

    // Badminton Net Post & Mesh
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(NET_X - 3, GROUND_Y - NET_HEIGHT, 6, NET_HEIGHT);

    // Net Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let y = GROUND_Y - NET_HEIGHT; y < GROUND_Y; y += 8) {
        ctx.beginPath();
        ctx.moveTo(NET_X - 3, y);
        ctx.lineTo(NET_X + 3, y);
        ctx.stroke();
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.04;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- MAIN GAME LOOP ---
function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    drawCourt();

    if (isPlaying) {
        processInput();
        updateAI();
        handleServe();

        player1.update();
        player2.update();
        if (!isServing) shuttle.update();

        checkScoring();
    }

    player1.draw();
    player2.draw();
    shuttle.draw();
    updateParticles();

    requestAnimationFrame(gameLoop);
}

// --- EVENT LISTENERS & UI HANDLERS ---
document.getElementById('btn-vs-ai').addEventListener('click', () => {
    gameMode = 'AI';
    document.getElementById('p2-label').innerText = 'AI LAWAN';
    startGame();
});

document.getElementById('btn-vs-player').addEventListener('click', () => {
    gameMode = '2P';
    document.getElementById('p2-label').innerText = 'PEMAIN 2';
    startGame();
});

document.getElementById('btn-score-11').addEventListener('click', (e) => {
    targetScore = 11;
    document.getElementById('target-score').innerText = '11';
    document.getElementById('btn-score-11').classList.add('active');
    document.getElementById('btn-score-21').classList.remove('active');
});

document.getElementById('btn-score-21').addEventListener('click', (e) => {
    targetScore = 21;
    document.getElementById('target-score').innerText = '21';
    document.getElementById('btn-score-21').classList.add('active');
    document.getElementById('btn-score-11').classList.remove('active');
});

document.getElementById('btn-restart').addEventListener('click', () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    startGame();
});

function startGame() {
    scoreP1 = 0;
    scoreP2 = 0;
    server = 1;
    updateScoreboard();
    resetPositions();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('game-status').innerText = 'Perlawanan Bermula';
    isPlaying = true;
    audio.playWhistle();
}

// Mobile Touch Control Setup
function setupTouchControls() {
    const bindTouch = (id, keyName) => {
        const btn = document.getElementById(id);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyName] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyName] = false; });
    };

    bindTouch('btn-touch-left', 'a');
    bindTouch('btn-touch-right', 'd');
    bindTouch('btn-touch-jump', 'w');
    bindTouch('btn-touch-lob', 'j');
    bindTouch('btn-touch-smash', 'k');
    bindTouch('btn-touch-drop', 'l');
}

setupTouchControls();

// Run Canvas Loop
requestAnimationFrame(gameLoop);
