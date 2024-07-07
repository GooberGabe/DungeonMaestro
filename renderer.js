class Sound {
    constructor(name, source, type) {
        this.name = name;
        this.source = source;
        this.type = type; // 'music', 'ambient', or 'effect'
        this.isYouTube = this.isYouTubeLink(source);
        this.element = this.createSoundElement();
        this.isPlaying = false;
        this.wasPaused = false;
        this.scene = null;
        this.queued = false;
        this.id = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.volume = 1; // Individual sound volume

        if (this.isYouTube) {
            this.initYouTubePlayer();
        } else {
            this.audio = new Audio(source);
            this.audio.addEventListener('ended', () => this.onEnded());
            if (this.type === 'ambient') {
                this.audio.loop = true;
            }
        }
    }

    isYouTubeLink(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }

    initYouTubePlayer() {
        const videoId = this.getYouTubeVideoId(this.source);
        if (!videoId) {
            console.error('Invalid YouTube URL');
            return;
        }

        const playerContainer = document.createElement('div');
        playerContainer.id = `youtube-player-${Date.now()}`;
        playerContainer.style.display = 'none';
        document.body.appendChild(playerContainer);

        this.youtubePlayer = new YT.Player(playerContainer.id, {
            height: '0',
            width: '0',
            videoId: videoId,
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'disablekb': 1,
                'fs': 0,
                'modestbranding': 1,
                'rel': 0
            },
            events: {
                'onReady': this.onYouTubePlayerReady.bind(this),
                'onStateChange': this.onYouTubePlayerStateChange.bind(this)
            }
        });
    }

    getYouTubeVideoId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/; // I have no idea what this means but it works
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    onYouTubePlayerReady(event) {
        console.log(`YouTube player ready for ${this.name}`);
        if (this.type === 'ambient') {
            event.target.setLoop(true);
        }
    }

    onYouTubePlayerStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) {
            if (this.type !== 'ambient') {
                this.stop(); // This will reset the progress
            } else {
                // For ambient sounds, just reset the progress without stopping
                this.resetProgress();
            }
        }
    }

    createSoundElement() {
        const soundEl = document.createElement('div');
        soundEl.className = `sound ${this.type} ${this.isYouTube ? 'youtube' : 'local'}`;
        soundEl.dataset.soundId = this.id;
        soundEl.innerHTML = `
            <div class="sound-type-indicator"></div>
            <div class="sound-content">
                <div class="sound-name">${this.name}</div>
                <div class="progress-bar">
                    <div class="progress"></div>
                </div>
            </div>
            <div class="sound-controls">
                <button class="sound-button play" title="Play">▶</button>
                <button class="sound-button stop" title="Stop">■</button>
                ${this.type === 'music' ? '<button class="sound-button queue" title="Queue">+</button>' : ''}
            </div>
            <button class="sound-options" title="Options">⚙️</button>
        `;

        //soundEl.querySelector('.play').addEventListener('click', () => this.play());
        soundEl.querySelector('.play').addEventListener('click', () => soundboard.playSound(this));
        soundEl.querySelector('.stop').addEventListener('click', () => this.stop());
        soundEl.querySelector('.sound-options').addEventListener('click', () => this.showOptionsDialog());
        if (this.type === 'music') {
            soundEl.querySelector('.queue').addEventListener('click', () => {console.log("EVENT: addToQueue (Sound)"); this.addToQueue()});
        }

        this.progressBar = soundEl.querySelector('.progress');

        return soundEl;
    }

    showOptionsDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'sound-options-dialog';
        dialog.innerHTML = `
            <form method="dialog">
                <h3>Options for "${this.name}"</h3>
                <label>
                    Volume:
                    <input type="range" min="0" max="1" step="0.01" value="${this.volume}" id="volume-slider">
                </label>
                <label>
                    Source:
                    <input type="text" value="${this.source}" id="source-input">
                </label>
                <div class="dialog-buttons">
                    <button type="submit">Save</button>
                    <button type="button" id="delete-sound">Delete Sound</button>
                    <button type="button" id="cancel-button">Cancel</button>
                </div>
            </form>
        `;

        const volumeSlider = dialog.querySelector('#volume-slider');
        const sourceInput = dialog.querySelector('#source-input');

        dialog.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.setVolume(parseFloat(volumeSlider.value));
            if (sourceInput.value != this.source) this.updateSource(sourceInput.value);
            dialog.close();
        });

        dialog.querySelector('#delete-sound').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this sound?')) {
                this.delete();
                dialog.close();
            }
        });

        dialog.querySelector('#cancel-button').addEventListener('click', () => {
            dialog.close();
        });

        document.body.appendChild(dialog);
        dialog.showModal();
    }

    setVolume(volume) {
        console.log("Volume set (SOUND)")
        this.volume = volume;
        this.updateEffectiveVolume();
    }

    updateEffectiveVolume() {
        console.log("Effective volume set")
        const effectiveVolume = this.volume * soundboard.volume;
        if (this.isYouTube && this.youtubePlayer) {
            this.youtubePlayer.setVolume(effectiveVolume * 100);
        } else if (this.audio) {
            this.audio.volume = effectiveVolume;
        }
    }

    updateSource(newSource) {
        this.source = newSource;
        this.isYouTube = this.isYouTubeLink(newSource);
        if (this.isYouTube) {
            this.initYouTubePlayer();
        } else {
            this.audio = new Audio(newSource);
            this.audio.volume = this.volume;
            if (this.type === 'ambient') {
                this.audio.loop = true;
            }
        }
    }

    delete() {
        this.stop();
        this.scene.removeSound(this);
        soundboard.removeFromMusicQueue(this);
    }

    play() {
        if (this.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.playVideo) {
                this.youtubePlayer.playVideo();
            }
            this.startYouTubeProgressUpdate();
        } else {
            this.audio.play();
            this.startAudioProgressUpdate();
        }
        this.isPlaying = true;
        this.element.classList.add('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        this.updateEffectiveVolume();
    }

    togglePause() {
        if (this.isYouTube) {
            if (this.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING) {
                this.youtubePlayer.pauseVideo();
                this.isPlaying = false;
                this.wasPaused = true;
            } else {
                this.youtubePlayer.playVideo();
                this.isPlaying = true;
                this.wasPaused = false;
            }
        } else {
            if (this.audio.paused) {
                this.audio.play();
                this.isPlaying = true;
                this.wasPaused = false;
            } else {
                this.audio.pause();
                this.isPlaying = false;
                this.wasPaused = true;
            }
        }
        this.element.classList.toggle('playing', this.isPlaying);
        soundboard.updatePlayingState();
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.element.classList.remove('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
    }

    stop() {
        if (this.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.stopVideo) {
                this.youtubePlayer.stopVideo();
            }
        } else {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.isPlaying = false;
        this.element.classList.remove('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        this.stopProgressUpdate();
        this.resetProgress();

        this.onEnded();
    }

    updateProgress(currentTime, duration) {
        if (this.progressBar) {
            const progress = (currentTime / duration) * 100;
            this.progressBar.style.width = `${progress}%`;
        }
    }

    resetProgress() {
        if (this.progressBar) {
            this.progressBar.style.width = '0%';
        }
    }

    startAudioProgressUpdate() {
        this.stopProgressUpdate(); // Clear any existing interval
        this.progressInterval = setInterval(() => {
            this.updateProgress(this.audio.currentTime, this.audio.duration);
            if (this.audio.ended) {
                this.stop();
            }
        }, 300);
    }

    startYouTubeProgressUpdate() {
        this.stopProgressUpdate(); // Clear any existing interval
        this.progressInterval = setInterval(() => {
            if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) {
                const currentTime = this.youtubePlayer.getCurrentTime();
                const duration = this.youtubePlayer.getDuration();
                this.updateProgress(currentTime, duration);
            }
        }, 300);
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    toggleQueue() {
        console.log("Toggled queue status")
        this.queued = !this.queued;
        if (this.queued) {
            soundboard.addToMusicQueue(this);
        } else {
            soundboard.removeFromMusicQueue(this);
        }

        /* Dequeue from Sound element

        // Update the queue button appearance
        const queueButton = this.element.querySelector('.queue');
        if (queueButton) {
            queueButton.textContent = this.queued ? '−' : '+';
            queueButton.title = this.queued ? 'Remove from Queue' : 'Add to Queue';
        }

        */
    }

    addToQueue() {
        console.log("Set queued to true.")
        this.queued = true;
        soundboard.addToMusicQueue(this);
    }

    removeFromQueue() {
        if (this.queued) {
            this.toggleQueue();
        }
    }

    onEnded() {
        if (this.type !== 'ambient') {  // Ambient sounds loop, so we don't need to update their state
            this.isPlaying = false;
            this.element.classList.remove('playing');
            if (this.scene) {
                this.scene.updatePlayingState();
            }
            if (this.type === 'music')
            {
                console.log("NEXT!")
                soundboard.playNextInQueue();
            }
        }
        
    }
}

class QueuedSound {
    constructor(originalSound) {
        this.originalSound = originalSound;
        this.element = this.createSoundElement();
    }

    createSoundElement() {
        console.log("Created QueuedSound element.")
        const soundEl = document.createElement('div');
        soundEl.className = `sound queued ${this.originalSound.type}`;
        soundEl.dataset.soundId = this.originalSound.id;
        soundEl.innerHTML = `
            <div class="sound-type-indicator"></div>
            <div class="sound-content">
                <div class="sound-name">${this.originalSound.name}</div>
            </div>
            <button class="remove-from-queue">✕</button>
        `;

        soundEl.querySelector('.remove-from-queue').addEventListener('click', () => {
            soundboard.visualQueue.removeSound(this.originalSound);
        });

        return soundEl;
    }
}

class Scene {
    constructor(name,_soundboard) {
        this.id = `scene-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.name = name;
        this.sounds = [];
        this.element = this.createSceneElement();
        _soundboard.scenesContainer.appendChild(this.element);
        this.contentElement = this.element.querySelector('.scene-content');
        this.isOpen = true;
    }

    createSceneElement() {
        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene';
        sceneEl.dataset.sceneId = this.id;
        sceneEl.innerHTML = `
            <div class="scene-header">
                <span>${this.name}</span>
                <button class="toggle-scene">▼</button>
            </div>
            <div class="scene-content">
                <button class="add-sound-button">+ Add Soundscape</button>
            </div>
        `;

        sceneEl.querySelector('.toggle-scene').addEventListener('click', () => this.toggleContent());
        sceneEl.querySelector('.add-sound-button').addEventListener('click', () => soundboard.showAddSoundDialog(this));

        return sceneEl;
    }

    addSound(sound) {
        console.log("Added sound to Scene.")
        this.sounds.push(sound);
        sound.scene = this;
        this.contentElement.insertBefore(sound.element, this.contentElement.querySelector('.add-sound-button'));
    }

    removeSound(sound) {
        const index = this.sounds.indexOf(sound);
        if (index !== -1) {
            this.sounds.splice(index, 1);
            this.contentElement.removeChild(sound.element);
        }
    }

    toggleContent() {
        this.isOpen = !this.isOpen;
        this.contentElement.classList.toggle('hidden', !this.isOpen);
        const toggleButton = this.element.querySelector('.toggle-scene');
        toggleButton.textContent = this.isOpen ? '▼' : '▶';
        this.updatePlayingState();
    }

    updatePlayingState() {
        const isAnyPlaying = this.sounds.some(sound => sound.isPlaying);
        this.element.classList.toggle('playing', isAnyPlaying);
        this.element.classList.toggle('playing-closed', isAnyPlaying && !this.isOpen);
        soundboard.updatePlayingState();
    }

    
}

class VisualQueue extends Scene {
    constructor(soundboard) {
        super("Queue",soundboard);
        this.element.classList.add('visual-queue');
        //this.initDragAndDrop();
    }

    createSceneElement() {
        const sceneEl = super.createSceneElement();
        sceneEl.querySelector('.add-sound-button').remove();
        return sceneEl;
    }

    addSound(sound) {
        console.log("Added sound to Queue.")
        const queuedSound = new QueuedSound(sound);
        super.addSound(queuedSound);
        this.initSoundDragAndDrop(queuedSound.element);
    }

    initSoundDragAndDrop(soundElement) {
        soundElement.setAttribute('draggable', true);
        soundElement.addEventListener('dragstart', () => {
            soundElement.classList.add('dragging');
        });
        soundElement.addEventListener('dragend', () => {
            soundElement.classList.remove('dragging');
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.sound:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateQueueOrder() {
        const newOrder = Array.from(this.contentElement.querySelectorAll('.sound')).map(el => el.dataset.soundId);
        //const newOrder = this.contentElement.querySelectorAll('.sound');
        soundboard.updateMusicQueue(newOrder);
        this.updateQueueNumbers();
    }

    removeSound(sound) {
        console.log("Removed sound.");
        const index = this.sounds.findIndex(s => s.originalSound === sound);
        if (index !== -1) {
            this.sounds.splice(index, 1);
            this.contentElement.removeChild(this.sounds[index].element);
            soundboard.removeFromMusicQueue(sound);
        }
    }
}

class Soundboard {
    constructor() {
        this.scenes = [];
        this.scenesContainer = document.getElementById('scenes-container');
        this.menuButton = document.getElementById('menu-button');
        this.menu = document.getElementById('menu');
        this.addSceneButton = document.getElementById('add-scene');
        this.quitButton = document.getElementById('quit-app');
        this.resizeHandle = document.getElementById('resize-handle');
        this.initResizeHandle();
        this.pauseButton = document.getElementById('pause-button');
        this.skipButton = document.getElementById('skip-button');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volume = 1;
        this.addSceneDialog = document.getElementById('add-scene-dialog');
        this.addSoundDialog = document.getElementById('add-sound-dialog');
        this.isGloballyPaused = false;
        
        this.visualQueue = new VisualQueue(this);
        //this.scenesContainer.appendChild(this.visualQueue.element);
        this.musicQueue = [];
        this.queueContainer = this.visualQueue.element.querySelector(".scene-content");  //document.getElementById('queue-container');
        this.draggedElement = null;
        this.initSceneDragAndDrop();
        this.initQueueDragAndDrop();
        this.currentlyPlayingMusic = null;
        
        this.initEventListeners();
        console.log('Soundboard initialized');
        
    }

    initEventListeners() {
        console.log('Adding click event listener to menu button');
        this.menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleMenu();
        });
        this.addSceneButton.addEventListener('click', () => {
            this.showAddSceneDialog();
            this.toggleMenu();
        });
        this.volumeSlider.addEventListener('input', (e) => this.setGlobalVolume(e.target.value));
        this.quitButton.addEventListener('click', () => this.quit());
        this.pauseButton.addEventListener('click', () => this.toggleGlobalPause());
        this.skipButton.addEventListener('click', () => this.skipToNextTrack());
        
        document.addEventListener('click', () => {
            this.menu.classList.add('hidden');
        });
        this.menu.addEventListener('click', (event) => {
            event.stopPropagation();
        });
        this.initResizeHandle();

        // Add scene dialog events
        this.addSceneDialog.querySelector('form').addEventListener('submit', (e) => {
            
            e.preventDefault();
            const sceneName = document.getElementById('scene-name').value;
            if (sceneName) {
                this.addScene(sceneName);
                this.addSceneDialog.close();
            }
        });
        document.getElementById('cancel-add-scene').addEventListener('click', () => {
            this.addSceneDialog.close();
        });

        // Add sound dialog events
        this.addSoundDialog.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('sound-name').value;
            const source = document.getElementById('sound-source').value;
            const sourceType = document.getElementById('sound-source-type').value;
            const type = document.getElementById('sound-type').value;
            if (name && source && (type === 'music' || type === 'ambient' || type === 'effect')) {
                var s = new Sound(name, source, type);
                soundboard.addSound(s);
                soundboard.addSoundDialog.close();
                soundboard.saveState();
            }
        });
        document.getElementById('cancel-add-sound').addEventListener('click', () => {
            this.addSoundDialog.close();
        });
        
    }

    initResizeHandle() {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const startResize = (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = document.documentElement.clientWidth;
            startHeight = document.documentElement.clientHeight;
        };

        const resize = (e) => {
            if (!isResizing) return;
            const width = startWidth + e.clientX - startX;
            const height = startHeight + e.clientY - startY;
            window.resizeTo(width, height);
        };

        const stopResize = () => {
            isResizing = false;
        };

        this.resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', resize);
        document.addEventListener('mouseup', stopResize);
    }

    addScene(name) {
        const scene = new Scene(name, soundboard);
        this.scenes.push(scene);
        //this.scenesContainer.appendChild(scene.element); -- Redundant; is already in constructor
        return scene;
    }

    showAddSceneDialog() {
        document.getElementById('scene-name').value = '';
        this.addSceneDialog.showModal();
    }

    showAddSoundDialog(scene) {
        this.currentScene = scene;
        document.getElementById('sound-name').value = '';
        document.getElementById('sound-source').value = '';
        document.getElementById('sound-source-type').value = 'local';
        document.getElementById('sound-type').value = 'music';
        this.addSoundDialog.showModal();
    }

    addSound(sound) {
        this.currentScene.addSound(sound);
    }

    playSound(sound) {
        if (sound.type === 'music') {
            this.stopAllMusic();
            this.currentlyPlayingMusic = sound;
            this.removeFromMusicQueue(sound);
        }
        sound.play();
        this.updateVisualQueue();
    }

    playNextInQueue() {
        if (this.musicQueue.length > 0) {
            const nextSound = this.musicQueue.shift();
            this.playSound(nextSound);
        } else {
            this.currentlyPlayingMusic = null;
        }
        this.updateVisualQueue();
    }

    setVolume(value) {
        console.log("Volume set (SOUNDBOARD)")
        const volume = value / 100;
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                sound.audio.volume = volume;
            });
        });
    }

    toggleGlobalPause() {
        this.isGloballyPaused = !this.isGloballyPaused;
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                if (sound.isPlaying || (!this.isGloballyPaused && sound.wasPaused)) {
                    sound.togglePause();
                }
            });
        });
        this.updatePauseButtonIcon();
    }

    updatePauseButtonIcon() {
        this.pauseButton.textContent = this.isGloballyPaused ? '▶️' : '⏸️';
    }

    updatePlayingState() {
        const isAnyPlaying = this.scenes.some(scene => 
            scene.sounds.some(sound => sound.isPlaying)
        );
        this.isGloballyPaused = !isAnyPlaying;
        this.updatePauseButtonIcon();
    }

    toggleMenu() {
        this.menu.classList.toggle('hidden');
        console.log(this.menu);
    }

    quit() {
        window.close();
    }

    stopAllMusic() {
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                if (sound.type === 'music' && sound.isPlaying) {
                    sound.stop();
                }
            });
        });
        this.currentlyPlayingMusic = null;
    }

    skipToNextTrack() {
        if (this.currentlyPlayingMusic) {
            this.currentlyPlayingMusic.stop();
        }
        else if (this.musicQueue.length > 0) {
            this.playNextInQueue();
        }
    }

    setGlobalVolume(volume) {
        this.volume = parseFloat(volume/100);
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                sound.setVolume(this.volume);
            });
        });
    }

    addToMusicQueue(sound) {
        console.log("Added Sound to queue (SOUNDBOARD)")
        if (!this.musicQueue.includes(sound)) {
            this.musicQueue.push(sound);
            this.updateVisualQueue();
        }
    }

    removeFromMusicQueue(sound) {
        console.log("Removed Sound from queue (SOUNDBOARD)")
        const index = this.musicQueue.indexOf(sound);
        if (index > -1) {
            this.musicQueue.splice(index, 1);
            sound.queued = false;
            const queueButton = sound.element.querySelector('.queue');
            if (queueButton) {
                queueButton.textContent = '+';
                queueButton.title = 'Add to Queue';
            }
            this.updateVisualQueue();
        }
    }

    updateVisualQueue() {
        console.log("Updating queue.")
        this.queueContainer.innerHTML = "";
        if (this.musicQueue.length === 0) {
            this.queueContainer.innerHTML += '<p>No songs in queue</p>';
        } else {
            this.musicQueue.forEach((sound, index) => {
                const queuedSoundEl = this.createQueuedSoundElement(sound, index + 1);
                this.queueContainer.appendChild(queuedSoundEl);
            });
        }
        this.updateQueueNumbers();
    }

    updateQueueNumbers() {
        const queuedSounds = this.queueContainer.querySelectorAll('.queued-sound');
        queuedSounds.forEach((el, index) => {
            el.dataset.queueNumber = index + 1;
        });
    }

    updateMusicQueue(newOrder) {
        this.musicQueue = newOrder.map(id => this.findSoundById(id));
    }

    createQueuedSoundElement(sound, index) {
        const queuedSoundEl = document.createElement('div');
        queuedSoundEl.className = 'queued-sound';
        queuedSoundEl.dataset.soundId = sound.id;
        queuedSoundEl.dataset.queueIndex = index;
        queuedSoundEl.draggable = true;
        queuedSoundEl.innerHTML = `
            <div class="sound-type-indicator ${sound.type}"></div>
            <div class="sound-name">${sound.name}</div>
            <button class="remove-from-queue" title="Remove from Queue">✕</button>
        `;

        queuedSoundEl.querySelector('.remove-from-queue').addEventListener('click', () => {
            console.log("EVENT: toggleQueue (SOUNDBOARD)")
            sound.toggleQueue();
        });

        /* PlayNow is redundant
        queuedSoundEl.querySelector('.play-now').addEventListener('click', () => {
            this.playSound(sound);
        });
        */

        //this.initSoundDraggable(queuedSoundEl);

        return queuedSoundEl;
    }

    async deleteAllScenes() {
        console.log('Deleting all scenes');
        this.scenes = [];
        this.musicQueue = [];

        // Clear scenes from database
        await window.electronAPI.deleteAllScenes();

        // Clear the UI
        this.updateVisualQueue();

        console.log('All scenes deleted');
    }

    async saveState() {
        console.log('Saving state...');
        for (const scene of this.scenes) {
            await window.electronAPI.saveScene({ id: scene.id, name: scene.name });
            for (const sound of scene.sounds) {
                await window.electronAPI.saveSound({
                    id: sound.id,
                    scene_id: scene.id,
                    name: sound.name,
                    source: sound.source,
                    type: sound.type,
                    volume: sound.volume
                });
            }
        }
        await window.electronAPI.saveQueue(this.musicQueue.map(sound => ({ id: sound.id })));
        console.log('State saved successfully');
    }

    async loadState() {
        try {
            console.log('Loading state...');
            const scenes = await window.electronAPI.getScenes();
            const sounds = await window.electronAPI.getSounds();
            const queue = await window.electronAPI.getQueue();

            scenes.forEach(sceneData => {
                const scene = this.addScene(sceneData.name);
                scene.id = sceneData.id;
            })

            sounds.forEach(soundData => {
                const scene = this.scenes.find(s => s.id === soundData.scene_id);
                if (scene) {
                    const sound = new Sound(soundData.name, soundData.source, soundData.type);
                    sound.id = soundData.id;
                    sound.volume = soundData.volume;
                    scene.addSound(sound);
                }
            });

            this.musicQueue = queue.map(queueItem => {
                return this.findSoundById(queueItem.sound_id);
            }).filter(sound => sound !== null);

            console.log('State loaded successfully');
            //this.renderScenes();
            this.updateVisualQueue();
        } catch (error) {
            console.error('Error loading state:', error);
            throw error;
        }
    }

    findSoundById(id) {
        for (const scene of this.scenes) {
            const sound = scene.sounds.find(s => s.id === id);
            if (sound) return sound;
        }
        return null;
    }

    initSceneDragAndDrop() {
        this.scenes.forEach(scene => this.initSceneDraggable(scene.element));
        this.scenesContainer.addEventListener('dragover', this.handleSceneDragOver.bind(this));
        this.scenesContainer.addEventListener('drop', this.handleSceneDrop.bind(this));
    }

    initSceneDraggable(sceneElement) {
        sceneElement.setAttribute('draggable', true);
        sceneElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', sceneElement.dataset.sceneId);
            sceneElement.classList.add('dragging');
        });
        sceneElement.addEventListener('dragend', () => {
            sceneElement.classList.remove('dragging');
        });
    }

    initQueueDragAndDrop() {
        this.queueContainer.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.queueContainer.addEventListener('dragover', this.handleDragOver.bind(this));
        this.queueContainer.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.queueContainer.addEventListener('drop', this.handleDrop.bind(this));
        this.queueContainer.addEventListener('dragend', this.handleDragEnd.bind(this));
    }

    handleDragStart(e) {
        if (e.target.classList.contains('queued-sound')) {
            this.draggedElement = e.target;
            e.dataTransfer.setData('text/plain', e.target.dataset.soundId);
            e.target.style.opacity = '0.5';
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        if (this.draggedElement) {
            const targetElement = e.target.closest('.queued-sound');
            if (targetElement && targetElement !== this.draggedElement) {
                const rect = targetElement.getBoundingClientRect();
                const isGridLayout = window.innerWidth >= 300 && window.innerHeight >= 200; // Check if we're in grid layout

                if (isGridLayout) {
                    const midX = rect.left + rect.width / 2;
                    if (e.clientX < midX) {
                        targetElement.classList.add('drag-over-top');
                        targetElement.classList.remove('drag-over-bottom');
                    } else {
                        targetElement.classList.add('drag-over-bottom');
                        targetElement.classList.remove('drag-over-top');
                    }
                } else {
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        targetElement.classList.add('drag-over-top');
                        targetElement.classList.remove('drag-over-bottom');
                    } else {
                        targetElement.classList.add('drag-over-bottom');
                        targetElement.classList.remove('drag-over-top');
                    }
                }
            }
        }
    }

    handleDragLeave(e) {
        if (e.target.classList.contains('queued-sound')) {
            e.target.style.borderTop = '';
            e.target.style.borderBottom = '';
        }
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.draggedElement) {
            const targetElement = e.target.closest('.queued-sound');
            if (targetElement && targetElement !== this.draggedElement) {
                const rect = targetElement.getBoundingClientRect();
                const isGridLayout = window.innerWidth >= 768;

                if (isGridLayout) {
                    const midX = rect.left + rect.width / 2;
                    if (e.clientX < midX) {
                        this.queueContainer.insertBefore(this.draggedElement, targetElement);
                    } else {
                        this.queueContainer.insertBefore(this.draggedElement, targetElement.nextSibling);
                    }
                } else {
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        this.queueContainer.insertBefore(this.draggedElement, targetElement);
                    } else {
                        this.queueContainer.insertBefore(this.draggedElement, targetElement.nextSibling);
                    }
                }

                this.updateQueueOrder();
                this.updateQueueNumbers();
            }
        }
    }

    handleDragEnd(e) {
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '1';
            this.draggedElement = null;
            
            this.queueContainer.querySelectorAll('.queued-sound').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        }
    }

    initSoundDraggable(soundElement) {
        soundElement.setAttribute('draggable', true);
        soundElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', soundElement.dataset.soundId);
            soundElement.classList.add('dragging');
        });
        soundElement.addEventListener('dragend', () => {
            soundElement.classList.remove('dragging');
        });
    }

    handleSceneDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(this.scenesContainer, e.clientY);
        const draggable = document.querySelector('.scene.dragging');
        if (draggable && afterElement) {
            this.scenesContainer.insertBefore(draggable, afterElement);
        }
    }

    handleSceneDrop(e) {
        e.preventDefault();
        const sceneId = e.dataTransfer.getData('text/plain');
        const sceneElement = document.querySelector(`.scene[data-scene-id="${sceneId}"]`);
        if (sceneElement) {
            this.updateSceneOrder();
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.scene:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    updateSceneOrder() {
        this.scenes = Array.from(this.scenesContainer.querySelectorAll('.scene'))
            .map(el => this.scenes.find(scene => scene.element.dataset.sceneId === el.dataset.sceneId));
    }

    updateQueueOrder() {
        const newOrder = Array.from(this.queueContainer.querySelectorAll('.queued-sound'))
            .map(el => this.musicQueue.find(sound => sound.id === el.dataset.soundId));
        this.musicQueue = newOrder;
    }

}


let keySequence = '';
const secretCode = 'deletescenes';

// This is just for me, to be able to delete all Scenes. 
document.addEventListener('keydown', (event) => {
    keySequence += event.key.toLowerCase();
    keySequence = keySequence.slice(-secretCode.length);
    
    if (keySequence === secretCode) {
        console.log('Secret code entered. Deleting all scenes...');
        soundboard.deleteAllScenes().then(() => {
            console.log('All scenes deleted successfully');
            alert('All scenes have been deleted');
        }).catch((error) => {
            console.error('Error deleting scenes:', error);
            alert('Error deleting scenes. Check the console for details.');
        });
    }
});

let tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
let firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var soundboard;

// When the app unloads, save stuff to the DB
window.addEventListener('beforeunload', async (event) => {
    event.preventDefault();
    await soundboard.saveState();
});

window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube IFrame API ready');
    soundboard = new Soundboard();
    soundboard.loadState().catch(error => {
        console.error('Failed to load state:', error);
    });

    // const scene1 = soundboard.addScene('Example');
    //var s = new Sound('Music', 'https://www.youtube.com/watch?v=oCjPrsrSTPA&list=RDoCjPrsrSTPA&index=1', 'music')
    //scene1.addSound(s);

    //var s2 = new Sound('Doorbell', 'assets/sounds/sound1.mp3', 'music')
    //scene1.addSound(s2);

    soundboard.updatePlayingState();
};


// ---- UPDATER STUFF ----

// Listen for update available
window.electronAPI.onUpdateAvailable(() => {
    console.log('Update available. Downloading...');
    // TODO: Implement "what's new" popup
});

// Listen for update downloaded
window.electronAPI.onUpdateDownloaded(() => {
    console.log('Update downloaded. It will be installed on restart.');
    // Prompt user to restart the app
    const response = confirm('An update has been downloaded. Restart to install?');
    if (response) {
        window.electronAPI.restartApp();
    }
});

// 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

