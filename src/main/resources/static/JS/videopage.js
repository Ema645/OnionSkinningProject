document.addEventListener('DOMContentLoaded', () => {
    // Elemente holen
    const viewport = document.querySelector('.video-viewport');
    const playBtn = document.querySelector('.btn-play');
    const resetBtn = document.querySelector('.btn-reset');
    const loopCheckbox = document.querySelector('.loop-checkbox');
    const speedValue = document.querySelector('.speed-value');
    const sliderFill = document.querySelector('.slider-fill');
    const sliderHandle = document.querySelector('.slider-handle');
    const timelineContainer = document.querySelector('.timeline-frames');
    const frameIndicator = document.querySelector('.frame-indicator');

    // Daten laden
    let frames = JSON.parse(localStorage.getItem('onionMotionFrames')) || [];
    let isPlaying = false;
    let currentFrameIndex = 0;
    let fps = 12;
    let intervalId = null;

    // Initialisierung
    if (frames.length === 0) {
        viewport.innerHTML = '<p style="color:white; text-align:center; padding-top:20%;">Keine Frames vorhanden. Gehe zur Homepage!</p>';
    } else {
        renderCurrentFrame();
        renderTimeline();
    }

    // --- Player Logik ---

    function renderCurrentFrame() {
        if (frames.length === 0) return;

        // Bild im Viewport anzeigen
        viewport.innerHTML = `<img src="${frames[currentFrameIndex].dataUrl}" style="width:100%; height:100%; object-fit:contain;">`;
        frameIndicator.textContent = `Frame ${currentFrameIndex + 1} / ${frames.length}`;

        // Timeline Highlight
        document.querySelectorAll('.frame-item').forEach((item, idx) => {
            item.style.borderColor = idx === currentFrameIndex ? '#155DFC' : '#E5E7EB';
        });
    }

    function togglePlay() {
        if (isPlaying) {
            stopAnimation();
        } else {
            startAnimation();
        }
    }

    function startAnimation() {
        if (frames.length === 0) return;
        isPlaying = true;
        playBtn.innerHTML = '<span class="icon icon-pause"></span> Pause'; // Icon müsste angepasst werden

        intervalId = setInterval(() => {
            currentFrameIndex++;
            if (currentFrameIndex >= frames.length) {
                if (loopCheckbox.checked) {
                    currentFrameIndex = 0;
                } else {
                    stopAnimation();
                    currentFrameIndex = frames.length - 1; // Auf letztem Frame bleiben
                    return;
                }
            }
            renderCurrentFrame();
        }, 1000 / fps);
    }

    function stopAnimation() {
        isPlaying = false;
        playBtn.innerHTML = '<span class="icon icon-play"></span> Play';
        clearInterval(intervalId);
    }

    // --- Timeline Logik ---

    function renderTimeline() {
        timelineContainer.innerHTML = '';
        frames.forEach((frame, index) => {
            const item = document.createElement('div');
            item.className = 'frame-item';
            item.innerHTML = `
                <span class="frame-number">${index + 1}</span>
                <img src="${frame.dataUrl}" class="frame-thumbnail" style="object-fit:cover;">
                <button class="btn-delete" data-index="${index}">🗑️</button>
            `;

            // Klick auf Timeline springt zu Frame
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-delete')) {
                    stopAnimation();
                    currentFrameIndex = index;
                    renderCurrentFrame();
                }
            });

            // Löschen Button
            item.querySelector('.btn-delete').addEventListener('click', () => {
                deleteFrame(index);
            });

            timelineContainer.appendChild(item);
        });
    }

    function deleteFrame(index) {
        if (confirm('Frame wirklich löschen?')) {
            frames.splice(index, 1);
            localStorage.setItem('onionMotionFrames', JSON.stringify(frames));

            if (currentFrameIndex >= frames.length) currentFrameIndex = frames.length - 1;
            if (currentFrameIndex < 0) currentFrameIndex = 0;

            renderCurrentFrame();
            renderTimeline();
        }
    }

    // --- Event Listeners ---

    playBtn.addEventListener('click', togglePlay);

    resetBtn.addEventListener('click', () => {
        stopAnimation();
        currentFrameIndex = 0;
        renderCurrentFrame();
    });

    // Speed Slider (vereinfacht)
    const sliderTrack = document.querySelector('.slider-track');
    let isDragging = false;

    sliderTrack.parentNode.addEventListener('mousedown', (e) => {
        isDragging = true;
        updateSpeed(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) updateSpeed(e);
    });

    document.addEventListener('mouseup', () => isDragging = false);

    function updateSpeed(e) {
        const rect = sliderTrack.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let percent = Math.max(0, Math.min(100, (x / rect.width) * 100));

        sliderFill.style.width = `${percent}%`;

        // Map 0-100% to 1-24 FPS
        fps = Math.round((percent / 100) * 23) + 1;
        speedValue.textContent = `${fps} FPS`;

        // Wenn es gerade spielt, Intervall neu setzen
        if (isPlaying) {
            clearInterval(intervalId);
            startAnimation();
        }
    }
});