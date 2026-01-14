const FrameStore = {
    KEY: 'onionmotion_frames',

    getFrames() {
        const data = localStorage.getItem(this.KEY);
        return data ? JSON.parse(data) : [];
    },

    saveFrames(frames) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(frames));
            window.dispatchEvent(new CustomEvent('framesUpdated', { detail: frames }));
        } catch (err) {
            console.error('Saving frames failed', err);
            alert('Cannot save: Storage full or blocked. Please delete some frames.');
            throw err;
        }
    },

    addFrame(dataUrl) {
        const frames = this.getFrames();
        const newFrame = {
            id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            dataUrl: dataUrl,
            timestamp: Date.now()
        };
        frames.push(newFrame);
        this.saveFrames(frames);
        return newFrame;
    },

    deleteFrame(id) {
        const frames = this.getFrames().filter(f => f.id !== id);
        this.saveFrames(frames);
    },

    reorderFrames(fromIndex, toIndex) {
        const frames = this.getFrames();
        const [removed] = frames.splice(fromIndex, 1);
        frames.splice(toIndex, 0, removed);
        this.saveFrames(frames);
    },

    clearAll() {
        this.saveFrames([]);
    }
};

async function compressImage(dataUrl, maxSize = 800, quality = 0.55) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            const scale = Math.min(1, maxSize / Math.max(width, height));
            width = Math.round(width * scale);
            height = Math.round(height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            try {
                const webp = canvas.toDataURL('image/webp', quality);
                if (webp && webp.length < dataUrl.length) {
                    resolve(webp);
                    return;
                }
            } catch (e) {}

            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

let capture;
let lastFrameImg;
let onionOpacity = 75;
let showOnionSkin = true;
let cameraReady = false;
let cameraError = null;
let flashAlpha = 0;

function setupCameraSketch() {
    const container = document.getElementById('p5-canvas-container');
    if (!container) return;

    const sketch = (p) => {

        p.setup = function() {
            const canvas = p.createCanvas(640, 480);
            canvas.parent('p5-canvas-container');

            capture = p.createCapture(p.VIDEO,
                (stream) => {
                    cameraReady = true;
                    cameraError = null;
                    hideError();
                    enableCaptureButton(true);
                    console.log('✅ Camera started successfully with p5.js');
                }
            );

            capture.elt.onerror = (err) => {
                cameraError = err;
                cameraReady = false;
                showError('Camera access failed. Please allow access in browser settings.');
                enableCaptureButton(false);
            };

            capture.hide();

            p.pixelDensity(1);

            loadLastFrame(p);
        };

        p.draw = function() {
            p.background(20);

            if (cameraReady && capture) {
                p.push();
                p.translate(p.width, 0);
                p.scale(-1, 1);
                p.image(capture, 0, 0, p.width, p.height);
                p.pop();

                if (showOnionSkin && lastFrameImg) {
                    p.push();
                    p.tint(255, onionOpacity);
                    p.image(lastFrameImg, 0, 0, p.width, p.height);
                    p.pop();
                }

                if (flashAlpha > 0) {
                    p.push();
                    p.fill(255, flashAlpha);
                    p.noStroke();
                    p.rect(0, 0, p.width, p.height);
                    p.pop();
                    flashAlpha -= 15;
                }

            } else {
                p.fill(150);
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(18);
                if (cameraError) {
                    p.text('⚠️ Camera not available', p.width/2, p.height/2);
                } else {
                    p.text('📷 Loading camera...', p.width/2, p.height/2);
                }
            }
        };

        p.captureFrame = async function() {
            if (!cameraReady || !capture) return;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = capture.width || 640;
            tempCanvas.height = capture.height || 480;
            const ctx = tempCanvas.getContext('2d');

            ctx.translate(tempCanvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(capture.elt, 0, 0, tempCanvas.width, tempCanvas.height);

            const rawDataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);
            const dataUrl = await compressImage(rawDataUrl, 800, 0.55);
            FrameStore.addFrame(dataUrl);

            p.loadImage(dataUrl, (img) => {
                lastFrameImg = img;
            });

            flashAlpha = 200;

            updateCameraUI();
        };

        p.setOnionOpacity = function(value) {
            onionOpacity = Math.round(value * 255);
        };

        p.toggleOnionSkin = function() {
            showOnionSkin = !showOnionSkin;
            return showOnionSkin;
        };

        function loadLastFrame(p) {
            const frames = FrameStore.getFrames();
            if (frames.length > 0) {
                const lastFrame = frames[frames.length - 1];
                p.loadImage(lastFrame.dataUrl, (img) => {
                    lastFrameImg = img;
                    console.log('✅ Last frame loaded for Onion Skin');
                });
            }
        }
    };

    window.p5Instance = new p5(sketch);
}

function showError(message) {
    const errorBox = document.getElementById('camera-error');
    const retryBox = document.getElementById('camera-retry');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }
    if (retryBox) retryBox.style.display = 'block';
}

function hideError() {
    const errorBox = document.getElementById('camera-error');
    const retryBox = document.getElementById('camera-retry');
    if (errorBox) errorBox.style.display = 'none';
    if (retryBox) retryBox.style.display = 'none';
}

function enableCaptureButton(enabled) {
    const btn = document.getElementById('btn-capture');
    if (btn) btn.disabled = !enabled;
}

function updateCameraUI() {
    const frames = FrameStore.getFrames();

    const counter = document.getElementById('frame-counter');
    if (counter) counter.textContent = `Frames: ${frames.length}`;

    renderTimeline(frames);

    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) {
        previewBtn.style.display = frames.length > 0 ? 'flex' : 'none';
    }

    const onionControls = document.getElementById('onion-controls');
    if (onionControls) {
        onionControls.style.display = frames.length > 0 ? 'block' : 'none';
    }
}

function renderTimeline(frames) {
    const container = document.getElementById('timeline-content');
    if (!container) return;

    if (frames.length === 0) {
        container.innerHTML = `
            <div class="timeline-empty">
                <div class="empty-icon">📷</div>
                <p class="empty-text">No frames yet</p>
                <p class="empty-hint">Start capturing!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = frames.map((frame, index) => `
        <div class="timeline-frame" data-id="${frame.id}">
            <span class="frame-number">#${index + 1}</span>
            <img src="${frame.dataUrl}" alt="Frame ${index + 1}" class="frame-thumb">
            <span class="frame-time">${new Date(frame.timestamp).toLocaleTimeString()}</span>
        </div>
    `).join('');
}

function setupCameraControls() {
    const captureBtn = document.getElementById('btn-capture');
    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            if (window.p5Instance) {
                window.p5Instance.captureFrame();
            }
        });
    }

    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (window.p5Instance) {
                window.p5Instance.remove();
            }
            setupCameraSketch();
        });
    }

    const onionToggle = document.getElementById('btn-onion-toggle');
    if (onionToggle) {
        onionToggle.addEventListener('click', () => {
            if (window.p5Instance) {
                const isVisible = window.p5Instance.toggleOnionSkin();
                onionToggle.textContent = isVisible ? 'Hide Onion Skin' : 'Show Onion Skin';
            }
        });
    }

    const opacitySlider = document.getElementById('onion-opacity');
    const opacityValue = document.getElementById('opacity-value');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (opacityValue) opacityValue.textContent = Math.round(value * 100) + '%';
            if (window.p5Instance) {
                window.p5Instance.setOnionOpacity(value);
            }
        });
    }

    const closeBtn = document.getElementById('btn-close-camera');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (window.p5Instance) {
                window.p5Instance.remove();
            }
            window.location.href = '/homepage';
        });
    }

    const previewBtn = document.getElementById('btn-preview');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            window.location.href = '/videopage';
        });
    }
}

const UploadModule = {
    init() {
        this.setupUploadHandlers();
    },

    setupUploadHandlers() {
        const uploadInput = document.getElementById('upload-input');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        }

        const addMoreInput = document.getElementById('add-more-input');
        if (addMoreInput) {
            addMoreInput.addEventListener('change', (e) => this.handleFiles(e.target.files));
        }

        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                this.handleFiles(e.dataTransfer.files);
            });
        }
    },

    handleFiles(files) {
        if (!files || files.length === 0) return;

        const tasks = Array.from(files).map(file => this.processFile(file));

        Promise.all(tasks)
            .then(() => {
                if (window.location.pathname === '/homepage') {
                    setTimeout(() => window.location.href = '/frames', 500);
                }
            })
            .catch(err => console.error('Upload failed', err));
    },

    async processFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        const dataUrl = await this.readFileAsDataUrl(file);
        const compressed = await compressImage(dataUrl, 1280, 0.7);
        FrameStore.addFrame(compressed);
        if (typeof FramesPageModule !== 'undefined') {
            FramesPageModule.updateUI();
        }
    },

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};

const FramesPageModule = {
    draggedIndex: null,

    init() {
        this.setupControls();
        this.updateUI();
    },

    setupControls() {
        const backBtn = document.getElementById('btn-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => window.location.href = '/homepage');
        }

        const cameraBtn = document.getElementById('btn-camera');
        if (cameraBtn) {
            cameraBtn.addEventListener('click', () => window.location.href = '/');
        }

        const createBtn = document.getElementById('btn-create');
        if (createBtn) {
            createBtn.addEventListener('click', () => window.location.href = '/videopage');
        }

        const clearBtn = document.getElementById('btn-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (confirm('Do you really want to delete all frames?')) {
                    FrameStore.clearAll();
                    this.updateUI();
                }
            });
        }
    },

    updateUI() {
        const frames = FrameStore.getFrames();
        const grid = document.getElementById('frames-grid');
        const createBtn = document.getElementById('btn-create');
        const clearBtn = document.getElementById('btn-clear');

        if (!grid) return;

        if (createBtn) {
            createBtn.disabled = frames.length === 0;
            createBtn.textContent = `Create Animation (${frames.length} frames)`;
        }
        if (clearBtn) {
            clearBtn.disabled = frames.length === 0;
        }

        if (frames.length === 0) {
            grid.innerHTML = `
                <div class="frames-empty">
                    <div class="empty-icon">🖼️</div>
                    <p class="empty-text">No frames yet</p>
                    <p class="empty-hint">Upload images to get started</p>
                </div>
            `;
            grid.classList.add('empty');
            return;
        }

        grid.classList.remove('empty');
        grid.innerHTML = frames.map((frame, index) => `
            <div class="frame-card" draggable="true" data-index="${index}" data-id="${frame.id}">
                <div class="frame-number">#${index + 1}</div>
                <div class="btn-drag">⋮⋮</div>
                <img src="${frame.dataUrl}" alt="Frame ${index + 1}" class="frame-image">
                <button class="btn-delete" data-id="${frame.id}">🗑️</button>
            </div>
        `).join('');

        this.setupDragAndDrop();
        this.setupDeleteButtons();
    },

    setupDragAndDrop() {
        const cards = document.querySelectorAll('.frame-card');

        cards.forEach(card => {
            card.addEventListener('dragstart', () => {
                this.draggedIndex = parseInt(card.dataset.index);
                card.classList.add('dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this.draggedIndex = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (this.draggedIndex === null) return;

                const targetIndex = parseInt(card.dataset.index);
                if (this.draggedIndex !== targetIndex) {
                    FrameStore.reorderFrames(this.draggedIndex, targetIndex);
                    this.draggedIndex = targetIndex;
                    this.updateUI();
                }
            });
        });
    },

    setupDeleteButtons() {
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                FrameStore.deleteFrame(btn.dataset.id);
                this.updateUI();
            });
        });
    }
};

const VideoPlayerModule = {
    frames: [],
    currentIndex: 0,
    fps: 12,
    isPlaying: false,
    loop: true,
    intervalId: null,

    init() {
        this.frames = FrameStore.getFrames();

        if (this.frames.length === 0) {
            window.location.href = '/homepage';
            return;
        }

        this.setupControls();
        this.updateUI();
        this.renderFrame();
    },

    setupControls() {
        const playBtn = document.getElementById('btn-play');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.togglePlay());
        }

        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }

        const downloadBtn = document.getElementById('btn-download');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadVideo());
        }

        const loopCheckbox = document.getElementById('loop-checkbox');
        if (loopCheckbox) {
            loopCheckbox.checked = this.loop;
            loopCheckbox.addEventListener('change', (e) => {
                this.loop = e.target.checked;
            });
        }

        const progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.max = this.frames.length - 1;
            progressSlider.addEventListener('input', (e) => {
                this.pause();
                this.currentIndex = parseInt(e.target.value);
                this.renderFrame();
            });
        }

        const fpsSlider = document.getElementById('fps-slider');
        const fpsValue = document.getElementById('fps-value');
        const durationValue = document.getElementById('duration-value');

        if (fpsSlider) {
            fpsSlider.value = this.fps;
            fpsSlider.addEventListener('input', (e) => {
                this.fps = parseInt(e.target.value);
                if (fpsValue) fpsValue.textContent = `${this.fps} FPS`;
                if (durationValue) durationValue.textContent = `~${(this.frames.length / this.fps).toFixed(1)}s`;

                if (this.isPlaying) {
                    this.pause();
                    this.play();
                }
            });
        }

        const backBtn = document.getElementById('btn-back');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this.pause();
                window.location.href = '/frames';
            });
        }
    },

    play() {
        if (this.frames.length === 0) return;

        this.isPlaying = true;
        this.updatePlayButton();

        const interval = 1000 / this.fps;
        this.intervalId = setInterval(() => {
            this.currentIndex++;

            if (this.currentIndex >= this.frames.length) {
                if (this.loop) {
                    this.currentIndex = 0;
                } else {
                    this.currentIndex = this.frames.length - 1;
                    this.pause();
                    return;
                }
            }

            this.renderFrame();
        }, interval);
    },

    pause() {
        this.isPlaying = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.updatePlayButton();
    },

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    reset() {
        this.pause();
        this.currentIndex = 0;
        this.renderFrame();
    },

    updatePlayButton() {
        const btn = document.getElementById('btn-play');
        if (btn) {
            btn.innerHTML = this.isPlaying ? '⏸ Pause' : '▶ Play';
        }
    },

    renderFrame() {
        const frame = this.frames[this.currentIndex];
        if (!frame) return;

        const display = document.getElementById('video-display');
        if (display) {
            display.src = frame.dataUrl;
        }

        const indicator = document.getElementById('frame-indicator');
        if (indicator) {
            indicator.textContent = `Frame ${this.currentIndex + 1} / ${this.frames.length}`;
        }

        const progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.value = this.currentIndex;
        }

        document.querySelectorAll('.timeline-frame').forEach((el, idx) => {
            el.classList.toggle('active', idx === this.currentIndex);
        });
    },

    updateUI() {
        const timeline = document.getElementById('timeline-frames');
        if (timeline) {
            timeline.innerHTML = this.frames.map((frame, index) => `
                <div class="timeline-frame ${index === this.currentIndex ? 'active' : ''}" 
                     data-index="${index}">
                    <span class="frame-number">#${index + 1}</span>
                    <img src="${frame.dataUrl}" alt="Frame ${index + 1}" class="frame-thumb">
                    <span class="frame-time">${(index / this.fps).toFixed(2)}s</span>
                    <button class="btn-delete-frame" data-id="${frame.id}">🗑️</button>
                </div>
            `).join('');

            timeline.querySelectorAll('.timeline-frame').forEach(el => {
                el.addEventListener('click', (e) => {
                    if (e.target.closest('.btn-delete-frame')) return;
                    this.pause();
                    this.currentIndex = parseInt(el.dataset.index);
                    this.renderFrame();
                });
            });

            timeline.querySelectorAll('.btn-delete-frame').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.frames.length <= 1) {
                        alert('At least one frame is required!');
                        return;
                    }
                    FrameStore.deleteFrame(btn.dataset.id);
                    this.frames = FrameStore.getFrames();
                    if (this.currentIndex >= this.frames.length) {
                        this.currentIndex = this.frames.length - 1;
                    }
                    this.updateUI();
                    this.renderFrame();
                });
            });
        }

        const durationValue = document.getElementById('duration-value');
        if (durationValue) {
            durationValue.textContent = `~${(this.frames.length / this.fps).toFixed(1)}s`;
        }

        const progressSlider = document.getElementById('progress-slider');
        if (progressSlider) {
            progressSlider.max = this.frames.length - 1;
        }
    },

    async downloadVideo() {
        await this.downloadAsMP4();
    },

    async downloadAsGif() {
        const btn = document.getElementById('btn-download');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Creating GIF... 0%';
        btn.disabled = true;

        try {
            if (typeof GIF === 'undefined') {
                await this.downloadFramesAsZip();
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }

            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: 640,
                height: 480,
                workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js'
            });

            for (let i = 0; i < this.frames.length; i++) {
                const img = new Image();
                img.src = this.frames[i].dataUrl;
                await new Promise(resolve => img.onload = resolve);

                const canvas = document.createElement('canvas');
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 640, 480);

                gif.addFrame(ctx, { delay: 1000 / this.fps, copy: true });
                btn.innerHTML = `Creating GIF... ${Math.round((i + 1) / this.frames.length * 100)}%`;
            }

            gif.on('finished', (blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `onionmotion-${Date.now()}.gif`;
                a.click();
                URL.revokeObjectURL(url);

                btn.innerHTML = originalText;
                btn.disabled = false;
            });

            gif.render();

        } catch (err) {
            console.error('GIF creation failed:', err);
            await this.downloadFramesAsZip();
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async downloadAsWebM() {
        const btn = document.getElementById('btn-download');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Creating video...';
        btn.disabled = true;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const ctx = canvas.getContext('2d');

            const stream = canvas.captureStream(this.fps);
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp9'
            });

            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `onionmotion-${Date.now()}.webm`;
                a.click();
                URL.revokeObjectURL(url);

                btn.innerHTML = originalText;
                btn.disabled = false;
            };

            recorder.start();

            for (let loop = 0; loop < 3; loop++) {
                for (let i = 0; i < this.frames.length; i++) {
                    const img = new Image();
                    img.src = this.frames[i].dataUrl;
                    await new Promise(resolve => img.onload = resolve);

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    await new Promise(resolve => setTimeout(resolve, 1000 / this.fps));
                }
            }

            recorder.stop();

        } catch (err) {
            console.error('WebM creation failed:', err);
            alert('Video creation failed. Trying GIF download.');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async downloadAsMP4() {
        const btn = document.getElementById('btn-download');
        const originalText = btn.innerHTML;
        btn.innerHTML = 'Creating MP4... 0%';
        btn.disabled = true;

        try {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 480;
            const ctx = canvas.getContext('2d');

            const stream = canvas.captureStream(this.fps);
            const mimeType = 'video/mp4';
            const recorder = new MediaRecorder(stream, { mimeType });

            const chunks = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);

            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/mp4' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `onionmotion-${Date.now()}.mp4`;
                a.click();
                URL.revokeObjectURL(url);

                btn.innerHTML = originalText;
                btn.disabled = false;
            };

            recorder.start();

            for (let i = 0; i < this.frames.length; i++) {
                const img = new Image();
                img.src = this.frames[i].dataUrl;
                await new Promise(resolve => img.onload = resolve);

                ctx.drawImage(img, 0, 0, 640, 480);
                await new Promise(resolve => setTimeout(resolve, 1000 / this.fps));

                const progress = Math.round((i + 1) / this.frames.length * 100);
                btn.innerHTML = `Creating MP4... ${progress}%`;
            }

            recorder.stop();

        } catch (err) {
            console.error('MP4 creation failed:', err);
            await this.downloadAsGif();
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    },

    async downloadFramesAsZip() {
        alert('Video creation not possible. Downloading frames individually.');

        for (let i = 0; i < this.frames.length; i++) {
            const a = document.createElement('a');
            a.href = this.frames[i].dataUrl;
            a.download = `frame-${String(i + 1).padStart(3, '0')}.png`;
            a.click();
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
};

const HomepageModule = {
    init() {
        const frames = FrameStore.getFrames();

        const animationStatus = document.getElementById('animation-status');
        if (animationStatus && frames.length > 0) {
            animationStatus.style.display = 'flex';
            const statusText = document.getElementById('status-text');
            if (statusText) {
                statusText.textContent = `${frames.length} frame${frames.length !== 1 ? 's' : ''} ready`;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    UploadModule.init();

    if (path === '/' || path === '/index') {
        setupCameraSketch();
        setupCameraControls();
        updateCameraUI();
    } else if (path === '/homepage') {
        HomepageModule.init();
    } else if (path === '/frames') {
        FramesPageModule.init();
    } else if (path === '/videopage') {
        VideoPlayerModule.init();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.p5Instance) {
        window.p5Instance.remove();
    }
    if (VideoPlayerModule.intervalId) {
        VideoPlayerModule.pause();
    }
});
