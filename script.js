// --- POPUP DISCLAIMER LOGIC ---
const disclaimerPopup = document.getElementById('disclaimer-popup');
const closeDisclaimerBtn = document.getElementById('close-disclaimer-btn');

// Hide popup if it was dismissed in a previous session
if (localStorage.getItem('disclaimerDismissed') === 'true') {
    disclaimerPopup.style.display = 'none';
}

// Add event listener to the close button
closeDisclaimerBtn.addEventListener('click', () => {
    disclaimerPopup.style.display = 'none';
    // Use localStorage to remember that the user has closed the popup
    localStorage.setItem('disclaimerDismissed', 'true');
});


// --- SIMULATION CODE (UNCHANGED) ---
const canvas = document.getElementById('reactor-canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 15;
const COLS = 60;
const ROWS = 30;
canvas.width = COLS * GRID_SIZE;
canvas.height = ROWS * GRID_SIZE;

// --- DOM ELEMENTS ---
const neutronCountDisplay = document.getElementById('neutron-count');
const powerOutputDisplay = document.getElementById('power-output');
const powerLimitSlider = document.getElementById('power-limit');
const powerLimitValue = document.getElementById('power-limit-value');
const fuelSlider = document.getElementById('fuel-slider');
const fuelValue = document.getElementById('fuel-slider-value');
const manualOverrideCheckbox = document.getElementById('manual-override');
const manualRodControlContainer = document.getElementById('manual-rod-control-container');
const manualRodSlider = document.getElementById('manual-rod-slider');
const manualRodValue = document.getElementById('manual-rod-value');
const wipeXenonButton = document.getElementById('wipe-xenon');
const scramButton = document.getElementById('scram-button');
const injectNeutronsButton = document.getElementById('inject-neutrons');

// --- SIMULATION PARAMETERS ---
let powerLimit = parseInt(powerLimitSlider.value);
let fuelPercentage = parseInt(fuelSlider.value);
let isScrammed = false;
let isManualOverride = false;
let controlRodPosition = ROWS;
let waterCooldownTimer = [];


const WATER_HOT_THRESHOLD = 1.0; // The heat level at which water turns red and the timer starts
const WATER_COOLDOWN_FRAMES = 120; // 120 frames is approx. 2 seconds at 60fps
const GRAPHITE_TIP_LENGTH = 4;
const CONTROL_ROD_COLS = [7, 22, 37, 52];
const MODERATOR_WALL_COLS = [15, 30, 45, 59, 0];
const WATER_EVAPORATION_THRESHOLD = 2.0;
const FISSION_HEAT_GENERATION = 2.0;
const WATER_COOLING_FACTOR = 0.95;
const WATER_DIFFUSION_RATE = 0.1;
const XENON_DECAY_TIME = 4000;
const MAX_PARTICLES_TO_REFUEL = 2;

let grid = [];
let neutrons = [];
let waterTemp = [];

// --- PARTICLE CLASSES ---
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.isUranium = Math.random() < (fuelPercentage / 100);
        this.isSpent = false;
        this.isXenon = false;
        this.xenonDecayTimer = XENON_DECAY_TIME + Math.random() * (XENON_DECAY_TIME / 2);
    }

    draw() {
        let color = '#aaaaaa';
        if (this.isXenon) color = '#00ff73';
        else if (this.isUranium && !this.isSpent) color = '#4682B4';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x * GRID_SIZE + GRID_SIZE / 2, this.y * GRID_SIZE + GRID_SIZE / 2, GRID_SIZE / 3.5, 0, Math.PI * 2);
        ctx.fill();
    }

    refuel() {
        this.isUranium = true;
        this.isSpent = false;
        this.isXenon = false;
        this.xenonDecayTimer = XENON_DECAY_TIME + Math.random() * (XENON_DECAY_TIME / 2);
    }
}

class Neutron {
    constructor(x, y, isFast = true) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.isFast = isFast;
        this.thermalEnergy = 8; // Each neutron carries 8 units of heat to release
    }

    move() {
        const speedMultiplier = this.isFast ? 2 : 1;
        this.x += this.vx * speedMultiplier;
        this.y += this.vy * speedMultiplier;
        if (this.y <= 0 || this.y >= canvas.height) this.vy *= -1;
    }

    draw() {
        const radius = this.isFast ? 2.5 : 3;
        ctx.fillStyle = this.isFast ? 'white' : 'black';
        ctx.strokeStyle = this.isFast ? 'black' : 'white';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

// --- INITIALIZATION ---
function initialize() {
    isScrammed = false;
    scramButton.classList.remove('active');
    neutrons = [];
    grid = [];
    waterTemp = [];
    waterCooldownTimer = [];
    for (let y = 0; y < ROWS; y++) {
        grid[y] = [];
        waterTemp[y] = [];
        waterCooldownTimer[y] = [];
        for (let x = 0; x < COLS; x++) {
            grid[y][x] = new Particle(x, y);
            waterTemp[y][x] = 0;
            waterCooldownTimer[y][x] = 0;
        }
    }
}

// --- EVENT LISTENERS ---
powerLimitSlider.addEventListener('input', e => {
    powerLimit = parseInt(e.target.value);
    powerLimitValue.textContent = powerLimit;
});

fuelSlider.addEventListener('input', e => {
    fuelPercentage = parseInt(e.target.value);
    fuelValue.textContent = fuelPercentage;
});

manualOverrideCheckbox.addEventListener('change', e => {
    isManualOverride = e.target.checked;
    manualRodControlContainer.classList.toggle('hidden', !isManualOverride);
    if (isManualOverride) {
        manualRodSlider.value = (controlRodPosition / ROWS) * 100;
        manualRodValue.textContent = Math.round(manualRodSlider.value);
    }
});

manualRodSlider.addEventListener('input', e => {
    if (isManualOverride) {
        controlRodPosition = (parseInt(e.target.value) / 100) * ROWS;
    }
    manualRodValue.textContent = e.target.value;
});

wipeXenonButton.addEventListener('click', () => {
    grid.forEach(row => row.forEach(p => {
        if (p.isXenon) {
            p.isXenon = false;
            p.xenonDecayTimer = XENON_DECAY_TIME + Math.random() * (XENON_DECAY_TIME / 2);
        }
    }));
});

scramButton.addEventListener('click', () => {
    isScrammed = !isScrammed;
    scramButton.classList.toggle('active', isScrammed);
});

injectNeutronsButton.addEventListener('click', () => {
    const chambers = [
        { start: 1, end: 14 },
        { start: 16, end: 29 },
        { start: 31, end: 44 },
        { start: 46, end: 58 }
    ];

    chambers.forEach(chamber => {
        for (let i = 0; i < 5; i++) {
            const randomCol = chamber.start + Math.random() * (chamber.end - chamber.start);
            const x = randomCol * GRID_SIZE;
            const y = Math.random() * canvas.height;
            neutrons.push(new Neutron(x, y, true));
        }
    });
});


// --- UPDATE & DRAW FUNCTIONS ---
function updateAndDrawGridAndWater() {
    ctx.fillStyle = '#d6e4f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let newWaterTemp = waterTemp.map(arr => arr.slice());
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (waterCooldownTimer[y][x] > 0) {
                waterCooldownTimer[y][x]--;
                if (waterCooldownTimer[y][x] === 0) {
                    newWaterTemp[y][x] = WATER_HOT_THRESHOLD - 0.1;
                }
            } else {
                newWaterTemp[y][x] *= WATER_COOLING_FACTOR;
            }

            let neighborSum = 0;
            let neighborCount = 0;
            if (y > 0) { neighborSum += waterTemp[y - 1][x]; neighborCount++; }
            if (y < ROWS - 1) { neighborSum += waterTemp[y + 1][x]; neighborCount++; }
            if (x > 0) { neighborSum += waterTemp[y][x - 1]; neighborCount++; }
            if (x < COLS - 1) { neighborSum += waterTemp[y][x + 1]; neighborCount++; }

            if (neighborCount > 0) {
                const avgTemp = neighborSum / neighborCount;
                newWaterTemp[y][x] += (avgTemp - waterTemp[y][x]) * WATER_DIFFUSION_RATE;
            }
        }
    }
    waterTemp = newWaterTemp;


    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const temp = waterTemp[y][x];
            if (temp >= WATER_EVAPORATION_THRESHOLD) {
                ctx.strokeStyle = '#FF4500';
                ctx.lineWidth = 2;
                ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            } else if (temp >= WATER_HOT_THRESHOLD) {
                ctx.fillStyle = `rgb(255, 99, 71)`;
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            } else if (temp > 0.01) {
                const r = Math.floor(202 + (255 - 202) * (temp / WATER_HOT_THRESHOLD));
                const g = Math.floor(233 - (233 - 99) * (temp / WATER_HOT_THRESHOLD));
                const b = Math.floor(255 - (255 - 71) * (temp / WATER_HOT_THRESHOLD));
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }

            const particle = grid[y][x];
            if (particle.isSpent && !particle.isXenon && --particle.xenonDecayTimer <= 0) {
                particle.isXenon = true;
            }
            particle.draw();
        }
    }
}

function drawModeratorWalls() {
    ctx.fillStyle = '#777';
    MODERATOR_WALL_COLS.forEach(x => {
        ctx.fillRect(x * GRID_SIZE, 0, GRID_SIZE, canvas.height);
    });
}

function updateAndDrawRods() {
    handleRodMovement();
    const rodHeight = controlRodPosition * GRID_SIZE;
    if (rodHeight <= 0) return;

    CONTROL_ROD_COLS.forEach(x => {
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(x * GRID_SIZE, 0, GRID_SIZE, rodHeight);
        ctx.fillStyle = 'rgba(150, 150, 150, 0.9)';
        ctx.fillRect(x * GRID_SIZE, rodHeight, GRID_SIZE, GRAPHITE_TIP_LENGTH * GRID_SIZE);
    });
}

function handleRodMovement() {
    if (isScrammed) {
        controlRodPosition = Math.min(ROWS, controlRodPosition + 0.5);
    } else if (!isManualOverride) {
        if (neutrons.length > powerLimit && controlRodPosition < ROWS) {
            controlRodPosition += 0.05;
        } else if (neutrons.length < powerLimit && controlRodPosition > 0) {
            controlRodPosition -= 0.1;
        }
    }
    controlRodPosition = Math.max(0, Math.min(ROWS, controlRodPosition));
}

function handleNeutrons() {
    for (let i = neutrons.length - 1; i >= 0; i--) {
        const n = neutrons[i];

        const prevGridX = Math.floor(n.x / GRID_SIZE);
        n.move();
        const gridX = Math.floor(n.x / GRID_SIZE);
        const gridY = Math.floor(n.y / GRID_SIZE);

        if (gridX < 0 || gridX >= COLS || gridY < 0 || gridY >= ROWS) {
            if (n.x <= 0 || n.x >= canvas.width) {
                neutrons.splice(i, 1);
                continue;
            }
            continue;
        };

        const particle = grid[gridY][gridX];
        const isControlRodColumn = CONTROL_ROD_COLS.includes(gridX);
        const isModeratorWall = MODERATOR_WALL_COLS.includes(gridX);
        const rodTipStart = controlRodPosition;
        const rodTipEnd = controlRodPosition + GRAPHITE_TIP_LENGTH;

        if (isModeratorWall && !MODERATOR_WALL_COLS.includes(prevGridX)) {
            if (n.isFast) {
                n.isFast = false;
            }
            n.vx *= -1;
            n.x += n.vx;
        }

        if (n.isFast) {
            if (isControlRodColumn && gridY >= rodTipStart && gridY < rodTipEnd) {
                if (Math.random() < 0.90) n.isFast = false;
            } else if (waterTemp[gridY][gridX] < WATER_EVAPORATION_THRESHOLD && Math.random() < 0.005) {
                n.isFast = false;
            }
        }
        
        if (!n.isFast && n.thermalEnergy > 0 && Math.random() < 0.5) {
            n.thermalEnergy--;
            const currentHeat = waterTemp[gridY][gridX] + 1.0;
            waterTemp[gridY][gridX] = currentHeat;

            if (currentHeat >= WATER_HOT_THRESHOLD && waterCooldownTimer[gridY][gridX] === 0) {
                waterCooldownTimer[gridY][gridX] = WATER_COOLDOWN_FRAMES;
            }
        }

        if (isControlRodColumn && gridY < controlRodPosition) {
            neutrons.splice(i, 1);
            continue;
        }

        if (particle.isXenon && Math.random() < 0.3) {
            neutrons.splice(i, 1);
            particle.isXenon = false;
            particle.isSpent = false;
            particle.xenonDecayTimer = XENON_DECAY_TIME + Math.random() * (XENON_DECAY_TIME / 2);
            continue;
        }

        if (particle.isUranium && !particle.isSpent && !n.isFast && Math.random() < 0.6) {
            particle.isSpent = true;
            neutrons.splice(i, 1);
            for (let j = 0; j < (Math.random() < 0.5 ? 2 : 3); j++) {
                neutrons.push(new Neutron(n.x, n.y, true));
            }

            const currentHeat = waterTemp[gridY][gridX] + FISSION_HEAT_GENERATION;
            waterTemp[gridY][gridX] = currentHeat;

            if (currentHeat >= WATER_HOT_THRESHOLD && waterCooldownTimer[gridY][gridX] === 0) {
                waterCooldownTimer[gridY][gridX] = WATER_COOLDOWN_FRAMES;
            }
            continue;
        }

        n.draw();
    }
}

function manageFuelCycle() {
    let activeUraniumCount = 0;
    let spentOrEmptyParticles = [];

    grid.forEach(row => row.forEach(p => {
        if (p.isUranium && !p.isSpent) {
            activeUraniumCount++;
        }
        if (!p.isUranium || (p.isSpent && !p.isXenon)) {
            spentOrEmptyParticles.push(p);
        }
    }));

    const currentFuelPercentage = (activeUraniumCount / (ROWS * COLS)) * 100;
    
    if (currentFuelPercentage < fuelPercentage && spentOrEmptyParticles.length > 0) {
        for (let i = 0; i < MAX_PARTICLES_TO_REFUEL; i++) {
            if (spentOrEmptyParticles.length === 0) break;
            const randomIndex = Math.floor(Math.random() * spentOrEmptyParticles.length);
            spentOrEmptyParticles[randomIndex].refuel();
            spentOrEmptyParticles.splice(randomIndex, 1);
        }
    }
}


function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateAndDrawGridAndWater();
    drawModeratorWalls();
    updateAndDrawRods();
    handleNeutrons();
    manageFuelCycle();

    const currentNeutrons = neutrons.length;
    const estimatedPower = Math.round(currentNeutrons * 22.85);
    neutronCountDisplay.textContent = currentNeutrons;
    powerOutputDisplay.textContent = `${estimatedPower} MW`;

    requestAnimationFrame(animate);
}

initialize();
animate();