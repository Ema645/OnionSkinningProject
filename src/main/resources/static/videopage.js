document.addEventListener('DOMContentLoaded', () => {
    // Progress Bar
    const progressBar = document.querySelector('.progress-bar');
    const progressFill = document.querySelector('.progress-fill');
    const progressHandle = document.querySelector('.progress-handle');

    // Speed Slider
    const sliderTrack = document.querySelector('.slider-track');
    const sliderFill = document.querySelector('.slider-fill');
    const sliderHandle = document.querySelector('.slider-handle');
    const speedValue = document.querySelector('.speed-value');

    function setupSlider(container, fill, handle, onUpdate) {
        let isDragging = false;

        function updateSlider(clientX) {
            const rect = container.getBoundingClientRect();
            let x = clientX - rect.left;
            let percentage = (x / rect.width) * 100;

            if (percentage < 0) percentage = 0;
            if (percentage > 100) percentage = 100;

            fill.style.width = `${percentage}%`;
            if (onUpdate) onUpdate(percentage);
        }

        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault(); // Prevent selection
        });

        container.addEventListener('mousedown', (e) => {
            isDragging = true;
            updateSlider(e.clientX);
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                updateSlider(e.clientX);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    // Setup Progress Slider
    if (progressBar && progressFill && progressHandle) {
        setupSlider(progressBar, progressFill, progressHandle, (percentage) => {
            console.log(`Progress: ${percentage}%`);
        });
    }

    // Setup Speed Slider
    if (sliderTrack && sliderFill && sliderHandle) {
        setupSlider(sliderTrack, sliderFill, sliderHandle, (percentage) => {
            // Map percentage (0-100) to FPS (e.g., 1 to 24)
            const minFps = 1;
            const maxFps = 24;
            const fps = Math.round((percentage / 100) * (maxFps - minFps) + minFps);
            if (speedValue) {
                speedValue.textContent = `${fps} FPS`;
            }
        });
    }
});

