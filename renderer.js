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

        if (this.isYouTube) {
            this.initYouTubePlayer();
        } else {
            this.audio = new Audio(source);
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
        `;

        soundEl.querySelector('.play').addEventListener('click', () => this.play());
        soundEl.querySelector('.stop').addEventListener('click', () => this.stop());
        if (this.type === 'music') {
            soundEl.querySelector('.queue').addEventListener('click', () => this.toggleQueue());
        }

        this.progressBar = soundEl.querySelector('.progress');

        return soundEl;
    }

    play() {
        if (this.type === 'music') {
            soundboard.stopAllMusic(this);
        }
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
        this.wasPaused = false;
        this.element.classList.add('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        soundboard.updatePlayingState();
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
        this.wasPaused = false;
        this.element.classList.remove('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        this.stopProgressUpdate();
        this.resetProgress();
        soundboard.updatePlayingState();
    }

    setVolume(volume) {
        if (this.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.setVolume) {
                this.youtubePlayer.setVolume(volume * 100);
            }
        } else {
            this.audio.volume = volume;
        }
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
        if (this.type === 'music') {
            this.queued = !this.queued;
            this.element.classList.toggle('queued', this.queued);
            if (this.queued) {
                soundboard.addToMusicQueue(this);
            } else {
                // Remove from queue if unqueued
                const index = soundboard.musicQueue.indexOf(this);
                if (index > -1) {
                    soundboard.musicQueue.splice(index, 1);
                }
            }
        }
    }

    onAudioEnded() {
        // This method is called when the audio finishes playing
        if (this.type !== 'ambient') {  // Ambient sounds loop, so we don't need to update their state
            this.isPlaying = false;
            this.element.classList.remove('playing');
            if (this.scene) {
                this.scene.updatePlayingState();
            }
        }
    }
}

class Scene {
    constructor(name) {
        this.name = name;
        this.sounds = [];
        this.element = this.createSceneElement();
        this.contentElement = this.element.querySelector('.scene-content');
        this.isOpen = true;
    }

    createSceneElement() {
        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene';
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
        this.sounds.push(sound);
        sound.scene = this;
        this.contentElement.insertBefore(sound.element, this.contentElement.querySelector('.add-sound-button'));
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
        this.addSceneDialog = document.getElementById('add-scene-dialog');
        this.addSoundDialog = document.getElementById('add-sound-dialog');
        this.isGloballyPaused = false;

        this.musicQueue = [];
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
                soundboard.addSound(name, source, sourceType, type);
                soundboard.addSoundDialog.close();
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
        const scene = new Scene(name);
        this.scenes.push(scene);
        this.scenesContainer.appendChild(scene.element);
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

    addSound(name, source, sourceType, type) {
        const sound = new Sound(name, source, type);
        this.currentScene.addSound(sound);
    }

    setVolume(value) {
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

    stopAllMusic(exceptSound) {
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                if (sound.type === 'music' && sound !== exceptSound) {
                    sound.stop();
                }
            });
        });
    }

    skipToNextTrack() {
        if (this.currentlyPlayingMusic) {
            this.currentlyPlayingMusic.stop();
        }
        if (this.musicQueue.length > 0) {
            const nextTrack = this.musicQueue.shift();
            nextTrack.play();
            this.currentlyPlayingMusic = nextTrack;
        }
    }

    setGlobalVolume(value) {
        const volume = value / 100;
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                sound.setVolume(volume);
            });
        });
    }

    addToMusicQueue(sound) {
        if (sound.type === 'music') {
            this.musicQueue.push(sound);
        }
    }
}

let tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
let firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var soundboard;

window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube IFrame API ready');
    soundboard = new Soundboard();

    const scene1 = soundboard.addScene('Example');
    scene1.addSound(new Sound('Doorbell', 'assets/sounds/sound1.mp3', 'effect'));

    soundboard.updatePlayingState();
};

