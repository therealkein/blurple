// ============================================================
// STACK GAME — Full 3D web recreation with polish
// ============================================================

(function () {
    "use strict";

    // ── YouTube Playables SDK ─────────────────────────────────
    const hasYTSDK = (typeof ytgame !== 'undefined') &&
        (typeof ytgame?.game?.firstFrameReady === 'function') &&
        (ytgame.IN_PLAYABLES_ENV === true || window.self !== window.top || location.hostname.includes('youtube') || location.hostname.includes('usercontent.goog'));

    let cloudLoadDone = !hasYTSDK;
    let audioMuted = false;

    // Interstitial ads
    let lastAdTime = Date.now();
    const AD_COOLDOWN_MS = 180000; // 180 seconds

    function tryShowInterstitial() {
        if (!hasYTSDK) return;
        const now = Date.now();
        if (now - lastAdTime < AD_COOLDOWN_MS) return;
        try {
            ytgame.ads.requestInterstitialAd();
            lastAdTime = now;
        } catch (_) {}
    }

    // Cloud save/load
    async function loadCloudSave() {
        if (!hasYTSDK) return null;
        try {
            const loadPromise = ytgame.game.loadData();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('loadData timeout')), 4000)
            );
            const data = await Promise.race([loadPromise, timeoutPromise]);
            if (data && data !== '') {
                try {
                    const cloudData = JSON.parse(data);
                    cloudLoadDone = true;
                    return cloudData;
                } catch (_) {}
            }
            cloudLoadDone = true;
            return null;
        } catch (e) {
            cloudLoadDone = true;
            try { ytgame.health.logError('loadData failed: ' + String(e)); } catch (_) {}
            return null;
        }
    }

    function saveToCloud() {
        if (!hasYTSDK || !cloudLoadDone) return;
        try {
            const saveObj = {
                coins, totalBlocks, totalGames, bestStreak, totalPerfects,
                bestScore, collectedObjectives, ownedThemes, activeTheme, lightMode,
            };
            const json = JSON.stringify(saveObj);
            const p = ytgame.game.saveData(json);
            if (p && typeof p.then === 'function') {
                p.then(() => {}, (e) => {
                    try { ytgame.health.logError('saveData failed: ' + String(e)); } catch (_) {}
                });
            }
        } catch (_) {}
    }

    function applyCloudData(data) {
        if (!data) return;
        if (data.coins !== undefined) coins = data.coins;
        if (data.totalBlocks !== undefined) totalBlocks = data.totalBlocks;
        if (data.totalGames !== undefined) totalGames = data.totalGames;
        if (data.bestStreak !== undefined) bestStreak = data.bestStreak;
        if (data.totalPerfects !== undefined) totalPerfects = data.totalPerfects;
        if (data.bestScore !== undefined) bestScore = data.bestScore;
        if (data.collectedObjectives !== undefined) collectedObjectives = data.collectedObjectives;
        if (data.ownedThemes !== undefined) ownedThemes = data.ownedThemes;
        if (data.activeTheme !== undefined) activeTheme = data.activeTheme;
        if (data.lightMode !== undefined) lightMode = data.lightMode;
    }

    function sendScoreToSDK(score) {
        if (!hasYTSDK) return;
        try {
            ytgame.engagement.sendScore({ value: score });
        } catch (_) {}
    }

    // ── Canvas & context ──────────────────────────────────────
    const canvas = document.getElementById("game-canvas");
    const ctx = canvas.getContext("2d");
    let W, H;

    const BASE_SCALE = 1.38;

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // In landscape, scale camera down so the stack fits
        try {
            if (ISO) {
                if (W > H) {
                    ISO.scale = BASE_SCALE * Math.min(1, H / 900);
                } else {
                    ISO.scale = BASE_SCALE * Math.min(1, W / 420);
                }
            }
        } catch (_) {}
    }
    window.addEventListener("resize", resize);
    resize();

    // ── Theme palettes ─────────────────────────────────────────
    const THEMES = [
        { id: "rainbow",    name: "Rainbow",    price: 0,   hueStart: 200, hueRange: 336, sat: 65, lit: 60 },
        { id: "sunset",     name: "Sunset",     price: 50,  hueStart: 0,   hueRange: 60,  sat: 70, lit: 58 },
        { id: "ocean",      name: "Ocean",      price: 50,  hueStart: 180, hueRange: 60,  sat: 65, lit: 55 },
        { id: "forest",     name: "Forest",     price: 75,  hueStart: 80,  hueRange: 80,  sat: 55, lit: 50 },
        { id: "neon",       name: "Neon",       price: 100, hueStart: 0,   hueRange: 336, sat: 90, lit: 55 },
        { id: "pastel",     name: "Pastel",     price: 100, hueStart: 0,   hueRange: 336, sat: 40, lit: 75 },
        { id: "candy",      name: "Candy",      price: 150, hueStart: 280, hueRange: 80,  sat: 70, lit: 62 },
        { id: "monochrome", name: "Mono",       price: 150, hueStart: 0,   hueRange: 360, sat: 0,  lit: 55 },
        { id: "gold",       name: "Gold",       price: 200, hueStart: 30,  hueRange: 25,  sat: 75, lit: 55 },
        { id: "galaxy",     name: "Galaxy",     price: 250, hueStart: 240, hueRange: 60,  sat: 65, lit: 40 },
        { id: "lava",       name: "Lava",       price: 75,  hueStart: 0,   hueRange: 30,  sat: 85, lit: 50 },
        { id: "arctic",     name: "Arctic",     price: 75,  hueStart: 190, hueRange: 30,  sat: 50, lit: 72 },
        { id: "cherry",     name: "Cherry",     price: 100, hueStart: 340, hueRange: 30,  sat: 75, lit: 55 },
        { id: "mint",       name: "Mint",       price: 100, hueStart: 140, hueRange: 40,  sat: 50, lit: 65 },
        { id: "toxic",      name: "Toxic",      price: 125, hueStart: 80,  hueRange: 40,  sat: 90, lit: 50 },
        { id: "coral",      name: "Coral",      price: 125, hueStart: 10,  hueRange: 30,  sat: 65, lit: 65 },
        { id: "midnight",   name: "Midnight",   price: 175, hueStart: 220, hueRange: 40,  sat: 60, lit: 35 },
        { id: "bubblegum",  name: "Bubblegum",  price: 175, hueStart: 300, hueRange: 50,  sat: 60, lit: 70 },
        { id: "autumn",     name: "Autumn",     price: 200, hueStart: 15,  hueRange: 45,  sat: 65, lit: 50 },
        { id: "cyber",      name: "Cyber",      price: 250, hueStart: 170, hueRange: 70,  sat: 85, lit: 50 },
        { id: "royal",      name: "Royal",      price: 300, hueStart: 250, hueRange: 30,  sat: 70, lit: 45 },
        { id: "diamond",    name: "Diamond",    price: 350, hueStart: 190, hueRange: 20,  sat: 30, lit: 80 },
        { id: "inferno",    name: "Inferno",    price: 400, hueStart: 0,   hueRange: 50,  sat: 95, lit: 45 },
        { id: "aurora",     name: "Aurora",     price: 500, hueStart: 100, hueRange: 160, sat: 70, lit: 55 },
    ];

    // ── Objectives ──────────────────────────────────────────────
    const OBJECTIVES = [
        { id: "blocks_50",     stat: "totalBlocks",   target: 50,    reward: 10,  desc: "Stack 50 blocks" },
        { id: "blocks_100",    stat: "totalBlocks",   target: 100,   reward: 20,  desc: "Stack 100 blocks" },
        { id: "blocks_200",    stat: "totalBlocks",   target: 200,   reward: 30,  desc: "Stack 200 blocks" },
        { id: "blocks_500",    stat: "totalBlocks",   target: 500,   reward: 50,  desc: "Stack 500 blocks" },
        { id: "blocks_1000",   stat: "totalBlocks",   target: 1000,  reward: 100, desc: "Stack 1000 blocks" },
        { id: "blocks_2500",   stat: "totalBlocks",   target: 2500,  reward: 150, desc: "Stack 2500 blocks" },
        { id: "blocks_5000",   stat: "totalBlocks",   target: 5000,  reward: 250, desc: "Stack 5000 blocks" },
        { id: "blocks_10000",  stat: "totalBlocks",   target: 10000, reward: 500, desc: "Stack 10,000 blocks" },
        { id: "score_10",      stat: "bestScore",     target: 10,    reward: 10,  desc: "Score 10 in one game" },
        { id: "score_25",      stat: "bestScore",     target: 25,    reward: 20,  desc: "Score 25 in one game" },
        { id: "score_50",      stat: "bestScore",     target: 50,    reward: 40,  desc: "Score 50 in one game" },
        { id: "score_100",     stat: "bestScore",     target: 100,   reward: 75,  desc: "Score 100 in one game" },
        { id: "score_200",     stat: "bestScore",     target: 200,   reward: 150, desc: "Score 200 in one game" },
        { id: "score_500",     stat: "bestScore",     target: 500,   reward: 400, desc: "Score 500 in one game" },
        { id: "streak_3",      stat: "bestStreak",    target: 3,     reward: 15,  desc: "Get a 3x perfect streak" },
        { id: "streak_5",      stat: "bestStreak",    target: 5,     reward: 30,  desc: "Get a 5x perfect streak" },
        { id: "streak_8",      stat: "bestStreak",    target: 8,     reward: 60,  desc: "Get an 8x perfect streak" },
        { id: "streak_12",     stat: "bestStreak",    target: 12,    reward: 100, desc: "Get a 12x perfect streak" },
        { id: "streak_20",     stat: "bestStreak",    target: 20,    reward: 200, desc: "Get a 20x perfect streak" },
        { id: "games_5",       stat: "totalGames",    target: 5,     reward: 10,  desc: "Play 5 games" },
        { id: "games_10",      stat: "totalGames",    target: 10,    reward: 20,  desc: "Play 10 games" },
        { id: "games_25",      stat: "totalGames",    target: 25,    reward: 40,  desc: "Play 25 games" },
        { id: "games_50",      stat: "totalGames",    target: 50,    reward: 75,  desc: "Play 50 games" },
        { id: "games_100",     stat: "totalGames",    target: 100,   reward: 150, desc: "Play 100 games" },
        { id: "games_500",     stat: "totalGames",    target: 500,   reward: 500, desc: "Play 500 games" },
        { id: "perfects_10",   stat: "totalPerfects", target: 10,    reward: 15,  desc: "Get 10 total perfects" },
        { id: "perfects_25",   stat: "totalPerfects", target: 25,    reward: 30,  desc: "Get 25 total perfects" },
        { id: "perfects_50",   stat: "totalPerfects", target: 50,    reward: 50,  desc: "Get 50 total perfects" },
        { id: "perfects_100",  stat: "totalPerfects", target: 100,   reward: 100, desc: "Get 100 total perfects" },
        { id: "perfects_250",  stat: "totalPerfects", target: 250,   reward: 200, desc: "Get 250 total perfects" },
        { id: "perfects_500",  stat: "totalPerfects", target: 500,   reward: 400, desc: "Get 500 total perfects" },
    ];

    // ── Color palette (theme-driven) ─────────────────────────────
    let activeTheme = "rainbow";
    let ownedThemes = ["rainbow"];
    let coins = 0;
    let totalBlocks = 0;
    let totalGames = 0;
    let bestStreak = 0;
    let totalPerfects = 0;
    let collectedObjectives = [];

    function saveCoins() { saveToCloud(); }
    function saveCollected() { saveToCloud(); }
    function saveOwnedThemes() { saveToCloud(); }
    function saveActiveTheme() { saveToCloud(); }
    function saveStat(key, val) { saveToCloud(); }

    function getStatValue(statKey) {
        switch (statKey) {
            case "totalBlocks": return totalBlocks;
            case "bestScore": return bestScore;
            case "bestStreak": return bestStreak;
            case "totalGames": return totalGames;
            case "totalPerfects": return totalPerfects;
            default: return 0;
        }
    }

    function getActiveThemeObj() {
        return THEMES.find(t => t.id === activeTheme) || THEMES[0];
    }

    function blockColor(index) {
        const t = getActiveThemeObj();
        const hue = (index * (t.hueRange / 12) + t.hueStart) % 360;
        return {
            top:   `hsl(${hue}, ${t.sat}%, ${t.lit}%)`,
            left:  `hsl(${hue}, ${Math.max(0, t.sat - 10)}%, ${Math.max(0, t.lit - 18)}%)`,
            right: `hsl(${hue}, ${Math.max(0, t.sat - 5)}%, ${Math.max(0, t.lit - 10)}%)`,
            hue: hue,
        };
    }

    // ── Audio system (synthesized) ────────────────────────────
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    let audioCtx = null;

    function ensureAudio() {
        if (!audioCtx) {
            audioCtx = new AudioCtx();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    }

    function playTone(freq, duration, type = "sine", volume = 0.15) {
        if (!audioCtx || audioMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    function playStack(index) {
        // Rising musical notes — pentatonic scale
        const baseNote = 220;
        const semitones = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
        const semitone = semitones[index % semitones.length];
        const octaveBoost = Math.floor(index / semitones.length);
        const freq = baseNote * Math.pow(2, (semitone + octaveBoost * 12) / 12);
        playTone(freq, 0.25, "triangle", 0.12);
        playTone(freq * 2, 0.15, "sine", 0.06);
    }

    function playPerfect(streak) {
        // Chord arpeggio
        const base = 330 + streak * 40;
        playTone(base, 0.4, "sine", 0.1);
        setTimeout(() => playTone(base * 1.25, 0.35, "sine", 0.08), 60);
        setTimeout(() => playTone(base * 1.5, 0.3, "sine", 0.06), 120);
        setTimeout(() => playTone(base * 2, 0.25, "sine", 0.05), 180);
    }

    function playGameOver() {
        playTone(220, 0.5, "sawtooth", 0.08);
        setTimeout(() => playTone(180, 0.5, "sawtooth", 0.06), 150);
        setTimeout(() => playTone(140, 0.8, "sawtooth", 0.05), 300);
    }

    function playCut() {
        playTone(150, 0.15, "square", 0.06);
    }

    // UI sounds
    function playButtonPress() {
        ensureAudio();
        playTone(600, 0.08, "sine", 0.08);
        playTone(800, 0.06, "sine", 0.04);
    }

    function playCollect() {
        ensureAudio();
        playTone(523, 0.15, "sine", 0.1);
        setTimeout(() => playTone(659, 0.12, "sine", 0.08), 70);
        setTimeout(() => playTone(784, 0.2, "sine", 0.07), 140);
    }

    function playCollectAll() {
        ensureAudio();
        playTone(523, 0.12, "sine", 0.1);
        setTimeout(() => playTone(659, 0.12, "sine", 0.09), 60);
        setTimeout(() => playTone(784, 0.12, "sine", 0.08), 120);
        setTimeout(() => playTone(1047, 0.3, "sine", 0.07), 180);
    }

    function playMenuTap() {
        ensureAudio();
        playTone(440, 0.1, "triangle", 0.08);
        setTimeout(() => playTone(660, 0.08, "triangle", 0.05), 50);
    }

    function playOpenOverlay() {
        ensureAudio();
        playTone(400, 0.1, "sine", 0.06);
        setTimeout(() => playTone(600, 0.12, "sine", 0.05), 60);
    }

    function playCloseOverlay() {
        ensureAudio();
        playTone(500, 0.1, "sine", 0.06);
        setTimeout(() => playTone(350, 0.1, "sine", 0.04), 60);
    }

    function playBuy() {
        ensureAudio();
        playTone(350, 0.1, "sine", 0.08);
        setTimeout(() => playTone(440, 0.08, "sine", 0.07), 60);
        setTimeout(() => playTone(523, 0.12, "sine", 0.06), 120);
        setTimeout(() => playTone(700, 0.2, "sine", 0.05), 180);
    }

    function playEquip() {
        ensureAudio();
        playTone(500, 0.08, "sine", 0.07);
        setTimeout(() => playTone(700, 0.12, "sine", 0.06), 70);
    }

    function playNewBest() {
        ensureAudio();
        const notes = [523, 659, 784, 1047];
        notes.forEach((n, i) => {
            setTimeout(() => playTone(n, 0.25 - i * 0.04, "sine", 0.08 - i * 0.01), i * 100);
        });
    }

    function playThemeToggle() {
        ensureAudio();
        playTone(440, 0.06, "triangle", 0.06);
        setTimeout(() => playTone(550, 0.08, "triangle", 0.05), 50);
    }

    // ── 3D Isometric projection ───────────────────────────────
    const ISO = {
        // Angles for isometric-ish view
        angleX: (31 * Math.PI) / 180,   // 31 degrees tilt
        angleY: Math.PI / 4,            // 45 degrees rotation
        scale: BASE_SCALE,

        project(x, y, z) {
            const cosY = Math.cos(this.angleY);
            const sinY = Math.sin(this.angleY);
            const cosX = Math.cos(this.angleX);
            const sinX = Math.sin(this.angleX);

            // Rotate around Y axis
            const rx = x * cosY - z * sinY;
            const rz = x * sinY + z * cosY;

            // Rotate around X axis
            const ry = y * cosX - rz * sinX;
            const finalZ = y * sinX + rz * cosX;

            // Scale and center
            const s = this.scale * 55;
            return {
                x: W / 2 + rx * s,
                y: H * 0.55 - ry * s,
                depth: finalZ,
            };
        },
    };

    // ── Particle system ───────────────────────────────────────
    const particles = [];

    function spawnParticles(x, y, z, color, count, spread = 1, speed = 1) {
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y, z,
                vx: (Math.random() - 0.5) * 3 * spread * speed,
                vy: Math.random() * 4 * speed + 1,
                vz: (Math.random() - 0.5) * 3 * spread * speed,
                life: 1,
                decay: 0.015 + Math.random() * 0.02,
                size: 2 + Math.random() * 4,
                color: color,
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 12 * dt; // gravity
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

    function drawParticles() {
        for (const p of particles) {
            const proj = ISO.project(p.x, p.y - cameraY, p.z);
            const alpha = Math.max(0, p.life);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(proj.x, proj.y, p.size * alpha, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Floating text system ──────────────────────────────────
    const floatingTexts = [];

    function spawnFloatingText(text, x, y, z, color = "#fff", size = 24) {
        floatingTexts.push({
            text, x, y, z,
            vy: 2,
            life: 1,
            decay: 0.02,
            color,
            size,
        });
    }

    function updateFloatingTexts(dt) {
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
            const ft = floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= ft.decay;
            if (ft.life <= 0) floatingTexts.splice(i, 1);
        }
    }

    function drawFloatingTexts() {
        for (const ft of floatingTexts) {
            const proj = ISO.project(ft.x, ft.y - cameraY, ft.z);
            ctx.globalAlpha = Math.max(0, ft.life);
            ctx.fillStyle = ft.color;
            ctx.font = `${ft.size}px 'Fredoka One', 'Segoe UI', system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (lightMode) {
                ctx.shadowColor = "rgba(0,0,0,0.3)";
                ctx.shadowBlur = 8;
            } else {
                ctx.shadowColor = ft.color;
                ctx.shadowBlur = 15;
            }
            ctx.fillText(ft.text, proj.x, proj.y);
            ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    }

    // ── Screen shake ──────────────────────────────────────────
    let shakeAmount = 0;
    let shakeDecay = 0.9;
    let shakeX = 0, shakeY = 0;

    function triggerShake(amount) {
        shakeAmount = amount;
    }

    function updateShake() {
        if (shakeAmount > 0.5) {
            shakeX = (Math.random() - 0.5) * shakeAmount;
            shakeY = (Math.random() - 0.5) * shakeAmount;
            shakeAmount *= shakeDecay;
        } else {
            shakeX = 0;
            shakeY = 0;
            shakeAmount = 0;
        }
    }

    // ── Draw an isometric block (3D box) ──────────────────────
    function drawBlock(x, y, z, sx, sy, sz, colors, alpha = 1) {
        if (alpha <= 0) return;

        // 8 corners of the box
        const corners = [
            { x: x - sx / 2, y: y,      z: z - sz / 2 }, // 0 bottom-back-left
            { x: x + sx / 2, y: y,      z: z - sz / 2 }, // 1 bottom-back-right
            { x: x + sx / 2, y: y,      z: z + sz / 2 }, // 2 bottom-front-right
            { x: x - sx / 2, y: y,      z: z + sz / 2 }, // 3 bottom-front-left
            { x: x - sx / 2, y: y + sy, z: z - sz / 2 }, // 4 top-back-left
            { x: x + sx / 2, y: y + sy, z: z - sz / 2 }, // 5 top-back-right
            { x: x + sx / 2, y: y + sy, z: z + sz / 2 }, // 6 top-front-right
            { x: x - sx / 2, y: y + sy, z: z + sz / 2 }, // 7 top-front-left
        ];

        const proj = corners.map(c => ISO.project(c.x, c.y, c.z));

        ctx.globalAlpha = alpha;

        // Top face
        ctx.fillStyle = colors.top;
        ctx.beginPath();
        ctx.moveTo(proj[4].x, proj[4].y);
        ctx.lineTo(proj[5].x, proj[5].y);
        ctx.lineTo(proj[6].x, proj[6].y);
        ctx.lineTo(proj[7].x, proj[7].y);
        ctx.closePath();
        ctx.fill();

        // Right face
        ctx.fillStyle = colors.right;
        ctx.beginPath();
        ctx.moveTo(proj[1].x, proj[1].y);
        ctx.lineTo(proj[2].x, proj[2].y);
        ctx.lineTo(proj[6].x, proj[6].y);
        ctx.lineTo(proj[5].x, proj[5].y);
        ctx.closePath();
        ctx.fill();

        // Left face (front-left)
        ctx.fillStyle = colors.left;
        ctx.beginPath();
        ctx.moveTo(proj[3].x, proj[3].y);
        ctx.lineTo(proj[2].x, proj[2].y);
        ctx.lineTo(proj[6].x, proj[6].y);
        ctx.lineTo(proj[7].x, proj[7].y);
        ctx.closePath();
        ctx.fill();

        // Subtle edge highlights
        ctx.strokeStyle = lightMode
            ? `rgba(255,255,255,${0.35 * alpha})`
            : `rgba(255,255,255,${0.1 * alpha})`;
        ctx.lineWidth = 1;
        // Top edges
        ctx.beginPath();
        ctx.moveTo(proj[4].x, proj[4].y);
        ctx.lineTo(proj[5].x, proj[5].y);
        ctx.lineTo(proj[6].x, proj[6].y);
        ctx.lineTo(proj[7].x, proj[7].y);
        ctx.closePath();
        ctx.stroke();

        ctx.globalAlpha = 1;
    }

    // ── Falling pieces (rigidbody with tower collision) ─────────
    const fallingPieces = [];
    const GRAVITY = 16;
    const BOUNCE_DAMPING = 0.35;
    const FRICTION = 0.6;
    const ANGULAR_DAMPING = 0.75;

    function spawnFallingPiece(x, y, z, sx, sy, sz, colors) {
        // Gentle nudge in the direction away from stack — piece should
        // stay close to the tower and tumble down it
        const prev = stack.length > 0 ? stack[stack.length - 1] : null;
        let nudgeX = 0, nudgeZ = 0;
        if (prev) {
            const dx = x - prev.x;
            const dz = z - prev.z;
            const dist = Math.sqrt(dx * dx + dz * dz) || 0.01;
            // Small outward push so it clears the edge
            nudgeX = (dx / dist) * 0.6;
            nudgeZ = (dz / dist) * 0.6;
        }

        fallingPieces.push({
            x, y, z, sx, sy, sz, colors,
            vx: nudgeX + (Math.random() - 0.5) * 0.2,
            vy: 0.5,   // Tiny upward pop
            vz: nudgeZ + (Math.random() - 0.5) * 0.2,
            angX: 0, angZ: 0,
            angVX: (Math.random() - 0.5) * 3,
            angVZ: (Math.random() - 0.5) * 3,
            alpha: 1,
            bounces: 0,
            maxBounces: 5 + Math.floor(Math.random() * 3),
            age: 0,
        });
    }

    function updateFallingPieces(dt) {
        for (let i = fallingPieces.length - 1; i >= 0; i--) {
            const p = fallingPieces[i];
            p.age += dt;

            // Gravity
            p.vy -= GRAVITY * dt;

            // Store previous Y for sweep collision
            const prevY = p.y;

            // Move
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;

            // Rotate (tumble)
            p.angX += p.angVX * dt;
            p.angZ += p.angVZ * dt;

            // Collide with stacked blocks — sweep from top to bottom
            if (p.vy < 0) {
                let landed = false;

                for (let si = stack.length - 1; si >= 0; si--) {
                    const blk = stack[si];
                    const blkTop = si * BLOCK_HEIGHT + BLOCK_HEIGHT;

                    // Skip blocks above the piece (piece hasn't reached them)
                    if (blkTop > prevY + 0.05) continue;

                    // Check if piece crossed this block's top surface
                    if (p.y <= blkTop) {
                        // AABB overlap in xz
                        const oX = Math.min(p.x + p.sx / 2, blk.x + blk.sx / 2) -
                                   Math.max(p.x - p.sx / 2, blk.x - blk.sx / 2);
                        const oZ = Math.min(p.z + p.sz / 2, blk.z + blk.sz / 2) -
                                   Math.max(p.z - p.sz / 2, blk.z - blk.sz / 2);

                        if (oX > 0 && oZ > 0) {
                            // Land on this block
                            p.y = blkTop;
                            p.vy = Math.abs(p.vy) * BOUNCE_DAMPING;
                            p.vx *= FRICTION;
                            p.vz *= FRICTION;
                            p.angVX *= ANGULAR_DAMPING;
                            p.angVZ *= ANGULAR_DAMPING;
                            p.bounces++;
                            landed = true;

                            // Check if piece is on the edge — push it off
                            // so it slides down the tower
                            const pCenterX = p.x;
                            const pCenterZ = p.z;
                            const bCenterX = blk.x;
                            const bCenterZ = blk.z;

                            // How much the piece overhangs each edge
                            const overR = (pCenterX + p.sx / 2) - (bCenterX + blk.sx / 2);
                            const overL = (bCenterX - blk.sx / 2) - (pCenterX - p.sx / 2);
                            const overF = (pCenterZ + p.sz / 2) - (bCenterZ + blk.sz / 2);
                            const overB = (bCenterZ - blk.sz / 2) - (pCenterZ - p.sz / 2);

                            // If more than half the piece overhangs, push it off
                            const halfSX = p.sx * 0.4;
                            const halfSZ = p.sz * 0.4;
                            if (overR > halfSX) p.vx += 1.5;
                            else if (overL > halfSX) p.vx -= 1.5;
                            if (overF > halfSZ) p.vz += 1.5;
                            else if (overB > halfSZ) p.vz -= 1.5;

                            // Small bounce particles
                            if (p.bounces <= 4) {
                                spawnParticles(p.x, blkTop, p.z, p.colors.top, 3, 0.3, 0.3);
                            }
                            break;
                        }
                    }
                }

                // Floor collision at y = 0
                if (!landed && p.y <= 0) {
                    p.y = 0;
                    if (Math.abs(p.vy) > 0.5) {
                        p.vy = Math.abs(p.vy) * BOUNCE_DAMPING;
                        p.bounces++;
                        spawnParticles(p.x, 0, p.z, p.colors.top, 2, 0.2, 0.2);
                    } else {
                        p.vy = 0;
                    }
                    p.vx *= FRICTION;
                    p.vz *= FRICTION;
                    p.angVX *= ANGULAR_DAMPING;
                    p.angVZ *= ANGULAR_DAMPING;
                }
            }

            // Fade after enough bounces or after 6 seconds
            if (p.bounces >= p.maxBounces || p.age > 6) {
                p.alpha -= 1.2 * dt;
            }

            // Remove when faded or fell way below
            if (p.y < -20 || p.alpha <= 0) {
                fallingPieces.splice(i, 1);
            }
        }
    }

    // Draw a single falling piece
    function drawOneFallingPiece(p) {
        const tiltScale = 0.12;
        const visualSX = p.sx * (1 + Math.sin(p.angX) * tiltScale);
        const visualSZ = p.sz * (1 + Math.sin(p.angZ) * tiltScale);
        drawBlock(p.x, p.y - cameraY, p.z, visualSX, p.sy, visualSZ, p.colors, Math.max(0, p.alpha));
    }

    // Get the isometric depth of a point (higher = further from camera)
    function isoDepth(x, z) {
        return x * Math.sin(ISO.angleY) + z * Math.cos(ISO.angleY);
    }

    // In isometric view (45° rotation), lower (x+z) = further from camera (upper-left on screen)
    // Higher (x+z) = closer to camera (lower-right on screen)
    // BEHIND = lower depth = draw before stack
    // IN FRONT = higher depth = draw after stack
    function drawFallingPiecesBehind() {
        const stackCenterX = stack.length > 0 ? stack[stack.length - 1].x : 0;
        const stackCenterZ = stack.length > 0 ? stack[stack.length - 1].z : 0;
        const stackDepth = isoDepth(stackCenterX, stackCenterZ);
        for (const p of fallingPieces) {
            if (isoDepth(p.x, p.z) <= stackDepth) {
                drawOneFallingPiece(p);
            }
        }
    }

    function drawFallingPiecesFront() {
        const stackCenterX = stack.length > 0 ? stack[stack.length - 1].x : 0;
        const stackCenterZ = stack.length > 0 ? stack[stack.length - 1].z : 0;
        const stackDepth = isoDepth(stackCenterX, stackCenterZ);
        for (const p of fallingPieces) {
            if (isoDepth(p.x, p.z) > stackDepth) {
                drawOneFallingPiece(p);
            }
        }
    }

    // ── Game state ────────────────────────────────────────────
    let BLOCK_HEIGHT = 0.4;
    const START_SIZE = { x: 3, z: 3 };
    let PERFECT_THRESHOLD = 0.15;
    const MIN_BLOCK_SIZE = 0.3;
    let BASE_SPEED = 5.8;
    const SPEED_INCREMENT = 0.18;
    const MAX_SPEED = 14;
    const MOVE_RANGE = 6;

    let state = "start"; // start, playing, gameover, paused
    let stateBeforePause = null;
    let stack = [];       // { x, z, sx, sz, colors }
    let current = null;   // moving block
    let score = 0;
    let bestScore = 0;
    let perfectStreak = 0;
    let multiplier = 1;
    let blockIndex = 0;
    let cameraY = 0;
    let cameraTargetY = 0;
    let moveDir = 1;      // 1 or -1
    let moveAxis = "x";   // x or z
    let speed = BASE_SPEED;
    let speedOffset = 0;  // blocks placed before gameplay (decorative base)
    let bgHue = 220;
    let bgTargetHue = 220;
    let perfectFlash = 0;
    let gameOverTimer = 0;
    let lightMode = true;

    // UI elements
    const scoreEl = document.getElementById("score");
    const comboEl = document.getElementById("combo");
    const perfectTextEl = document.getElementById("perfect-text");
    const menuScreen = document.getElementById("menu-screen");
    const menuBestEl = document.getElementById("menu-best");
    const menuTapZone = document.getElementById("menu-tap-zone");
    const btnStore = document.getElementById("btn-store");
    const btnObjectives = document.getElementById("btn-objectives");
    const objectivesScreen = document.getElementById("objectives-screen");
    const objectivesClose = document.getElementById("objectives-close");
    const objectivesList = document.getElementById("objectives-list");
    const storeScreen = document.getElementById("store-screen");
    const storeClose = document.getElementById("store-close");
    const storeList = document.getElementById("store-list");
    const storeCoinsEl = document.getElementById("store-coins");
    const menuCoinsEl = document.getElementById("menu-coins");
    const gameOverScreen = document.getElementById("game-over-screen");
    const endScoreEl = document.getElementById("end-score");
    const endBestEl = document.getElementById("end-best");
    const newBestLabel = document.getElementById("new-best-label");
    const restartBtn = document.getElementById("restart-btn");
    const ingameBestEl = document.getElementById("ingame-best");

    const COIN_ICON = '<img src="Coin.png" class="coin-icon">';
    const COIN_ICON_LG = '<img src="Coin.png" class="coin-icon-lg">';
    const COIN_ICON_SM = '<img src="Coin.png" class="coin-icon-sm">';

    function updateCoinDisplay() {
        menuCoinsEl.innerHTML = coins > 0 ? `${COIN_ICON} ${coins}` : "";
        storeCoinsEl.innerHTML = `${COIN_ICON} ${coins}`;
    }

    function updateBestDisplay() {
        if (bestScore > 0) {
            menuBestEl.textContent = `BEST: ${bestScore}`;
            ingameBestEl.textContent = `BEST: ${bestScore}`;
        }
        updateCoinDisplay();
    }
    updateBestDisplay();

    // ── Initialize / Reset ────────────────────────────────────
    function initGame() {
        stack = [];
        fallingPieces.length = 0;
        particles.length = 0;
        floatingTexts.length = 0;
        score = 0;
        perfectStreak = 0;
        multiplier = 1;
        blockIndex = 0;
        speedOffset = 0;
        cameraY = 0;
        cameraTargetY = 0;
        speed = BASE_SPEED;
        bgHue = 220;
        bgTargetHue = 220;
        perfectFlash = 0;
        shakeAmount = 0;

        // First block (foundation)
        const colors = blockColor(0);
        stack.push({
            x: 0, z: 0,
            sx: START_SIZE.x, sz: START_SIZE.z,
            colors,
        });

        // Spawn first moving block
        blockIndex = 1;
        spawnNextBlock();

        scoreEl.textContent = "0";
        comboEl.classList.remove("show");

        state = "playing";
        gameOverScreen.classList.remove("show");
    }

    // Seamless start from menu — animate out then build on existing stack
    function startFromMenu() {
        // Animate menu elements out
        menuScreen.classList.add("exiting");

        // Convert the decorative start-anim blocks into the real game stack
        stack = [];
        for (let i = 0; i < startAnimBlocks.length; i++) {
            const b = startAnimBlocks[i];
            stack.push({
                x: b.x, z: b.z,
                sx: b.sx, sz: b.sz,
                colors: b.colors,
            });
        }

        fallingPieces.length = 0;
        particles.length = 0;
        floatingTexts.length = 0;
        score = 0;
        perfectStreak = 0;
        multiplier = 1;
        speed = BASE_SPEED;
        bgHue = 220;
        bgTargetHue = 220;
        perfectFlash = 0;
        shakeAmount = 0;

        // Pre-set camera to where first block will land (no jump)
        const startCamY = (stack.length + 1) * BLOCK_HEIGHT;
        cameraY = startCamY;
        cameraTargetY = startCamY;

        // Spawn the first moving block on top of the existing stack
        blockIndex = stack.length;
        speedOffset = stack.length;
        spawnNextBlock();

        scoreEl.textContent = "0";
        comboEl.classList.remove("show");
        state = "playing";
        gameOverScreen.classList.remove("show");

        // Fade in HUD after a short delay so it overlaps with menu exit
        setTimeout(() => {
            document.getElementById("ui-overlay").style.opacity = "1";
        }, 200);

        // Remove menu after animation completes
        setTimeout(() => {
            menuScreen.style.display = "none";
            menuScreen.classList.remove("exiting");
        }, 550);
    }

    // Return to menu after game over
    function returnToMenu() {
        gameOverScreen.classList.remove("show");
        menuScreen.classList.remove("exiting");
        menuScreen.style.display = "block";
        document.getElementById("ui-overlay").style.opacity = "0";
        state = "start";
        cameraY = 0;
        cameraTargetY = 0;
        fallingPieces.length = 0;
        particles.length = 0;
        floatingTexts.length = 0;
        current = null;
        initStartAnim();
        updateBestDisplay();
        checkObjectiveNotify();
    }

    function checkObjectiveNotify() {
        const btn = document.getElementById("btn-objectives");
        const hasCollectible = OBJECTIVES.some(obj => {
            const val = getStatValue(obj.stat);
            return val >= obj.target && !collectedObjectives.includes(obj.id);
        });
        if (hasCollectible) {
            btn.classList.add("btn-shake");
        } else {
            btn.classList.remove("btn-shake");
        }
    }

    function spawnNextBlock() {
        const prev = stack[stack.length - 1];
        const colors = blockColor(blockIndex);

        // Alternate axis every block
        moveAxis = blockIndex % 2 === 1 ? "x" : "z";
        moveDir = 1;

        // Calculate speed with progression (offset by decorative base blocks)
        speed = Math.min(BASE_SPEED + Math.max(0, blockIndex - speedOffset) * SPEED_INCREMENT, MAX_SPEED);
        // Add slight randomness
        speed *= 0.85 + Math.random() * 0.3;

        const startPos = -MOVE_RANGE;
        current = {
            x: moveAxis === "x" ? startPos : prev.x,
            z: moveAxis === "z" ? startPos : prev.z,
            sx: prev.sx,
            sz: prev.sz,
            colors,
            y: stack.length * BLOCK_HEIGHT,
        };
    }

    // ── Stack a block ─────────────────────────────────────────
    function stackBlock() {
        if (!current) return;

        const prev = stack[stack.length - 1];
        let isPerfect = false;

        if (moveAxis === "x") {
            const delta = current.x - prev.x;

            if (Math.abs(delta) < PERFECT_THRESHOLD) {
                // Perfect!
                isPerfect = true;
                current.x = prev.x;
            } else {
                // Calculate overlap
                const prevLeft = prev.x - prev.sx / 2;
                const prevRight = prev.x + prev.sx / 2;
                const currLeft = current.x - current.sx / 2;
                const currRight = current.x + current.sx / 2;

                const overlapLeft = Math.max(prevLeft, currLeft);
                const overlapRight = Math.min(prevRight, currRight);
                const overlapSize = overlapRight - overlapLeft;

                if (overlapSize <= 0) {
                    gameOver();
                    return;
                }

                // Create falling piece
                const fallingSize = current.sx - overlapSize;
                let fallingX;
                if (current.x > prev.x) {
                    fallingX = overlapRight + fallingSize / 2;
                } else {
                    fallingX = overlapLeft - fallingSize / 2;
                }
                spawnFallingPiece(
                    fallingX, current.y, current.z,
                    fallingSize, BLOCK_HEIGHT, current.sz,
                    current.colors
                );

                // Particles at cut line
                const cutX = current.x > prev.x ? overlapRight : overlapLeft;
                spawnParticles(cutX, current.y + BLOCK_HEIGHT / 2, current.z, current.colors.top, 8, 0.5, 0.5);

                playCut();

                // Resize current block to overlap
                current.x = (overlapLeft + overlapRight) / 2;
                current.sx = overlapSize;
            }
        } else {
            const delta = current.z - prev.z;

            if (Math.abs(delta) < PERFECT_THRESHOLD) {
                isPerfect = true;
                current.z = prev.z;
            } else {
                const prevBack = prev.z - prev.sz / 2;
                const prevFront = prev.z + prev.sz / 2;
                const currBack = current.z - current.sz / 2;
                const currFront = current.z + current.sz / 2;

                const overlapBack = Math.max(prevBack, currBack);
                const overlapFront = Math.min(prevFront, currFront);
                const overlapSize = overlapFront - overlapBack;

                if (overlapSize <= 0) {
                    gameOver();
                    return;
                }

                const fallingSize = current.sz - overlapSize;
                let fallingZ;
                if (current.z > prev.z) {
                    fallingZ = overlapFront + fallingSize / 2;
                } else {
                    fallingZ = overlapBack - fallingSize / 2;
                }
                spawnFallingPiece(
                    current.x, current.y, fallingZ,
                    current.sx, BLOCK_HEIGHT, fallingSize,
                    current.colors
                );

                const cutZ = current.z > prev.z ? overlapFront : overlapBack;
                spawnParticles(current.x, current.y + BLOCK_HEIGHT / 2, cutZ, current.colors.top, 8, 0.5, 0.5);

                playCut();

                current.z = (overlapBack + overlapFront) / 2;
                current.sz = overlapSize;
            }
        }

        // Handle perfect vs imperfect
        if (isPerfect) {
            perfectStreak++;
            totalPerfects++;
            saveStat("stackTotalPerfects", totalPerfects);
            if (perfectStreak > bestStreak) {
                bestStreak = perfectStreak;
                saveStat("stackBestStreak", bestStreak);
            }
            updateMultiplier();

            // Visual feedback
            perfectFlash = 1;
            triggerShake(4);

            // Particles burst
            spawnParticles(current.x, current.y + BLOCK_HEIGHT, current.z, "#ffd700", 25, 2, 1.5);
            spawnParticles(current.x, current.y + BLOCK_HEIGHT, current.z, "#fff", 15, 1.5, 1.2);

            // Floating text
            const texts = ["PERFECT!", "AMAZING!", "FLAWLESS!", "INCREDIBLE!", "GODLIKE!"];
            const textIndex = Math.min(perfectStreak - 1, texts.length - 1);
            spawnFloatingText(texts[textIndex], current.x, current.y + 2, current.z, "#ffd700", 28 + perfectStreak * 2);

            // Show perfect text in UI
            showPerfectText();

            playPerfect(perfectStreak);

            // Grow block slightly on long streaks (reward)
            if (perfectStreak >= 3) {
                current.sx = Math.min(current.sx + 0.08, START_SIZE.x);
                current.sz = Math.min(current.sz + 0.08, START_SIZE.z);
            }
        } else {
            perfectStreak = 0;
            updateMultiplier();
            triggerShake(2);
        }

        // Score
        const points = 1 * multiplier;
        score += points;

        // Show points floating
        if (multiplier > 1) {
            spawnFloatingText(`+${points}`, current.x + 1.5, current.y + 1.5, current.z, "#fff", 20);
        }

        // Update best
        let isNewBest = false;
        if (score > bestScore) {
            bestScore = score;
            saveToCloud();
            ingameBestEl.textContent = `BEST: ${bestScore}`;
            isNewBest = true;
        }

        // Audio
        playStack(blockIndex);

        // Push to stack
        stack.push({
            x: current.x,
            z: current.z,
            sx: current.sx,
            sz: current.sz,
            colors: current.colors,
        });
        totalBlocks++;
        saveStat("stackTotalBlocks", totalBlocks);

        // Camera
        cameraTargetY = stack.length * BLOCK_HEIGHT;

        // Shift background hue
        bgTargetHue = (bgTargetHue + 8) % 360;

        // UI bump
        scoreEl.textContent = score;
        scoreEl.classList.add("bump");
        setTimeout(() => scoreEl.classList.remove("bump"), 150);

        // Check minimum size
        if (current.sx < MIN_BLOCK_SIZE || current.sz < MIN_BLOCK_SIZE) {
            gameOver();
            return;
        }

        // Next block
        blockIndex++;
        spawnNextBlock();
    }

    function updateMultiplier() {
        if (perfectStreak >= 6) multiplier = 4;
        else if (perfectStreak >= 4) multiplier = 3;
        else if (perfectStreak >= 2) multiplier = 2;
        else multiplier = 1;

        if (multiplier > 1) {
            comboEl.textContent = `${multiplier}x COMBO`;
            comboEl.classList.add("show");
        } else {
            comboEl.classList.remove("show");
        }
    }

    function showPerfectText() {
        perfectTextEl.style.opacity = "1";
        perfectTextEl.style.transform = "translate(-50%, -50%) scale(1.2)";
        perfectTextEl.style.transition = "none";
        requestAnimationFrame(() => {
            perfectTextEl.style.transition = "opacity 0.8s ease, transform 0.8s ease";
            perfectTextEl.style.opacity = "0";
            perfectTextEl.style.transform = "translate(-50%, -60%) scale(0.8)";
        });
    }

    let earnedCoins = 0;

    function calculateCoinReward(gameScore) {
        // Base: 1 coin per 2 points scored
        let reward = Math.floor(gameScore / 2);
        // Bonus for high scores
        if (gameScore >= 50) reward += 15;
        else if (gameScore >= 25) reward += 8;
        else if (gameScore >= 10) reward += 3;
        // Minimum 1 coin for any game where you scored
        if (gameScore > 0 && reward < 1) reward = 1;
        return reward;
    }

    function gameOver() {
        state = "gameover";
        gameOverTimer = 0;
        totalGames++;
        saveStat("stackTotalGames", totalGames);

        // Calculate coin reward
        earnedCoins = calculateCoinReward(score);

        // Drop current block
        if (current) {
            spawnFallingPiece(
                current.x, current.y, current.z,
                current.sx, BLOCK_HEIGHT, current.sz,
                current.colors
            );
            current = null;
        }

        triggerShake(8);
        playGameOver();

        // Show interstitial ad if cooldown has elapsed
        tryShowInterstitial();

        // Send score to YouTube
        if (score > 0) sendScoreToSDK(score);

        // Show game over screen after delay
        setTimeout(() => {
            endScoreEl.textContent = score;
            endBestEl.textContent = `BEST: ${bestScore}`;
            if (score >= bestScore && score > 0) {
                newBestLabel.classList.add("show");
                setTimeout(() => startConfetti(), 100);
                playNewBest();
            } else {
                newBestLabel.classList.remove("show");
            }
            document.getElementById("end-coins").innerHTML = earnedCoins > 0 ? `${COIN_ICON_LG} +${earnedCoins}` : "";
            gameOverScreen.classList.add("show");
        }, 800);
    }

    // ── Draw background ───────────────────────────────────────
    function drawBackground() {
        // Gradient background that shifts with the game
        bgHue += (bgTargetHue - bgHue) * 0.02;
        const h = bgHue;
        const grad = ctx.createLinearGradient(0, 0, 0, H);

        if (lightMode) {
            grad.addColorStop(0, `hsl(${h}, 30%, 85%)`);
            grad.addColorStop(0.5, `hsl(${(h + 20) % 360}, 25%, 78%)`);
            grad.addColorStop(1, `hsl(${(h + 40) % 360}, 20%, 72%)`);
        } else {
            grad.addColorStop(0, `hsl(${h}, 35%, 12%)`);
            grad.addColorStop(0.5, `hsl(${(h + 20) % 360}, 40%, 18%)`);
            grad.addColorStop(1, `hsl(${(h + 40) % 360}, 30%, 8%)`);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Perfect flash overlay
        if (perfectFlash > 0) {
            ctx.fillStyle = `rgba(255, 215, 0, ${perfectFlash * 0.08})`;
            ctx.fillRect(0, 0, W, H);
            perfectFlash *= 0.92;
            if (perfectFlash < 0.01) perfectFlash = 0;
        }
    }

    // ── Draw grid/floor ───────────────────────────────────────
    function drawFloor() {
        const gridSize = 30;

        // In light mode, draw a visible floor surface first
        if (lightMode) {
            const floorCorners = [
                ISO.project(-gridSize, 0, -gridSize),
                ISO.project(gridSize, 0, -gridSize),
                ISO.project(gridSize, 0, gridSize),
                ISO.project(-gridSize, 0, gridSize),
            ];
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.beginPath();
            ctx.moveTo(floorCorners[0].x, floorCorners[0].y);
            ctx.lineTo(floorCorners[1].x, floorCorners[1].y);
            ctx.lineTo(floorCorners[2].x, floorCorners[2].y);
            ctx.lineTo(floorCorners[3].x, floorCorners[3].y);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        if (lightMode) {
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
        } else {
            ctx.globalAlpha = 0.1;
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
        }
        ctx.lineWidth = 0.5;
        const step = 2;
        for (let i = -gridSize; i <= gridSize; i += step) {
            const a = ISO.project(i, 0, -gridSize);
            const b = ISO.project(i, 0, gridSize);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();

            const c = ISO.project(-gridSize, 0, i);
            const d = ISO.project(gridSize, 0, i);
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(d.x, d.y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ── Main draw ─────────────────────────────────────────────
    function drawStack() {
        // Only draw the visible portion of the stack
        const visibleStart = Math.max(0, stack.length - 30);

        for (let i = visibleStart; i < stack.length; i++) {
            const block = stack[i];
            const y = i * BLOCK_HEIGHT - cameraY;
            // Shadow on the block below (subtle)
            if (i === stack.length - 1) {
                // Draw a very subtle shadow under the topmost block
                const shadowProj = ISO.project(block.x, y - 0.02, block.z);
                ctx.globalAlpha = lightMode ? 0.08 : 0.15;
                ctx.fillStyle = "#000";
                ctx.beginPath();
                ctx.ellipse(shadowProj.x, shadowProj.y + 2, block.sx * 18, block.sz * 8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
            drawBlock(block.x, y, block.z, block.sx, BLOCK_HEIGHT, block.sz, block.colors);
        }

        // Draw current moving block
        if (current) {
            const y = current.y - cameraY;
            // Shadow
            const shadowProj = ISO.project(current.x, y - 0.02, current.z);
            ctx.globalAlpha = 0.1;
            ctx.fillStyle = "#000";
            ctx.beginPath();
            ctx.ellipse(shadowProj.x, shadowProj.y + 2, current.sx * 18, current.sz * 8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Pulsing glow on moving block
            const pulse = 0.8 + Math.sin(Date.now() * 0.006) * 0.2;
            const glowProj = ISO.project(current.x, y + BLOCK_HEIGHT / 2, current.z);
            const glowGrad = ctx.createRadialGradient(glowProj.x, glowProj.y, 0, glowProj.x, glowProj.y, 60);
            const glowAlpha = lightMode ? 0.1 : 0.15;
            glowGrad.addColorStop(0, `hsla(${current.colors.hue}, 80%, 70%, ${glowAlpha * pulse})`);
            glowGrad.addColorStop(1, `hsla(${current.colors.hue}, 80%, 70%, 0)`);
            ctx.fillStyle = glowGrad;
            ctx.fillRect(glowProj.x - 80, glowProj.y - 80, 160, 160);

            drawBlock(current.x, y, current.z, current.sx, BLOCK_HEIGHT, current.sz, current.colors);
        }
    }

    // ── Game loop ─────────────────────────────────────────────
    let lastTime = 0;

    function gameLoop(timestamp) {
        // When paused, keep requesting frames but don't update anything
        if (state === "paused") {
            lastTime = timestamp;
            requestAnimationFrame(gameLoop);
            return;
        }

        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;

        // Update shake
        updateShake();

        // Apply shake
        ctx.save();
        ctx.translate(shakeX, shakeY);

        // Draw
        drawBackground();

        // Camera smooth follow
        cameraY += (cameraTargetY - cameraY) * 3 * dt;

        // Always draw floor and stack (menu sees the real game behind it)
        drawFloor();

        // Move current block
        if (state === "playing" && current) {
            if (moveAxis === "x") {
                current.x += moveDir * speed * dt;
                if (current.x > MOVE_RANGE) {
                    current.x = MOVE_RANGE;
                    moveDir = -1;
                } else if (current.x < -MOVE_RANGE) {
                    current.x = -MOVE_RANGE;
                    moveDir = 1;
                }
            } else {
                current.z += moveDir * speed * dt;
                if (current.z > MOVE_RANGE) {
                    current.z = MOVE_RANGE;
                    moveDir = -1;
                } else if (current.z < -MOVE_RANGE) {
                    current.z = -MOVE_RANGE;
                    moveDir = 1;
                }
            }
        }

        // Update effects
        updateFallingPieces(dt);
        updateParticles(dt);
        updateFloatingTexts(dt);

        // Draw everything
        if (state === "start") {
            drawStartAnimation(timestamp);
        } else {
            drawFallingPiecesBehind();
            drawStack();
            drawFallingPiecesFront();
            drawParticles();
            drawFloatingTexts();
        }

        if (state === "gameover") {
            gameOverTimer += dt;
        }

        ctx.restore();

        requestAnimationFrame(gameLoop);
    }

    // ── Start screen animation ────────────────────────────────
    let startAnimBlocks = [];
    function initStartAnim() {
        startAnimBlocks = [];
        for (let i = 0; i < 8; i++) {
            startAnimBlocks.push({
                x: 0, z: 0,
                sx: START_SIZE.x,
                sz: START_SIZE.z,
                colors: blockColor(i),
            });
        }
    }
    initStartAnim();
    checkObjectiveNotify();

    function drawStartAnimation(t) {
        drawFloor();
        const wobble = Math.sin(t * 0.001) * 0.5;
        for (let i = 0; i < startAnimBlocks.length; i++) {
            const block = startAnimBlocks[i];
            const y = i * BLOCK_HEIGHT;
            drawBlock(
                wobble * (i % 2 === 0 ? 1 : -1) * 0.1,
                y, 0,
                block.sx, BLOCK_HEIGHT, block.sz,
                block.colors
            );
        }
    }

    // ── Objectives rendering ────────────────────────────────────
    function renderObjectives() {
        objectivesList.innerHTML = "";
        const completed = OBJECTIVES.filter(o => collectedObjectives.includes(o.id)).length;
        const pct = Math.round((completed / OBJECTIVES.length) * 100);
        document.getElementById("obj-completion").innerHTML = `${completed} / ${OBJECTIVES.length} &mdash; ${pct}%<div class="obj-bar obj-bar-overall"><div class="obj-fill" style="width:${pct}%"></div></div>`;
        for (const obj of OBJECTIVES) {
            const current = getStatValue(obj.stat);
            const progress = Math.min(current / obj.target, 1);
            const isCollected = collectedObjectives.includes(obj.id);
            const isComplete = current >= obj.target;

            const item = document.createElement("div");
            item.className = "obj-item";
            item.innerHTML = `
                <div class="obj-header">
                    <span class="obj-desc">${obj.desc}</span>
                    <span class="obj-reward">${COIN_ICON_SM} ${obj.reward}</span>
                </div>
                <div class="obj-bar"><div class="obj-fill" style="width:${progress * 100}%"></div></div>
                <div class="obj-footer">
                    <span class="obj-progress">${Math.min(current, obj.target)} / ${obj.target}</span>
                    ${isCollected
                        ? '<span class="obj-collected">COLLECTED</span>'
                        : `<button class="obj-collect" data-id="${obj.id}" ${!isComplete ? "disabled" : ""}>${isComplete ? "COLLECT" : "IN PROGRESS"}</button>`}
                </div>`;
            objectivesList.appendChild(item);
        }
        objectivesList.querySelectorAll(".obj-collect:not(:disabled)").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const obj = OBJECTIVES.find(o => o.id === btn.dataset.id);
                if (obj && !collectedObjectives.includes(obj.id)) {
                    coins += obj.reward;
                    saveCoins();
                    collectedObjectives.push(obj.id);
                    saveCollected();
                    updateCoinDisplay();
                    renderObjectives();
                    checkObjectiveNotify();
                    startCoinShower();
                    playCollect();
                }
            });
        });
        updateCollectAllBtn();
    }

    // ── Collect All button ──────────────────────────────────────
    const collectAllBtn = document.getElementById("objectives-collect-all");
    collectAllBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
    collectAllBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        let totalReward = 0;
        for (const obj of OBJECTIVES) {
            const val = getStatValue(obj.stat);
            if (val >= obj.target && !collectedObjectives.includes(obj.id)) {
                totalReward += obj.reward;
                collectedObjectives.push(obj.id);
            }
        }
        if (totalReward > 0) {
            coins += totalReward;
            saveCoins();
            saveCollected();
            updateCoinDisplay();
            renderObjectives();
            checkObjectiveNotify();
            startCoinShower();
            playCollectAll();
        }
    });

    function updateCollectAllBtn() {
        const hasAny = OBJECTIVES.some(obj => {
            return getStatValue(obj.stat) >= obj.target && !collectedObjectives.includes(obj.id);
        });
        collectAllBtn.style.display = hasAny ? "flex" : "none";
    }

    // ── Coin Shower Animation ─────────────────────────────────
    const coinShowerCanvas = document.getElementById("coin-shower-canvas");
    const coinShowerCtx = coinShowerCanvas.getContext("2d");
    let coinShowerParticles = [];
    let coinShowerAnim = null;
    const coinImg = new Image();
    coinImg.src = "Coin.png";

    function startCoinShower() {
        coinShowerCanvas.width = window.innerWidth;
        coinShowerCanvas.height = window.innerHeight;
        coinShowerParticles = [];
        for (let i = 0; i < 40; i++) {
            coinShowerParticles.push({
                x: Math.random() * coinShowerCanvas.width,
                y: -Math.random() * coinShowerCanvas.height,
                vy: 2 + Math.random() * 3,
                vx: (Math.random() - 0.5) * 2,
                size: 16 + Math.random() * 20,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.15,
                alpha: 0.7 + Math.random() * 0.3,
            });
        }
        if (coinShowerAnim) cancelAnimationFrame(coinShowerAnim);
        animateCoinShower();
    }

    function animateCoinShower() {
        coinShowerCtx.clearRect(0, 0, coinShowerCanvas.width, coinShowerCanvas.height);
        let alive = false;
        for (const p of coinShowerParticles) {
            p.y += p.vy;
            p.x += p.vx;
            p.rot += p.rotSpeed;
            p.alpha -= 0.003;
            if (p.y < coinShowerCanvas.height + 40 && p.alpha > 0) {
                alive = true;
                coinShowerCtx.save();
                coinShowerCtx.globalAlpha = Math.max(0, p.alpha);
                coinShowerCtx.translate(p.x, p.y);
                coinShowerCtx.rotate(p.rot);
                coinShowerCtx.drawImage(coinImg, -p.size / 2, -p.size / 2, p.size, p.size);
                coinShowerCtx.restore();
            }
        }
        if (alive) {
            coinShowerAnim = requestAnimationFrame(animateCoinShower);
        } else {
            coinShowerCtx.clearRect(0, 0, coinShowerCanvas.width, coinShowerCanvas.height);
            coinShowerAnim = null;
        }
    }

    // ── Confetti Shower Animation ─────────────────────────────
    const confettiCanvas = document.getElementById("confetti-canvas");
    const confettiCtx = confettiCanvas.getContext("2d");
    let confettiParticles = [];
    let confettiAnim = null;
    const confettiColors = ["#FF6B6B","#FFD036","#5BC95F","#4DABF7","#FF6B9D","#9775FA","#FF9F43","#00D2D3"];

    function startConfetti() {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
        confettiParticles = [];
        for (let i = 0; i < 80; i++) {
            confettiParticles.push({
                x: Math.random() * confettiCanvas.width,
                y: -Math.random() * confettiCanvas.height * 0.5,
                vy: 1.5 + Math.random() * 3,
                vx: (Math.random() - 0.5) * 3,
                w: 6 + Math.random() * 6,
                h: 10 + Math.random() * 10,
                rot: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
                alpha: 1,
            });
        }
        if (confettiAnim) cancelAnimationFrame(confettiAnim);
        animateConfetti();
    }

    function animateConfetti() {
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        let alive = false;
        for (const p of confettiParticles) {
            p.y += p.vy;
            p.x += p.vx;
            p.vx += (Math.random() - 0.5) * 0.1;
            p.rot += p.rotSpeed;
            if (p.y > confettiCanvas.height * 0.7) p.alpha -= 0.02;
            if (p.y < confettiCanvas.height + 20 && p.alpha > 0) {
                alive = true;
                confettiCtx.save();
                confettiCtx.globalAlpha = Math.max(0, p.alpha);
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rot);
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                confettiCtx.restore();
            }
        }
        if (alive) {
            confettiAnim = requestAnimationFrame(animateConfetti);
        } else {
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            confettiAnim = null;
        }
    }

    // ── Store rendering ──────────────────────────────────────────
    function getThemeSwatches(theme) {
        const swatches = [];
        for (let i = 0; i < 5; i++) {
            const hue = (i * (theme.hueRange / 5) + theme.hueStart) % 360;
            swatches.push(`hsl(${hue}, ${theme.sat}%, ${theme.lit}%)`);
        }
        return swatches;
    }

    function renderStore() {
        storeList.innerHTML = "";
        updateCoinDisplay();

        for (const theme of THEMES) {
            const isOwned = ownedThemes.includes(theme.id);
            const isEquipped = activeTheme === theme.id;
            const canAfford = coins >= theme.price;
            const swatches = getThemeSwatches(theme);

            const item = document.createElement("div");
            item.className = "store-item" + (isEquipped ? " equipped" : "");

            const swatchHTML = swatches.map(c =>
                `<div class="swatch" style="background:${c}"></div>`
            ).join("");

            let btnText, btnClass, btnDisabled;
            if (isEquipped) {
                btnText = "EQUIPPED"; btnClass = "store-buy-btn equipped-btn"; btnDisabled = true;
            } else if (isOwned) {
                btnText = "EQUIP"; btnClass = "store-buy-btn owned"; btnDisabled = false;
            } else {
                btnText = `${COIN_ICON_SM} ${theme.price}`; btnClass = "store-buy-btn"; btnDisabled = false;
                if (!canAfford) btnClass += " cant-afford";
            }

            item.innerHTML = `
                <div class="store-palette-preview">${swatchHTML}</div>
                <div class="store-item-info">
                    <span class="store-item-name">${theme.name}</span>
                    <span class="store-item-price">${theme.price === 0 ? "FREE" : COIN_ICON_SM + " " + theme.price}</span>
                </div>
                <button class="${btnClass}" data-id="${theme.id}" ${btnDisabled ? "disabled" : ""}>${btnText}</button>`;
            storeList.appendChild(item);
        }

        storeList.querySelectorAll(".store-buy-btn:not(:disabled)").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const theme = THEMES.find(t => t.id === btn.dataset.id);
                if (!theme) return;
                if (ownedThemes.includes(theme.id)) {
                    activeTheme = theme.id;
                    saveActiveTheme();
                    playEquip();
                } else if (coins >= theme.price) {
                    coins -= theme.price;
                    saveCoins();
                    ownedThemes.push(theme.id);
                    saveOwnedThemes();
                    activeTheme = theme.id;
                    saveActiveTheme();
                    playBuy();
                } else {
                    // Not enough coins — show feedback
                    playTone(150, 0.15, "square", 0.08);
                    btn.textContent = "NOT ENOUGH!";
                    btn.classList.add("btn-shake");
                    setTimeout(() => {
                        btn.classList.remove("btn-shake");
                        btn.innerHTML = `${COIN_ICON_SM} ${theme.price}`;
                    }, 800);
                    return;
                }
                updateCoinDisplay();
                renderStore();
                if (state === "start") initStartAnim();
            });
        });
    }

    // ── Input handling ────────────────────────────────────────

    // Tapping anywhere on the menu starts the game (buttons stopPropagation)
    menuScreen.addEventListener("pointerdown", (e) => {
        if (state === "paused") return;
        if (e.type === "touchstart") e.preventDefault();
        ensureAudio();
        if (state === "start") {
            playMenuTap();
            startFromMenu();
        }
    });

    // Menu buttons — stop propagation so they don't start the game
    btnStore.addEventListener("pointerdown", (e) => e.stopPropagation());
    btnObjectives.addEventListener("pointerdown", (e) => e.stopPropagation());
    document.getElementById("btn-theme").addEventListener("pointerdown", (e) => e.stopPropagation());

    btnStore.addEventListener("click", (e) => {
        if (state === "paused") return;
        e.stopPropagation();
        playOpenOverlay();
        renderStore();
        storeScreen.classList.add("show");
    });

    btnObjectives.addEventListener("click", (e) => {
        if (state === "paused") return;
        e.stopPropagation();
        playOpenOverlay();
        renderObjectives();
        objectivesScreen.classList.add("show");
    });

    storeClose.addEventListener("click", (e) => {
        if (state === "paused") return;
        e.stopPropagation();
        playCloseOverlay();
        storeScreen.classList.remove("show");
    });

    objectivesClose.addEventListener("click", (e) => {
        if (state === "paused") return;
        e.stopPropagation();
        playCloseOverlay();
        objectivesScreen.classList.remove("show");
    });

    storeScreen.addEventListener("pointerdown", (e) => {
        if (state === "paused") return;
        if (e.target === storeScreen) { playCloseOverlay(); storeScreen.classList.remove("show"); }
    });

    objectivesScreen.addEventListener("pointerdown", (e) => {
        if (state === "paused") return;
        if (e.target === objectivesScreen) { playCloseOverlay(); objectivesScreen.classList.remove("show"); }
    });

    // In-game taps (canvas)
    canvas.addEventListener("pointerdown", (e) => {
        if (state === "paused") return;
        if (e.type === "touchstart") e.preventDefault();
        ensureAudio();
        if (state === "playing") {
            stackBlock();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (state === "paused") return;
        if (e.code === "Space" || e.code === "Enter") {
            e.preventDefault();
            ensureAudio();
            if (state === "start") {
                startFromMenu();
            } else if (state === "playing") {
                stackBlock();
            }
        }
    });

    const loadingScreen = document.getElementById("loading-screen");

    restartBtn.addEventListener("click", (e) => {
        if (state === "paused") return;
        e.stopPropagation();
        ensureAudio();
        playCollect();

        // Award earned coins
        if (earnedCoins > 0) {
            coins += earnedCoins;
            saveCoins();
            earnedCoins = 0;
        }

        // Hide game over, show loading screen
        gameOverScreen.classList.remove("show");
        loadingScreen.classList.add("show");

        // Set up menu behind loading screen immediately
        returnToMenu();

        // Fade out loading screen quickly
        setTimeout(() => {
            loadingScreen.style.transition = "opacity 0.3s ease";
            loadingScreen.style.opacity = "0";
            setTimeout(() => {
                loadingScreen.classList.remove("show");
                loadingScreen.style.opacity = "";
                loadingScreen.style.transition = "";
            }, 300);
        }, 400);
    });

    // Prevent context menu on long press
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // ── Camera heightPct + project patch ───────────────────────
    ISO.heightPct = 0.54;

    ISO.project = function(x, y, z) {
        const cosY = Math.cos(this.angleY);
        const sinY = Math.sin(this.angleY);
        const cosX = Math.cos(this.angleX);
        const sinX = Math.sin(this.angleX);
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        const ry = y * cosX - rz * sinX;
        const s = this.scale * 55;
        return {
            x: W / 2 + rx * s,
            y: H * this.heightPct - ry * s,
            depth: y * sinX + rz * cosX,
        };
    };

    // ── Light / Dark mode toggle ─────────────────────────────
    function applyThemeUI() {
        const body = document.body;
        const menuTap = document.querySelector(".menu-tap");

        if (lightMode) {
            body.style.background = "#c8c4ba";
            scoreEl.style.color = "#222";
            scoreEl.style.textShadow = "0 2px 10px rgba(0,0,0,0.15)";
            comboEl.style.color = "#b8860b";
            comboEl.style.textShadow = "0 2px 8px rgba(184,134,11,0.3)";
            menuTap.style.color = "rgba(0,0,0,0.45)";
            menuBestEl.style.color = "rgba(0,0,0,0.35)";
            ingameBestEl.style.color = "rgba(0,0,0,0.35)";
            menuCoinsEl.style.color = "#b8860b";
        } else {
            body.style.background = "#1a1a2e";
            scoreEl.style.color = "white";
            scoreEl.style.textShadow = "0 4px 20px rgba(0,0,0,0.5)";
            comboEl.style.color = "#ffd700";
            comboEl.style.textShadow = "0 2px 10px rgba(255,215,0,0.5)";
            menuTap.style.color = "rgba(255,255,255,0.6)";
            menuBestEl.style.color = "rgba(255,255,255,0.4)";
            ingameBestEl.style.color = "rgba(255,255,255,0.4)";
            menuCoinsEl.style.color = "#ffd700";
        }
    }

    const menuThemeBtn = document.getElementById("btn-theme");
    const themeIcon = document.getElementById("theme-icon");

    function updateThemeLabels() {
        themeIcon.src = lightMode ? "moon.png" : "sun.png";
    }

    updateThemeLabels();
    applyThemeUI();

    function toggleTheme(e) {
        if (state === "paused") return;
        e.stopPropagation();
        ensureAudio();
        lightMode = !lightMode;
        updateThemeLabels();
        applyThemeUI();
        playThemeToggle();
    }

    menuThemeBtn.addEventListener("click", toggleTheme);

    // ── YouTube Playables SDK: firstFrameReady ─────────────────
    if (hasYTSDK) {
        try { ytgame.game.firstFrameReady(); } catch (_) {}
        window.__sdkSignaled = true;
    }

    // ── Cloud save load + splash screen ──────────────────────
    const splashScreen = document.getElementById("splash-screen");

    function finishInit(cloudData) {
        // Apply cloud data if available
        if (cloudData) {
            applyCloudData(cloudData);
            // Refresh displays
            updateBestDisplay();
            updateCoinDisplay();
            if (typeof applyThemeUI === 'function') applyThemeUI();
            initStartAnim();
        }
        cloudLoadDone = true;

        // Fade out splash
        if (splashScreen) {
            setTimeout(() => {
                splashScreen.classList.add("fade-out");
                setTimeout(() => {
                    splashScreen.remove();
                    // YouTube Playables: gameReady when player can interact
                    if (hasYTSDK) {
                        try { ytgame.game.gameReady(); } catch (_) {}
                    }
                }, 500);
            }, 1200);
        } else {
            if (hasYTSDK) {
                try { ytgame.game.gameReady(); } catch (_) {}
            }
        }
    }

    if (hasYTSDK) {
        loadCloudSave().then(finishInit).catch(() => finishInit(null));
    } else {
        finishInit(null);
    }

    // ── YouTube Playables SDK: Runtime hooks ─────────────────
    if (hasYTSDK) {
        // Audio state from SDK
        try {
            const audioEnabled = ytgame.system.isAudioEnabled();
            if (!audioEnabled) audioMuted = true;
        } catch (_) {}

        try {
            ytgame.system.onAudioEnabledChange((enabled) => {
                audioMuted = !enabled;
                if (!enabled && audioCtx) {
                    audioCtx.suspend();
                } else if (enabled && audioCtx) {
                    audioCtx.resume();
                }
            });
        } catch (_) {}

        // Pause/Resume from SDK
        const pauseOverlay = document.getElementById("pause-overlay");

        try {
            ytgame.system.onPause(() => {
                stateBeforePause = state;
                state = "paused";
                audioMuted = true;
                if (audioCtx) audioCtx.suspend();
                // Close any open overlays
                document.getElementById("store-screen").classList.remove("show");
                document.getElementById("objectives-screen").classList.remove("show");
                // Show pause overlay
                if (pauseOverlay) pauseOverlay.classList.add("show");
                saveToCloud();
            });
        } catch (_) {}

        try {
            ytgame.system.onResume(() => {
                // Hide pause overlay
                if (pauseOverlay) pauseOverlay.classList.remove("show");
                // Restore whatever state the game was in before pause
                if (stateBeforePause) {
                    state = stateBeforePause;
                    stateBeforePause = null;
                } else {
                    state = "start";
                }
                // If we resumed to menu, reset camera and re-init
                if (state === "start") {
                    cameraY = 0;
                    cameraTargetY = 0;
                    fallingPieces.length = 0;
                    particles.length = 0;
                    floatingTexts.length = 0;
                    current = null;
                    initStartAnim();
                }
                try {
                    const audioEnabled = ytgame.system.isAudioEnabled();
                    audioMuted = !audioEnabled;
                    if (audioEnabled && audioCtx) audioCtx.resume();
                } catch (_) {}
            });
        } catch (_) {}
    }

    // ── Start ─────────────────────────────────────────────────
    requestAnimationFrame(gameLoop);
})();
