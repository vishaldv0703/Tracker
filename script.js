// Step Counter Application
class StepCounter {
    constructor() {
        this.steps = 0;
        this.isRunning = false;
        this.startTime = null;
        this.timer = null;
        this.goal = 10000;
        this.strideLength = 70; // cm
        this.weight = 70; // kg
        // Motion detection state
        this.motionSupported = false;
        this.gravity = { x: 0, y: 0, z: 0 };
        this.alpha = 0.8; // low-pass filter factor for gravity
        this.lastStepTimestamp = 0;
        this.minStepIntervalMs = 300; // debounce between steps
        this.stepThreshold = 1.2; // m/s^2 threshold after high-pass
        this.achievements = {
            1000: false,
            5000: false,
            10000: false,
            15000: false
        };
        
        this.initializeElements();
        this.bindEvents();
        this.loadData();
        this.updateDisplay();
        this.initializeTheme();
    }

    initializeElements() {
        // Main elements
        this.stepCountEl = document.getElementById('stepCount');
        this.caloriesEl = document.getElementById('calories');
        this.distanceEl = document.getElementById('distance');
        this.timeEl = document.getElementById('time');
        this.goalEl = document.getElementById('goal');
        this.goalPercentageEl = document.getElementById('goalPercentage');
        this.goalFillEl = document.getElementById('goalFill');
        
        // Control buttons
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.themeBtn = document.getElementById('themeBtn');
        
        // Settings
        this.stepGoalInput = document.getElementById('stepGoal');
        this.strideLengthInput = document.getElementById('strideLength');
        this.weightInput = document.getElementById('weight');
        
        // Progress ring
        this.progressRing = document.querySelector('.progress-ring-circle');
        this.radius = this.progressRing.r.baseVal.value;
        this.circumference = this.radius * 2 * Math.PI;
        this.progressRing.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.progressRing.style.strokeDashoffset = this.circumference;
    }

    bindEvents() {
        // Control buttons
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.themeBtn.addEventListener('click', () => this.toggleTheme());
        
        // Settings
        this.stepGoalInput.addEventListener('change', (e) => {
            this.goal = parseInt(e.target.value);
            this.saveData();
            this.updateDisplay();
        });
        
        this.strideLengthInput.addEventListener('change', (e) => {
            this.strideLength = parseInt(e.target.value);
            this.saveData();
            this.updateDisplay();
        });
        
        this.weightInput.addEventListener('change', (e) => {
            this.weight = parseInt(e.target.value);
            this.saveData();
            this.updateDisplay();
        });
        
        // Prefer real motion-based detection; fall back to simulation
        this.setupMotionDetection();
        this.setupStepSimulationFallback();
    }

    setupStepSimulationFallback() {
        // Simulate steps by detecting spacebar press or mouse clicks
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && this.isRunning) {
                e.preventDefault();
                this.addStep();
            }
        });
        
        // Add step on button click for mobile
        this.startBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.addStep();
            }
        });
        
        // Simulate automatic step detection (for demo purposes)
        this.autoStepInterval = setInterval(() => {
            if (this.isRunning && Math.random() < 0.3) {
                this.addStep();
            }
        }, 2000);
    }

    async setupMotionDetection() {
        // Check for sensor availability
        const hasDeviceMotion = 'DeviceMotionEvent' in window;
        if (!hasDeviceMotion) {
            this.motionSupported = false;
            return;
        }

        // On iOS, permission is required and only works on https or localhost
        const needsPermission = typeof DeviceMotionEvent.requestPermission === 'function';
        const requestPermissionIfNeeded = async () => {
            try {
                if (needsPermission) {
                    const response = await DeviceMotionEvent.requestPermission();
                    return response === 'granted';
                }
                return true;
            } catch {
                return false;
            }
        };

        const enableMotion = async () => {
            const granted = await requestPermissionIfNeeded();
            if (!granted) {
                this.motionSupported = false;
                return;
            }
            this.motionSupported = true;
            window.addEventListener('devicemotion', (e) => this.onDeviceMotion(e));
        };

        // Request/enable when user presses Start (user gesture requirement)
        this.startBtn.addEventListener('click', () => {
            if (!this.motionSupported) {
                enableMotion();
            }
        }, { once: false });
    }

    onDeviceMotion(event) {
        if (!this.isRunning) return;
        const acc = event.accelerationIncludingGravity || event.acceleration;
        if (!acc) return;

        // Low-pass filter to estimate gravity, then high-pass to get linear acceleration
        const gx = this.gravity.x = this.alpha * this.gravity.x + (1 - this.alpha) * (acc.x || 0);
        const gy = this.gravity.y = this.alpha * this.gravity.y + (1 - this.alpha) * (acc.y || 0);
        const gz = this.gravity.z = this.alpha * this.gravity.z + (1 - this.alpha) * (acc.z || 0);

        const linX = (acc.x || 0) - gx;
        const linY = (acc.y || 0) - gy;
        const linZ = (acc.z || 0) - gz;

        const magnitude = Math.sqrt(linX * linX + linY * linY + linZ * linZ);

        const now = performance.now();
        if (magnitude > this.stepThreshold && (now - this.lastStepTimestamp) > this.minStepIntervalMs) {
            this.lastStepTimestamp = now;
            this.addStep();
        }
    }

    start() {
        this.isRunning = true;
        this.startTime = this.startTime || new Date();
        
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;
        
        this.startBtn.innerHTML = '<i class="fas fa-play"></i><span>Add Step</span>';
        
        this.startTimer();
        this.saveData();
    }

    pause() {
        this.isRunning = false;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        this.startBtn.innerHTML = '<i class="fas fa-play"></i><span>Resume</span>';
        
        clearInterval(this.timer);
        this.saveData();
    }

    reset() {
        this.isRunning = false;
        this.steps = 0;
        this.startTime = null;
        
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        this.startBtn.innerHTML = '<i class="fas fa-play"></i><span>Start</span>';
        
        clearInterval(this.timer);
        this.updateDisplay();
        this.saveData();
    }

    addStep() {
        this.steps++;
        this.updateDisplay();
        this.checkAchievements();
        this.saveData();
        
        // Add visual feedback
        this.animateStep();
    }

    animateStep() {
        const stepCircle = document.querySelector('.step-circle');
        stepCircle.style.transform = 'scale(1.1)';
        setTimeout(() => {
            stepCircle.style.transform = 'scale(1)';
        }, 150);
    }

    startTimer() {
        this.timer = setInterval(() => {
            this.updateDisplay();
        }, 1000);
    }

    updateDisplay() {
        // Update step count
        this.stepCountEl.textContent = this.steps.toLocaleString();
        
        // Update goal
        this.goalEl.textContent = this.goal.toLocaleString();
        
        // Calculate and update other metrics
        const distance = this.calculateDistance();
        const calories = this.calculateCalories();
        const time = this.calculateTime();
        
        this.distanceEl.textContent = distance.toFixed(1);
        this.caloriesEl.textContent = Math.round(calories);
        this.timeEl.textContent = time;
        
        // Update progress
        this.updateProgress();
    }

    calculateDistance() {
        return (this.steps * this.strideLength) / 100000; // Convert cm to km
    }

    calculateCalories() {
        // Improved calorie estimation using METs based on cadence from steps and elapsed time.
        // 1 MET kcal/min = 3.5 * weight(kg) * VO2(ml/kg/min) / 200; here we map cadence -> METs
        // Approximate cadence (steps/min)
        const minutes = this.startTime ? Math.max(1 / 60, (new Date() - this.startTime) / 60000) : 0;
        if (!minutes) return 0;
        const cadence = this.steps / minutes;

        // Map cadence to walking intensity METs
        // <60 spm: light 2.0 MET, 60-80: 2.5 MET, 80-100: 3.0 MET, 100-120: 3.8 MET, >120: 4.3 MET
        let mets = 2.0;
        if (cadence >= 60 && cadence < 80) mets = 2.5;
        else if (cadence >= 80 && cadence < 100) mets = 3.0;
        else if (cadence >= 100 && cadence < 120) mets = 3.8;
        else if (cadence >= 120) mets = 4.3;

        // kcal = METs * weight(kg) * time(hours)
        const hours = minutes / 60;
        const kcal = mets * this.weight * hours;
        return kcal;
    }

    calculateTime() {
        if (!this.startTime) return '00:00:00';
        
        const now = new Date();
        const diff = now - this.startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateProgress() {
        const percentage = Math.min((this.steps / this.goal) * 100, 100);
        this.goalPercentageEl.textContent = `${Math.round(percentage)}%`;
        this.goalFillEl.style.width = `${percentage}%`;
        
        // Update progress ring
        const offset = this.circumference - (percentage / 100) * this.circumference;
        this.progressRing.style.strokeDashoffset = offset;
    }

    checkAchievements() {
        const achievementSteps = [1000, 5000, 10000, 15000];
        
        achievementSteps.forEach(stepCount => {
            if (this.steps >= stepCount && !this.achievements[stepCount]) {
                this.unlockAchievement(stepCount);
            }
        });
    }

    unlockAchievement(stepCount) {
        this.achievements[stepCount] = true;
        const badge = document.getElementById(`badge-${stepCount}`);
        badge.classList.add('unlocked');
        
        // Show celebration
        this.showCelebration(stepCount);
    }

    showCelebration(stepCount) {
        // Create celebration effect
        const celebration = document.createElement('div');
        celebration.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #f093fb, #4facfe);
            color: white;
            padding: 20px 40px;
            border-radius: 15px;
            font-size: 1.2rem;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            animation: celebration 0.6s ease;
        `;
        
        const achievementNames = {
            1000: 'First Steps!',
            5000: 'Getting Started!',
            10000: 'Goal Master!',
            15000: 'Overachiever!'
        };
        
        celebration.textContent = `🎉 ${achievementNames[stepCount]} 🎉`;
        document.body.appendChild(celebration);
        
        setTimeout(() => {
            celebration.remove();
        }, 3000);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const order = ['light', 'dark'];
        const next = order[(order.indexOf(currentTheme) + 1) % order.length];

        document.documentElement.setAttribute('data-theme', next);

        const icon = this.themeBtn.querySelector('i');
        if (next === 'dark') icon.className = 'fas fa-sun';
        else icon.className = 'fas fa-moon';

        localStorage.setItem('theme', next);
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const icon = this.themeBtn.querySelector('i');
        if (savedTheme === 'dark') icon.className = 'fas fa-sun';
        else icon.className = 'fas fa-moon';
    }

    saveData() {
        const data = {
            steps: this.steps,
            isRunning: this.isRunning,
            startTime: this.startTime,
            goal: this.goal,
            strideLength: this.strideLength,
            weight: this.weight,
            achievements: this.achievements
        };
        
        localStorage.setItem('stepCounterData', JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem('stepCounterData');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.steps = data.steps || 0;
            this.isRunning = data.isRunning || false;
            this.startTime = data.startTime ? new Date(data.startTime) : null;
            this.goal = data.goal || 10000;
            this.strideLength = data.strideLength || 70;
            this.weight = data.weight || 70;
            this.achievements = data.achievements || {
                1000: false,
                5000: false,
                10000: false,
                15000: false
            };
            
            // Update settings inputs
            this.stepGoalInput.value = this.goal;
            this.strideLengthInput.value = this.strideLength;
            this.weightInput.value = this.weight;
            
            // Update button states
            if (this.isRunning) {
                this.startBtn.disabled = true;
                this.pauseBtn.disabled = false;
                this.startBtn.innerHTML = '<i class="fas fa-play"></i><span>Add Step</span>';
                this.startTimer();
            }
            
            // Update achievement badges
            Object.keys(this.achievements).forEach(stepCount => {
                if (this.achievements[stepCount]) {
                    const badge = document.getElementById(`badge-${stepCount}`);
                    badge.classList.add('unlocked');
                }
            });
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new StepCounter();
});

// Add some additional CSS animations via JavaScript
const style = document.createElement('style');
style.textContent = `
    @keyframes celebration {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    
    .step-circle {
        transition: transform 0.15s ease;
    }
    
    .stat-card {
        transition: all 0.3s ease;
    }
    
    .badge {
        transition: all 0.3s ease;
    }
`;
document.head.appendChild(style);

