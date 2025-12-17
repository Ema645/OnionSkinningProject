document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('capture-canvas');
    const onionSkin = document.getElementById('onion-skin');
    const captureBtn = document.querySelector('.btn-capture');
    const frameCountSpan = document.getElementById('frame-count');

    // Frames aus dem LocalStorage laden (damit Daten zwischen Seiten bleiben)
    let frames = JSON.parse(localStorage.getItem('onionMotionFrames')) || [];
    updateUI();

    // 1. Kamera starten
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            video.srcObject = stream;
            captureBtn.disabled = false;
        } catch (err) {
            console.error("Kamera-Fehler:", err);
            alert("Konnte nicht auf die Kamera zugreifen.");
        }
    }

    // 2. Frame aufnehmen
    captureBtn.addEventListener('click', () => {
        // Canvas an Video-Größe anpassen
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        // Bild vom Video auf Canvas zeichnen
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Als Bild-URL speichern
        const dataUrl = canvas.toDataURL('image/png');

        const newFrame = {
            id: Date.now(),
            dataUrl: dataUrl
        };

        frames.push(newFrame);
        saveFrames();
        updateUI();
    });

    // 3. UI und Onion Skin aktualisieren
    function updateUI() {
        frameCountSpan.textContent = frames.length;

        // Onion Skinning Logik: Zeige das letzte Bild halbtransparent
        if (frames.length > 0) {
            const lastFrame = frames[frames.length - 1];
            onionSkin.src = lastFrame.dataUrl;
            onionSkin.style.display = 'block';
        } else {
            onionSkin.style.display = 'none';
        }
    }

    function saveFrames() {
        localStorage.setItem('onionMotionFrames', JSON.stringify(frames));
    }

    // Initialisierung
    startCamera();
});