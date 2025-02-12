document.addEventListener('DOMContentLoaded', () => {
    const ids = {};
    document.querySelectorAll('[id]').forEach(el => {
        if (ids[el.id]) {
            console.warn(`Duplicate ID found: ${el.id}`);
        }
        ids[el.id] = true;
    });
});

class ViewManager {
    constructor() {
        this.currentView = 'scenes';
        //this.button = document.getElementById('view-toggle'); // Uncomment to continue working on AssetManager
        this.app = document.getElementById('content');
        this.scenesContainer = document.getElementById('scenes-container');
        this.assetsContainer = document.getElementById('assets-container');
        this.assetManager = new AssetManager(soundboard);
        
        this.initEventListeners();
    }

    initEventListeners() {
        //this.button.addEventListener('click', () => this.toggleView());
    }

    toggleView() {
        if (this.currentView === 'scenes') {
            this.currentView = 'assets';
            this.app.classList.add('show-assets');
            this.button.querySelector('svg use').setAttribute('href', '#asset-view-icon');
            soundboard.allowHotkeys = false;
        } else {
            this.currentView = 'scenes';
            this.app.classList.remove('show-assets');
            this.button.querySelector('svg use').setAttribute('href', '#scene-view-icon');
            soundboard.allowHotkeys = true;
        }
    }
}

class AssetManager {
    constructor(soundboard) {
        this.soundboard = soundboard;
        this.container = document.getElementById('assets-container');
        this.searchInput = document.getElementById('asset-search');
        this.searchFilter = document.getElementById('search-filter');
        this.assetsGrid = this.container.querySelector('.assets-grid');
        
        this.initEventListeners();
        this.render();
    }

    initEventListeners() {
        this.searchInput.addEventListener('input', () => this.handleSearch());
        this.searchFilter.addEventListener('change', () => this.handleSearch());
    }

    handleSearch() {
        const query = this.searchInput.value.toLowerCase();
        const filter = this.searchFilter.value;
        
        const filteredAssets = this.soundboard.soundAssets.filter(asset => {
            if (filter === 'name') {
                return asset.name.toLowerCase().includes(query);
            } else {
                return asset.tags.some(tag => tag.toLowerCase().includes(query));
            }
        });

        this.renderAssets(filteredAssets);
    }

    renderAssetCard(asset) {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
            <div class="asset-header">
                <span class="asset-name">${asset.name}</span>
                <div class="asset-controls">
                    <button class="play-asset">▶</button>
                    <button class="delete-asset">🗑️</button>
                </div>
            </div>
            <div class="asset-type">
                <img src="assets/${asset.type}.svg" alt="${asset.type}" class="sound-type-icon">
                ${asset.isYouTube ? '<span class="youtube-indicator">YouTube</span>' : 'Local'}
            </div>
            <div class="asset-tags">
                ${asset.tags.map(tag => `<span class="asset-tag">${tag}</span>`).join('')}
                <button class="add-tag">+ Add Tag</button>
            </div>
        `;

        // Add event listeners
        card.querySelector('.play-asset').addEventListener('click', () => this.playAsset(asset));
        card.querySelector('.delete-asset').addEventListener('click', () => this.deleteAsset(asset));
        card.querySelector('.add-tag').addEventListener('click', () => this.addTag(asset));

        return card;
    }

    renderAssets(assets = this.soundboard.soundAssets) {
        this.assetsGrid.innerHTML = '';
        assets.forEach(asset => {
            this.assetsGrid.appendChild(this.renderAssetCard(asset));
        });
    }

    async playAsset(asset) {
        // TODO: Implement playback
    }

    async deleteAsset(asset) {
        // Create and show confirmation dialog
        const dialog = document.createElement('dialog');
        dialog.className = 'sound-options-dialog';
        dialog.innerHTML = `
            <form method="dialog">
                <h3>Delete Asset "${asset.name}"?</h3>
                <p>This will remove all instances of this sound from your scenes.</p>
                <div class="dialog-buttons">
                    <button type="submit" value="cancel">Cancel</button>
                    <button type="submit" value="confirm" class="delete-confirm">Delete</button>
                </div>
            </form>
        `;

        // Style delete button
        const deleteButton = dialog.querySelector('.delete-confirm');
        deleteButton.style.backgroundColor = 'var(--accent-primary)';

        document.body.appendChild(dialog);
        dialog.showModal();

        // Handle dialog response
        const result = await new Promise(resolve => {
            dialog.addEventListener('close', () => {
                resolve(dialog.returnValue);
                dialog.remove();
            });
        });

        if (result === 'confirm') {
            try {
                // Remove all sounds that use this asset
                this.soundboard.scenes.forEach(scene => {
                    scene.sounds = scene.sounds.filter(sound => sound.asset !== asset);
                });

                // Remove from soundAssets array
                const index = this.soundboard.soundAssets.indexOf(asset);
                if (index > -1) {
                    this.soundboard.soundAssets.splice(index, 1);
                }

                // Delete from database
                await window.electronAPI.deleteAsset(asset.id);

                // Update UI
                this.render();
                
                // Save state
                this.soundboard.saveState();
            } catch (error) {
                console.error('Failed to delete asset:', error);
                // Show error dialog
                const errorDialog = document.createElement('dialog');
                errorDialog.className = 'sound-options-dialog';
                errorDialog.innerHTML = `
                    <form method="dialog">
                        <h3>Error</h3>
                        <p>Failed to delete asset: ${error.message}</p>
                        <div class="dialog-buttons">
                            <button type="submit">OK</button>
                        </div>
                    </form>
                `;
                document.body.appendChild(errorDialog);
                errorDialog.showModal();
                errorDialog.addEventListener('close', () => errorDialog.remove());
            }
        }
    }

    async addTag(asset) {
        const tag = prompt('Enter new tag:');
        if (tag && !asset.tags.includes(tag)) {
            asset.tags.push(tag);
            this.render();
            // TODO: Save to database
        }
    }

    render() {
        this.renderAssets();
    }
}

/***************************************************************************************
 * SOUNDASSET
 * 
 * Contains & manages data for url, soundType, sourceType, and tags.
 * References a HTML Div element with this.element
 * 
 * NOTE: Refactoring in progress.
 ***************************************************************************************/

class SoundAsset {
    constructor(name, source, type) {
        this.element = this.createAssetElement();       // Reference to corresponding div in DOM (HTMLDivElement)

        this.name = name;                               // Display name of the audio asset (string)
        this.title = '';                                // For YT audio; the name of the video associated with this asset (string) 
        this.source = source;                           // URL or file location (string)
        this.type = type;                               // Playback type (string: 'music', 'ambient', or 'effect')
        this.isYouTube = this.isYouTubeLink(source);    // Is this Youtube content or locally-stored audio? (bool)
        this.tags = [];                                 // List of relevant tags (list<string>)
        this.id = `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique identifier (string)
    }

    createAssetElement() {
        return null;
    }

    isYouTubeLink(url) {
        return url.includes('youtube.com') || url.includes('youtu.be');
    }

    delete() {
        const index = soundboard.soundAssets.indexOf(this);
        soundboard.soundAssets.splice(index, 1);
    }

    /**** DO NOT USE ****/
    async updateSource(newSource) {
        this.source = newSource;
        this.isYouTube = this.isYouTubeLink(newSource);
        // TODO: Loop through all sounds, update sounds that have this Asset
        /*
        if (this.isYouTube) {
            await this.initYouTubePlayer();
        } else {
            this.audio = new Audio(newSource);
            this.audio.volume = this.volume;
            if (this.type === 'ambient') {
                this.audio.loop = true;
            }
        }
        soundboard.updateSoundSource(this);
        */
    }
}

/***************************************************************************************
 * SOUNDSCAPE
 * 
 * Contains & manages data for playback, local volume, queue, scene membership.
 * References a SoundAsset object, which contains data for all duplicate sounds.
 * References a HTML Div element with this.element
 * References a Scene, which contains the element.
 * 
 * NOTE: Refactoring in progress.
 ***************************************************************************************/

class Soundscape {
    constructor(asset) {
        this.asset = asset;                             // Reference to corresponding SoundAsset (SoundAsset)
        this.element = this.createSoundElement();       // Reference to corresponding div in DOM (HTMLDivElement)
        this.scene = null;                              // Reference to corresponding Scene (Scene)

        this.name = asset.name;                         // By default, our name is equal to the Asset's name (string)
        this.isPlaying = false;                         // Is this Soundscape currently playing audio? (bool)
        this.wasPaused = false;                         // Was playback paused (not stopped)? (bool)
        this.queued = false;                            // Are we in the queue? (bool)
        this.id = `sound-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // Unique identifier (string)
        this.volume = 1;                                // Individual sound volume (float, 0...1)
        this.fadeMultiplier = 1;                        // How much crossfade is applied at this moment (float, 0...1)
        this.duration = 0;                              // Length of the audio (float)
        this.currentTime = 0;                           // How far into the playback are we? (float)

        // Initialize audio playback depending on Asset type.
        if (this.asset.isYouTube) {
            this.initYouTubePlayer();
        } else {
            this.audio = new Audio(asset.source);
            this.audio.addEventListener('ended', () => this.onEnded());
            if (this.asset.type === 'ambient') {
                this.audio.loop = true;
            }
        }
    }

    async initYouTubePlayer() {
        const videoId = this.getYouTubeVideoId(this.asset.source);
        if (!videoId) {
            console.error('Invalid YouTube URL');
            return;
        }

        const playerElement = document.createElement('div');
        playerElement.id = `youtube-player-${Date.now()}`;
        playerElement.style.display = 'none';
        document.body.appendChild(playerElement);

        this.youtubePlayer = new YT.Player(playerElement.id, {
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
                'onStateChange': this.onYouTubePlayerStateChange.bind(this),
                'onError': this.onYouTubePlayerError.bind(this),  // Add this line
                'onPlaybackRateChange': this.onPlaybackRateChange.bind(this),
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
        
        // Set asset title after the player is ready, but only if it hasn't been set already. 
        if (this.asset.title == '') {
            this.asset.title = event.target.getVideoData().title;
        }

        if (this.asset.type === 'ambient') {
            event.target.setLoop(true);
        }
    }

    onYouTubePlayerStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) {
            this.onEnded();
        }
    }

    onYouTubePlayerError(event) {
        console.error('YouTube player error:', event.data);
        if (event.data == 150) {
            console.error("The creator of this video has disabled content embedding.");
            alert('The creator of this video has disabled content embedding.');
            this.delete();
            this.asset.delete();
            
        }
    }

    onPlaybackRateChange(event) {
        // Fired when the video playback rate changes.
        console.log('Playback rate changed to:', event.data);
      }

    createSoundElement() {
        const soundEl = document.createElement('div');
        soundEl.className = `sound ${this.asset.type} ${this.asset.isYouTube ? 'youtube' : 'local'}`;
        soundEl.dataset.soundId = this.id;
        soundEl.draggable = true;
        soundEl.innerHTML = `
            <div class="sound-type-indicator">
                <img src="assets/${this.asset.type}.svg" alt="Indicator" class="sound-type-icon">
            </div>
            <div class="sound-content">
                <div class="sound-name">${this.name}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar">
                        <div class="progress"></div>
                    </div>
                    <div class="timestamp-tooltip">00:00</div>
                </div>
            </div>
            <div class="sound-controls">
                <button class="sound-button play" title="Play">▶</button>
                <button class="sound-button stop" title="Stop">■</button>
                ${this.asset.type === 'music' ? '<button class="sound-button queue" title="Queue">+</button>' : ''}
            </div>
            <button class="sound-options" title="Options">⚙️</button>
        `;

        //soundEl.querySelector('.play').addEventListener('click', () => this.play());
        soundEl.querySelector('.play').addEventListener('click', () => soundboard.playSound(this));
        soundEl.querySelector('.stop').addEventListener('click', () => this.softStop());
        soundEl.querySelector('.sound-options').addEventListener('click', () => this.showOptionsDialog());

        if (this.asset.type === 'music') {
            soundEl.querySelector('.queue').addEventListener('click', () => {console.log("EVENT: addToQueue (Sound)"); this.addToQueue()});
        }

        this.progressBar = soundEl.querySelector('.progress-bar');
        this.progress = soundEl.querySelector('.progress');
        this.timestampTooltip = soundEl.querySelector('.timestamp-tooltip');

        this.progressBar.addEventListener('mousedown', this.handleScrubStart.bind(this));
        this.progressBar.addEventListener('mousemove', this.handleScrubMove.bind(this));
        this.progressBar.addEventListener('mouseleave', () => this.timestampTooltip.style.display = 'none');


        //this.progressBar = soundEl.querySelector('.progress');

        return soundEl;
    }

    showOptionsDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'sound-options-dialog';
        dialog.innerHTML = `
            <form method="dialog">
                <h3>Options for "${this.name}" (${this.asset.type.charAt(0).toUpperCase() + this.asset.type.slice(1)})</h3>
                <p>${this.asset.title}</p>
                <label>
                    Rename:
                    <input type="text" id="sound-name-input" value="${this.name}">
                </label>
                <label>
                    Volume:
                    <input type="range" min="0" max="1" step="0.01" value="${this.volume}" id="volume-slider">
                </label>
                <div class="dialog-buttons">
                    <button type="submit">Save</button>
                    <button type="button" id="cancel-button">Cancel</button>
                    <button type="button" id="delete-sound">Delete Sound</button>
                </div>
            </form>
        `;

        /* TODO: Move this field into a dialog in SOUNDASSET 
        <label>
            Source:
            <input type="text" value="${this.asset.source}" id="source-input">
        </label>
        */

        const nameInput = dialog.querySelector('#sound-name-input');
        const volumeSlider = dialog.querySelector('#volume-slider');
        //const sourceInput = dialog.querySelector('#source-input');

        volumeSlider.addEventListener('input', (e) => {
            const newVolume = parseFloat(volumeSlider.value);
            this.setVolume(newVolume);
        })

        dialog.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = nameInput.value.trim();
            const newVolume = parseFloat(volumeSlider.value);
            //const newSource = sourceInput.value.trim();

            if (newName && newName !== this.name) {
                this.rename(newName);
            }
            this.setVolume(newVolume);

            /* TODO: Move this into SOUNDASSET
            if (newSource && newSource !== this.asset.source) {
                this.updateSource(newSource);
            }
            */
            
            dialog.close();
            soundboard.allowHotkeys = true;
        });

        dialog.querySelector('#delete-sound').addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this sound?')) {
                this.delete();
                dialog.close();
                soundboard.allowHotkeys = true;
            }
        });

        dialog.querySelector('#cancel-button').addEventListener('click', () => {
            dialog.close();
            soundboard.allowHotkeys = true;
        });

        document.body.appendChild(dialog);
        dialog.showModal();
        soundboard.allowHotkeys = false;
    }

    setVolume(volume) {
        console.log("Volume set (SOUND)")
        this.volume = volume;
        this.updateEffectiveVolume();
        soundboard.updateSoundVolume(this);
    }

    updateEffectiveVolume() {
        console.log("Effective volume set")
        let m = this.asset.type == "effect" ? 1 : (soundboard.crossfadeEnabled ? this.fadeMultiplier : 1);
        const effectiveVolume = this.volume * soundboard.volume * m;
        if (this.asset.isYouTube && this.youtubePlayer) {
            this.youtubePlayer.setVolume(effectiveVolume * 100);
        } else if (this.audio) {
            this.audio.volume = effectiveVolume;
        }
    }

    rename(newName) {
        this.name = newName;
        this.element.querySelector('.sound-name').textContent = newName;
        soundboard.updateSoundName(this);
        //this.scene.sortSounds(); We don't do alphabetical sorting anymore
    }

    delete() {
        this.stop();
        this.scene.removeSound(this);
        soundboard.removeFromMusicQueue(this);
    }

    play() {
        this.isPlaying = true;
        this.element.classList.add('playing');
        this.progressBar.style.cursor = 'pointer';

        if (this.asset.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.playVideo) {
                this.youtubePlayer.playVideo();
                this.startYouTubeProgressUpdate();
            }
            
        } else {
            this.audio.play();
            this.startAudioProgressUpdate();
        }
        this.element.classList.add('playing');
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        this.updateEffectiveVolume();
    }

    togglePause() {
        if (this.asset.isYouTube) {
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

    softStop() {
        if (soundboard.fadeAmount == 0) 
        {
            this.stop();
        }
        else 
        {
            this.startFadeOut();
        }   
    }

    stop() {
        if (this.fadeInInterval) {
            clearInterval(this.fadeInInterval)
        }
        if (this.fadeOutInterval) {
            clearInterval(this.fadeOutInterval)
        }
        this.isPlaying = false;
        this.fadeMultiplier = 1;
        this.element.classList.remove('playing');
        this.progressBar.style.cursor = 'default';

        if (this.asset.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.stopVideo) {
                this.youtubePlayer.stopVideo();
            }
        } else {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        
        if (this.scene) {
            this.scene.updatePlayingState();
        }
        this.stopProgressUpdate();
        this.resetProgress();
    }

    handleScrubStart(e) {
        if (!this.isPlaying) return;

        const scrubTime = this.getScrubTime(e);
        this.scrub(scrubTime);
        
        const onMouseMove = (e) => {
            if (this.isPlaying) {
                this.scrub(this.getScrubTime(e));
            }
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    handleScrubMove(e) {
        if (!this.isPlaying) return;

        const scrubTime = this.getScrubTime(e);
        this.updateTimestampTooltip(scrubTime);
    }

    getScrubTime(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        return percent * this.duration;
    }

    scrub(scrubTime) {
        if (!this.isPlaying) return;
        
        if (this.asset.isYouTube) {
            if (this.youtubePlayer && this.youtubePlayer.seekTo) {
                this.youtubePlayer.seekTo(scrubTime, true);
            }
        } else if (this.audio) {
            this.audio.currentTime = scrubTime;
        }
        this.updateProgress(scrubTime, this.duration);
    }

    updateTimestampTooltip(time) {
        if (!this.isPlaying) {
            this.timestampTooltip.style.display = 'none';
            return;
        }
        this.timestampTooltip.textContent = this.formatTime(time);
        this.timestampTooltip.style.display = 'block';
        const rect = this.progressBar.getBoundingClientRect();
        const percent = time / this.duration;
        this.timestampTooltip.style.left = `${percent * rect.width}px`;
    }

    formatTime(time) {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updateProgress(currentTime, duration) {
        this.currentTime = currentTime;
        this.duration = duration;
        let remainingTime = duration - currentTime;
        if (this.progress) {
            const progress = (currentTime / duration) * 100;
            this.progress.style.width = `${progress}%`;
        }

        // How many increments will it take to bring the fade multiplier to 0? 
        if (soundboard.fadeAmount > 0 && duration > 0) {
            let numIncrements = 1 / this.getFadeIncrement();
            let threshold = numIncrements * .2; // make sure everything is in seconds
            //console.log("fm:"+this.fadeMultiplier+", rt:"+remainingTime+", thresh:"+threshold);
            
            if (this.fadeMultiplier == 1 && remainingTime <= threshold && this.asset.type === "music") {
                soundboard.playNextInQueue();
                this.startFadeOut();
            }
        }
    }

    resetProgress() {
        if (this.progress) {
            this.progress.style.width = '0%';
        }
    }

    getFadeIncrement() {
        return (1.15/soundboard.fadeMod) - (soundboard.fadeAmount/soundboard.fadeMod)
    }

    startFadeOut() {
        clearInterval(this.fadeOutInterval);
        this.fadeMultiplier = 1;
        this.fadeOutInterval = setInterval(() => {
            this.fadeMultiplier -= this.getFadeIncrement();
            if (this.fadeMultiplier <= 0 || !this.isPlaying) {
                this.fadeMultiplier = 1;
                clearInterval(this.fadeOutInterval);
                this.stop();
            }
            this.updateEffectiveVolume();
        }, 100);
    }

    startFadeIn() {
        clearInterval(this.fadeInInterval);
        this.fadeMultiplier = 0;
        this.fadeInInterval = setInterval(() => {
            this.fadeMultiplier += this.getFadeIncrement();
            if (this.fadeMultiplier >= 1 || !this.isPlaying) {
                this.fadeMultiplier = 1;
                clearInterval(this.fadeInInterval);
            }
            this.updateEffectiveVolume();
        }, 200);
    }

    startAudioProgressUpdate() {
        this.stopProgressUpdate(); // Clear any existing interval
        this.progressInterval = setInterval(() => {
            this.updateProgress(this.audio.currentTime, this.audio.duration);
            if (this.audio.ended) {
                this.onEnded();
            }
        }, 200);
    }

    startYouTubeProgressUpdate() {
        this.stopProgressUpdate(); // Clear any existing interval
        this.progressInterval = setInterval(() => {
            if (this.youtubePlayer && this.youtubePlayer.getCurrentTime) {
                const currentTime = this.youtubePlayer.getCurrentTime();
                const duration = this.youtubePlayer.getDuration();
                console.log("SOUND: "+this.name+": "+currentTime+"/"+duration)
                this.updateProgress(currentTime, duration);
            }
        }, 200);
    }

    stopProgressUpdate() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    toggleQueue() {
        console.log("Toggled queue status")
        if (this.queued) {
            soundboard.removeFromMusicQueue(this);
        } else {
            soundboard.addToMusicQueue(this);
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
        if (this.asset.type === 'music') {
            console.log("Set queued to true.")
            this.queued = true;
            soundboard.addToMusicQueue(this);
        }
    }

    removeFromQueue() {
        if (this.queued) {
            this.toggleQueue();
        }
    }

    onEnded() {
        this.stop();
        if (this.asset.type === 'ambient') 
        {
            this.play();
        }
        if (this.asset.type === 'music')
        {
            soundboard.playNextInQueue();
            
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
        soundEl.draggable = true;
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
        this.renderSounds();
        this.isOpen = true;
        this.initDragAndDrop();
        _soundboard.scenesContainer.appendChild(_soundboard.scenesContainer.querySelector(".add-scene-button"));
    }

    initDragAndDrop() {
        this.contentElement.addEventListener('dragstart', this.handleSoundDragStart.bind(this));
        this.contentElement.addEventListener('dragover', this.handleSoundDragOver.bind(this));
        this.contentElement.addEventListener('dragleave', this.handleSoundDragLeave.bind(this));
        this.contentElement.addEventListener('drop', this.handleSoundDrop.bind(this));
        this.contentElement.addEventListener('dragend', this.handleSoundDragEnd.bind(this));
    }

    createSceneElement() {
        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene';
        sceneEl.dataset.sceneId = this.id;
        sceneEl.innerHTML = `
            <div class="scene-header" draggable="true">
                <span>${this.name}</span>
                <div>
                    <button class="multiqueue-button">
                        <img src="assets/multiqueue.svg" alt="multiqueue" class="multiqueue-icon">
                    </button>
                    <button class="toggle-scene">▼</button>
                </div>
            </div>
            <div class="scene-content"></div>
        `;

        /*
        <div class="scene-content">
            <button class="add-sound-button">+ Add Soundscape</button>
        </div>
        */    

        sceneEl.addEventListener('click', (e) => {
            if (soundboard.deleteMode) {
                e.stopPropagation();
                soundboard.deleteScene(this);
            }
        });

        sceneEl.querySelector('.toggle-scene').addEventListener('click', () => this.toggleContent());
        sceneEl.querySelector('.multiqueue-button').addEventListener('click', () => this.multiQueue());
        sceneEl.querySelector('.multiqueue-button').title = "Queue all music in Scene"

        return sceneEl;
    }

    renderSounds() {
        const contentEl = this.contentElement;
        // Clear existing sounds
        contentEl.innerHTML = '';
        // Re-add sorted sounds
        this.sounds.forEach(sound => {
            const soundEl = sound.createSoundElement();
            sound.element = soundEl;
            contentEl.appendChild(soundEl);
        });
        // Add the "Add Sound" button at the end
        const addSoundButton = document.createElement('button');
        addSoundButton.className = 'add-sound-button';
        addSoundButton.textContent = '+ Add Soundscape';
        addSoundButton.addEventListener('click', () => soundboard.showAssetOrCustomDialog(this));
        contentEl.appendChild(addSoundButton);
    }

    addSound(sound,save=false) {
        console.log("Added sound to Scene.")
        this.sounds.push(sound);
        sound.scene = this;
        this.contentElement.insertBefore(sound.element, this.contentElement.querySelector('.add-sound-button'));
        this.sortSounds();
        if (save) soundboard.saveState()
    }

    removeSound(sound) {
        const index = this.sounds.indexOf(sound);
        if (index !== -1) {
            this.sounds.splice(index, 1);
            this.contentElement.removeChild(sound.element);
            window.electronAPI.deleteSound(sound.id);
        }
    }

    sortSounds() {
        /*
        const typeOrder = { 'effect': 0, 'ambient': 1, 'music': 2 };
        this.sounds.sort((a, b) => {
            let diff = typeOrder[a.type] - typeOrder[b.type];
            if (diff != 0) return diff;
            if (a.name < b.name) return -1;
            if (a.name > b.name) return 1; 
            return 0;
        });
        */
        this.renderSounds();
    }

    toggleDeleteMode(isDeleteMode) {
        this.element.classList.toggle('deletable', isDeleteMode);
    }

    toggleContent() {
        this.isOpen = !this.isOpen;
        this.contentElement.classList.toggle('hidden', !this.isOpen);
        const toggleButton = this.element.querySelector('.toggle-scene');
        toggleButton.textContent = this.isOpen ? '▼' : '▶';
        this.updatePlayingState();
    }

    multiQueue() {
        this.sounds.forEach(sound => {
            sound.addToQueue();
        })
    }

    updatePlayingState() {
        const isAnyPlaying = this.sounds.some(sound => sound.isPlaying);
        this.element.classList.toggle('playing', isAnyPlaying);
        this.element.classList.toggle('playing-closed', isAnyPlaying && !this.isOpen);
        soundboard.updatePlayingState();
    }

    handleSoundDragStart(e) {
        console.log("SOUND DRAG START");
        soundboard.draggedElement = e.target;
        if (e.target.classList.contains('sound')) {
            //e.dataTransfer.setData('text/plain', e.target.dataset.soundId);
            e.target.style.opacity = '0.5';
            console.log(e.target);
        }
    }
    
    handleSoundDragOver(e) {
        console.log("SOUND DRAG OVER START");
        e.preventDefault();
        if (soundboard.draggedElement.classList.contains('sound')) {
            const targetElement = e.target.closest('.sound');
            if (targetElement && targetElement !== soundboard.draggedElement) {
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
    
    handleSoundDragLeave(e) {
        console.log("SOUND DRAG LEAVE");
        if (e.target.classList.contains('sound')) {
            e.target.style.borderTop = '';
            e.target.style.borderBottom = '';
        }
    }
    
    handleSoundDrop(e) {
        console.log("SOUND DRAG DROP");
        e.preventDefault();
        
        if (soundboard.draggedElement.classList.contains('sound')) {
            console.log(e.target)
            const targetElement = e.target.closest('.sound');
            
            if (targetElement && targetElement !== soundboard.draggedElement) {
                const rect = targetElement.getBoundingClientRect();
                const isGridLayout = window.innerWidth >= 300 && window.innerHeight >= 200;
                
                if (isGridLayout) {
                    const midX = rect.left + rect.width / 2;
                    
                    if (e.clientX < midX) {
                        this.contentElement.insertBefore(soundboard.draggedElement, targetElement);
                    } else {
                        this.contentElement.insertBefore(soundboard.draggedElement, targetElement.nextSibling);
                    }
                } else {
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY < midY) {
                        this.contentElement.insertBefore(soundboard.draggedElement, targetElement);
                    } else {
                        this.contentElement.insertBefore(soundboard.draggedElement, targetElement.nextSibling);
                    } 
                }
                this.updateOrder();
                //this.renderSounds();
                //this.updateQueueOrder();
                //this.updateQueueNumbers();
            }
        }
    }
    
    handleSoundDragEnd(e) {
        console.log("SOUND DRAG END");
        if (soundboard.draggedElement.classList.contains('sound')) {
            
            soundboard.draggedElement.style.opacity = '1';
            soundboard.draggedElement = null;
            
            this.contentElement.querySelectorAll('.sound').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
        }
    }

    updateOrder() {
        const newOrder = Array.from(this.contentElement.querySelectorAll('.sound')).map(el => el.dataset.soundId);
        this.sounds = newOrder.map(id => soundboard.findSoundById(id));
        soundboard.saveState();
    }
    
}

/* --- TODO: Transfer method control to VisualQueue from Soundboard */
class VisualQueue extends Scene {
    constructor(soundboard) {
        super("Queue",soundboard);
        this.element.classList.add('visual-queue');
        
        //this.initDragAndDrop();
    }

    initDragAndDrop() {

    }

    renderSounds() {

    }

    
    createSceneElement() {
        const sceneEl = document.createElement('div');
        sceneEl.className = 'scene';
        sceneEl.dataset.sceneId = this.id;
        sceneEl.innerHTML = `
            <div class="scene-header" draggable="true">
                <span>${this.name}</span>
                <div>
                    <button class="multiqueue-button">
                        <img src="assets/dequeue.svg" alt="multiqueue" class="multiqueue-icon">
                    </button>
                    <button class="toggle-scene">▼</button>
                </div>
            </div>
            <div class="scene-content"></div>
        `;

        
        //<div class="scene-content">
        //    <button class="add-sound-button">+ Add Soundscape</button>
        //</div>
            

        sceneEl.addEventListener('click', (e) => {
            if (soundboard.deleteMode) {
                e.stopPropagation();
                soundboard.deleteScene(this);
            }
        });

        sceneEl.querySelector('.toggle-scene').addEventListener('click', () => this.toggleContent());
        sceneEl.querySelector('.multiqueue-button').addEventListener('click', () => soundboard.dequeueAll());
        sceneEl.querySelector('.multiqueue-button').title = "Remove all music from queue";

        return sceneEl;
    }
    

    dequeueAll() {
        /*
        console.log("Dequeue all (Visual Queue)")
        soundboard.musicQueue.forEach(sound => {
            //this.removeSound(sound);
            this.removeSound(sound);
        });
        */
    }

    addSound(sound,save=false) {
        /*
        console.log("Added sound to Queue (VisualQueue).")
        const queuedSound = new QueuedSound(sound);
        super.addSound(queuedSound);
        //this.initSoundDragAndDrop(queuedSound.element);
        */
    }

    /*
    initSoundDragAndDrop(soundElement) {
        soundElement.setAttribute('draggable', true);
        soundElement.addEventListener('dragstart', () => {
            soundElement.classList.add('dragging');
        });
        soundElement.addEventListener('dragend', () => {
            soundElement.classList.remove('dragging');
        });
    }
    */

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

    // Sound: the original Sound object, not the QueuedSound object.
    removeSound(sound) {
        /*
        console.log("Removed sound from queue (VisualQueue).");
        const index = this.sounds.findIndex(s => s.originalSound === sound);
        if (index !== -1) {
            this.sounds.splice(index, 1);
            this.contentElement.removeChild(this.sounds[index].element);
            soundboard.removeFromMusicQueue(sound);
        }
        */
    }
}

class Soundboard {
    constructor() {
        this.allowHotkeys = true;
        this.soundFilePath = "";
        this.scenes = [];
        this.soundAssets = [];
        this.scenesContainer = document.getElementById('scenes-container');
        this.menuButton = document.getElementById('menu-button');
        this.menu = document.getElementById('menu');
        this.minimizeButton = document.getElementById('minimize');
        this.addSceneButton = document.getElementById('add-scene');
        this.findSceneButton = document.getElementById('find-scene');
        this.aboutButton = document.getElementById('about');
        this.quitButton = document.getElementById('quit-app');
        this.resizeHandle = document.getElementById('resize-handle');
        this.initResizeHandle();
        this.pauseButton = document.getElementById('pause-button');
        this.skipButton = document.getElementById('skip-button');
        this.volumeSlider = document.getElementById('volume-slider');
        this.fadeSlider = document.getElementById('fade-slider');
        this.crossfadeToggle = document.getElementById('crossfade-toggle');
        this.fadeContainer = document.querySelector('.fade-container');
        this.initSliders();
        this.volume = 1;
        this.fadeAmount = 0;
        this.fadeMod = 25;
        this.addSceneDialog = document.getElementById('add-scene-dialog');
        this.addSoundDialog = document.getElementById('add-sound-dialog');
        this.findSceneDialog = document.getElementById('find-scene-dialog');
        this.aboutDialog = document.getElementById('about-dialog');
        this.assetCustomDialog = document.getElementById('asset-custom-dialog');
        this.addExistingAssetDialog = document.getElementById('sound-asset-dialog');
        this.isGloballyPaused = false;
        this.createAddSceneButton();
        
        this.visualQueue = new VisualQueue(this);
        //this.scenesContainer.appendChild(this.visualQueue.element);
        this.musicQueue = [];
        this.queueContainer = this.visualQueue.element.querySelector(".scene-content");  //document.getElementById('queue-container');
        this.draggedElement = null;
        this.initSceneDragAndDrop();
        this.initQueueDragAndDrop();
        this.currentlyPlayingMusic = null;

        this.deleteMode = false;
        this.initDeleteSceneButton();
        
        this.initEventListeners();
        console.log('Soundboard initialized');
        
    }

    createAddSceneButton() {
        const addSceneButton = document.createElement('button');
        addSceneButton.className = 'add-scene-button';
        addSceneButton.textContent = '+ Add Scene';
        addSceneButton.addEventListener('click', () => soundboard.showAddSceneDialog());
        this.scenesContainer.appendChild(addSceneButton);
    }

    getPlayingSounds() {
        return this.scenes.flatMap(scene => scene.sounds.filter(sound => sound.isPlaying));
    }

    initEventListeners() {
        this.menuButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.toggleMenu();
        });
        this.minimizeButton.addEventListener('click', () => {
            window.electronAPI.minimizeApp();
        });
        this.addSceneButton.addEventListener('click', () => {
            this.showAddSceneDialog();
            this.toggleMenu();
        });
        this.findSceneButton.addEventListener('click', () => {
            this.showFindSceneDialog();
            this.toggleMenu();
        });
        this.aboutButton.addEventListener('click', () => {
            this.showAboutDialog();
            this.toggleMenu();
        });
        this.quitButton.addEventListener('click', () => this.quit());
        this.pauseButton.addEventListener('click', () => this.toggleGlobalPause());
        this.skipButton.addEventListener('click', () => this.playNextInQueue());
        
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
                soundboard.allowHotkeys = true;
            }
        });
        this.findSceneDialog.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            const sceneName = document.getElementById('find-scene-name').value;
            if (sceneName) {
                this.findScene(sceneName);
                this.findSceneDialog.close();
                soundboard.allowHotkeys = true;
            }
        });

        document.getElementById('cancel-add-scene').addEventListener('click', () => {
            this.addSceneDialog.close();
            soundboard.allowHotkeys = true;
        });
        document.getElementById('cancel-find-scene').addEventListener('click', () => {
            this.findSceneDialog.close();
            soundboard.allowHotkeys = true;
        });

        // Toggle hide on file explorer/URL input
        const soundSourceType = document.getElementById('sound-source-type');
        soundSourceType.addEventListener('change', (event) => {
            console.log(event.target.value);
            let yt = event.target.value == "youtube";
            const source = document.getElementById('sound-source');
            source.style.display = !yt ? 'block' : 'none';
            source.required = !yt;

            const url = document.getElementById('sound-url');
            url.style.display = yt ? 'block' : 'none';
            url.required = yt;
        })

        const soundSourceInput = document.getElementById('sound-source');
        soundSourceInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.soundFilePath = file.path;
                console.log('Selected file path:', this.soundFilePath);
            }
        });

        // Add sound dialog events
        this.addSoundDialog.querySelector('form').addEventListener('submit', (e) => {
            console.log("ASSERT A")
            e.preventDefault();
            let name = document.getElementById('sound-name').value;
            let source;
            let sourceType = document.getElementById('sound-source-type').value;
            
            if (sourceType == "local") {
                source = this.soundFilePath;
                console.log("Local Selection");
            }
            else {
                source = document.getElementById("sound-url").value
                console.log("ERROR")
            }
            let type = document.getElementById('sound-type').value;
            if (name && source && (type === 'music' || type === 'ambient' || type === 'effect')) {
                var asset = new SoundAsset(name, source, type);
                soundboard.soundAssets.push(asset);
                soundboard.addSound(asset,true);
                console.log("ASSERT B")
                soundboard.addSoundDialog.close();
                soundboard.allowHotkeys = true;
                this.soundFilePath = "";
                //soundboard.saveState();
            }
        });
        document.getElementById('cancel-add-sound').addEventListener('click', () => {
            this.addSoundDialog.close();
            soundboard.allowHotkeys = true;
        });
        document.getElementById('close-about').addEventListener('click', () => {
            this.aboutDialog.close();
            soundboard.allowHotkeys = true;
        });
        document.getElementById('add-custom').addEventListener('click', () => {
            this.assetCustomDialog.close();
            this.showAddSoundDialog();
        });
        document.getElementById('add-asset').addEventListener('click', () => {
            this.assetCustomDialog.close();
            this.showAddExistingAssetDialog();
        });
        document.getElementById('close-asset-dialog').addEventListener('click', () => {
            this.addExistingAssetDialog.close();
            soundboard.allowHotkeys = true;
        });

        this.crossfadeToggle.addEventListener('change', (e) => this.toggleCrossfade(e.target.checked));
        
    }

    initSliders() {
        this.volumeSlider.addEventListener('input', (e) => {
            this.setGlobalVolume(e.target.value);
            this.updateSliderTooltip(e.target, 'Volume');
        });
        this.fadeSlider.addEventListener('input', (e) => {
            soundboard.fadeSliderInput(e.target);
        });

        // Initialize tooltips
        this.updateSliderTooltip(this.volumeSlider, 'Volume');
        this.updateSliderTooltip(this.fadeSlider, 'Cross-fade');
    }

    fadeSliderInput(target) {
        this.setFadeAmount(target.value / 100);
        this.updateSliderTooltip(target, 'Cross-fade');
    }

    updateSliderTooltip(slider, baseText) {
        const value = Math.round(slider.value);
        slider.title = `${baseText}: ${value}%`;
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

    toggleCrossfade(enabled) {
        this.crossfadeEnabled = enabled;
        this.fadeContainer.style.display = enabled ? 'flex' : 'none';
        if (!enabled) {
            this.setFadeAmount(0);
        }
        else 
        {
            this.fadeSliderInput(this.fadeSlider)
        }
    }

    findScene(name) 
    {
        this.scenes.forEach(scene => {
            if (scene.name == name) {
                if (this.scenes.length > 2) scene.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => {
                    scene.element.classList.add('flash');
    
                    // Remove the flash class after the animation
                    setTimeout(() => {
                        scene.element.classList.remove('flash');
                    }, 1000); // 2000ms = 2s, matching the 1s animation repeated twice
                }, 500);
            }
        });
    }

    addScene(name, save=true) {
        const scene = new Scene(name, soundboard);
        this.scenes.push(scene);
        if (save) this.saveState();
        //this.scenesContainer.appendChild(scene.element); -- Redundant; is already in constructor
        return scene;
    }

    /***********
     * DIALOGS
    ************/

    //#region 

    showAddSceneDialog() {
        document.getElementById('scene-name').value = '';
        this.addSceneDialog.showModal();
        soundboard.allowHotkeys = false;
    }

    showFindSceneDialog() {
        document.getElementById('find-scene-name').value = '';
        this.findSceneDialog.showModal();
        soundboard.allowHotkeys = false;
    }

    showAssetOrCustomDialog(scene) {
        this.currentScene = scene;
        this.assetCustomDialog.showModal();
        soundboard.allowHotkeys = false;
    }

    showAddExistingAssetDialog() {
        this.populateAssetList();
        this.addExistingAssetDialog.showModal();
        soundboard.allowHotkeys = false;
        
        // Clear and focus search input
        const searchInput = document.getElementById('asset-dialog-search');
        searchInput.value = '';
        searchInput.focus();
    }

    populateAssetList() {
        const assetList = document.getElementById('sound-asset-list');
        const searchInput = document.getElementById('asset-dialog-search');
        
        const filterAssets = () => {
            const query = searchInput.value.toLowerCase();
            assetList.innerHTML = '';
            
            soundboard.soundAssets
                .filter(asset => asset.name.toLowerCase().includes(query))
                .forEach(asset => {
                    const card = this.createAssetCard(asset);
                    assetList.appendChild(card);
                });
        };
    
        // Initial population
        filterAssets();
    
        // Set up search handler if not already set
        if (!searchInput.hasSearchHandler) {
            searchInput.addEventListener('input', filterAssets);
            searchInput.hasSearchHandler = true;
        }
    }

    createAssetCard(asset) {
        const card = document.createElement('div');
        const title = asset.isYouTube && asset.title != '' ? ' ('+asset.title+')' : '';
        card.className = 'sound-asset-card';
        card.innerHTML = `
            <button class="delete-asset" title="Delete asset">✕</button>
            <div class="sound-asset-name">${asset.name}</div>
            <div class="sound-asset-info">
                ${asset.isYouTube ? `<span class="youtube-indicator">${title}</span>` : 'Local'}
                <img class="sound-type-icon" src="assets/${asset.type}.svg" alt="${asset.type}">
            </div>
        `;
        card.onclick = (e) => {
            // Don't trigger selection if clicking delete button
            if (!e.target.classList.contains('delete-asset')) {
                this.addExistingAssetDialog.close();
                soundboard.allowHotkeys = true; 
                soundboard.addSound(asset,true);
            }
        };
        card.querySelector('.delete-asset').addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card selection
            
            if (confirm(`Delete asset "${asset.name}"?`)) {
                try {
                    // Remove all sounds that use this asset
                    this.scenes.forEach(scene => {
                        scene.sounds = scene.sounds.filter(sound => sound.asset !== asset);
                    });
    
                    // Remove from soundAssets array
                    const index = this.soundAssets.indexOf(asset);
                    if (index > -1) {
                        this.soundAssets.splice(index, 1);
                    }
    
                    // Delete from database
                    await window.electronAPI.deleteAsset(asset.id);
    
                    // Update asset list
                    this.populateAssetList();
                    
                    // Save state
                    this.saveState();
                } catch (error) {
                    console.error('Failed to delete asset:', error);
                    alert('Failed to delete asset: ' + error.message);
                }
            }
        });
    
        return card;
    }

    showAddSoundDialog() {
        document.getElementById('sound-name').value = '';
        document.getElementById('sound-url').value = '';
        document.getElementById('sound-url').style.display = 'none';
        document.getElementById('sound-url').required = false;
        document.getElementById('sound-source').value = '';
        document.getElementById('sound-source-type').value = 'local';
        document.getElementById('sound-type').value = 'music';
        this.addSoundDialog.showModal();
        soundboard.allowHotkeys = false;
    }

    showAboutDialog() {
        this.aboutDialog.showModal();
    }

    //#endregion

    initDeleteSceneButton() {
        const deleteSceneButton = document.getElementById('delete-scene');
        deleteSceneButton.addEventListener('click', () => this.toggleDeleteMode());
    }

    toggleDeleteMode() {
        this.deleteMode = !this.deleteMode;
        document.body.classList.toggle('delete-mode', this.deleteMode);
        this.scenes.forEach(scene => scene.toggleDeleteMode(this.deleteMode));
        this.toggleMenu(); // Close the menu after activating delete mode
    }

    async deleteScene(scene) { // nasty little function
        try {
            const result = await window.electronAPI.deleteScene(scene.id);
            if (result.success) {
                const index = this.scenes.indexOf(scene);
                if (index > -1) {
                    this.scenes.splice(index, 1);
                    scene.element.remove();
                }
                console.log('Scene deleted successfully');
            } else {
                console.error('Failed to delete scene:', result.error);
                alert(`Failed to delete scene: ${result.error}`);
            }
        } catch (error) {
            console.error('Error deleting scene:', error);
            alert('An error occurred while deleting the scene');
        }
        this.toggleDeleteMode(); // Exit delete mode after attempting to delete a scene
    }

    async updateSoundName(sound) {
        try {
            await window.electronAPI.updateSoundName(sound.id, sound.name);
            console.log('Sound name updated successfully');
        } catch (error) {
            console.error('Failed to update sound name:', error);
            // Optionally, revert the name change in the UI
            sound.name = await window.electronAPI.getSoundName(sound.id);
            sound.element.querySelector('.sound-name').textContent = sound.name;
        }
    }

    async updateSoundVolume(sound) {
        try {
            await window.electronAPI.updateSoundVolume(sound.id, sound.volume);
            console.log('Sound volume updated successfully');
        } catch (error) {
            console.error('Failed to update sound volume:', error);
        }
    }

    async updateSoundSource(sound) {
        try {
            await window.electronAPI.updateSoundSource(sound.id, sound.asset.source);
            console.log('Sound source updated successfully');
        } catch (error) {
            console.error('Failed to update sound source:', error);
        }
    }

    addSound(asset,save=false) {
        const sound = new Soundscape(asset);
        this.currentScene.addSound(sound,save);
    }

    playSound(sound) {
        if (sound.asset.type === 'music') {
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
            if (soundboard.fadeAmount > 0) nextSound.startFadeIn();
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
                if (sound.asset.type === 'music' && sound.isPlaying) {
                    console.log("softstop");
                    sound.softStop();
                }
            });
        });
        this.currentlyPlayingMusic = null;
    }

    setGlobalVolume(volume) {
        this.volume = parseFloat(volume/100);
        
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                sound.updateEffectiveVolume();
            });
        });
        
    }

    setFadeAmount(fadeAmount) {
        this.fadeAmount = fadeAmount;
        /*
        this.scenes.forEach(scene => {
            scene.sounds.forEach(sound => {
                sound.updateEffectiveVolume();
            });
        });
        */
    }

    addToMusicQueue(sound) {
        console.log("Added Sound to queue (SOUNDBOARD)")
        sound.queued = true;
        if (!this.musicQueue.includes(sound)) {
            this.musicQueue.push(sound);
            this.saveQueue();
            this.updateVisualQueue();
        }
    }

    removeFromMusicQueue(sound) {
        console.log("Removed Sound from queue (SOUNDBOARD)")
        const index = this.musicQueue.indexOf(sound);
        if (index > -1) this._removeFromMusicQueueIndex(index);
        
    }

    _removeFromMusicQueueIndex(index) {
        const sound = this.musicQueue[index];
        sound.queued = false;
        if (index > -1) {
            this.musicQueue.splice(index, 1);
            const queueButton = sound.element.querySelector('.queue');
            if (queueButton) {
                queueButton.textContent = '+';
                queueButton.title = 'Add to Queue';
            }
            this.saveQueue();
            this.updateVisualQueue();
        }
        
    }

    dequeueAll() {
        console.log(this.musicQueue.length)
        while (this.musicQueue.length > 0) {
            this._removeFromMusicQueueIndex(0);
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
            <div class="sound-type-indicator ${sound.asset.type}"></div>
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

    async saveQueue() {
        await window.electronAPI.saveQueue(this.musicQueue.map(sound => ({ id: sound.id })));
    }

    async saveState() {
        console.log('Saving state...');
        
        for (const asset of this.soundAssets) {
            await window.electronAPI.saveAsset({
                id: asset.id,
                source: asset.source,
                type: asset.type,
                name: asset.name,
                title: asset.title,
            });
        }
        for (const scene of this.scenes) {
            await window.electronAPI.saveScene({ id: scene.id, name: scene.name });
            for (const sound of scene.sounds) {
                await window.electronAPI.saveSound({
                    id: sound.id,
                    scene_id: scene.id,
                    asset_id: sound.asset.id,
                    volume: sound.volume,
                    name: sound.name,
                });
            }
        }
        await this.saveQueue();
        localStorage.setItem('crossfadeEnabled', this.crossfadeEnabled);
        localStorage.setItem('fadeAmount', this.fadeAmount);

        console.log('State saved successfully');
    }

    async loadState() {
        try {
            console.log('Loading state...');
            const scenes = await window.electronAPI.getScenes();
            const assets = await window.electronAPI.getAssets();
            const sounds = await window.electronAPI.getSounds();
            const queue = await window.electronAPI.getQueue();

            console.log("Sounds loaded: "+sounds.length)

            scenes.forEach(sceneData => {
                const scene = this.addScene(sceneData.name,false);
                scene.id = sceneData.id;
            })
            
            assets.forEach(assetData => {
                const asset = new SoundAsset(assetData.name, assetData.source, assetData.type);
                asset.id = assetData.id;
                asset.title = assetData.title;
                soundboard.soundAssets.push(asset);
            })

            sounds.forEach(soundData => {
                const scene = this.scenes.find(s => s.id === soundData.scene_id);
                const asset = this.soundAssets.find(a => a.id === soundData.asset_id);

                if (asset) {
                    if (scene) {
                        console.log(`Asset loaded: ${asset.id}`)
                        const sound = new Soundscape(asset);
                        sound.id = soundData.id;
                        sound.volume = soundData.volume;
                        sound.name = soundData.name;
                        scene.addSound(sound,false);
                    }
                    else {
                        console.log("Error: Failed to link sound to scene.");
                    }
                }
                else {
                    console.log("Error: Failed to link sound to asset.")
                }
            });

            this.musicQueue = queue.map(queueItem => {
                return this.findSoundById(queueItem.sound_id);
            }).filter(sound => sound !== null);

            this.musicQueue.forEach(sound => {
                sound.queued = true;
            });

            const crossfadeEnabled = localStorage.getItem('crossfadeEnabled') === 'true';
            const fadeAmount = parseFloat(localStorage.getItem('fadeAmount') || '0');
            
            this.crossfadeToggle.checked = crossfadeEnabled;
            this.toggleCrossfade(crossfadeEnabled);
            this.fadeSlider.value = fadeAmount * 100;
            this.setFadeAmount(fadeAmount);

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
        this.scenesContainer.addEventListener('dragstart', this.handleSceneDragStart.bind(this));
        this.scenesContainer.addEventListener('dragover', this.handleSceneDragOver.bind(this));
        this.scenesContainer.addEventListener('dragleave', this.handleSceneDragLeave.bind(this));
        this.scenesContainer.addEventListener('drop', this.handleSceneDrop.bind(this));
        this.scenesContainer.addEventListener('dragend', this.handleSceneDragEnd.bind(this));
    }

    initQueueDragAndDrop() {
        this.queueContainer.addEventListener('dragstart', this.handleQueueDragStart.bind(this));
        this.queueContainer.addEventListener('dragover', this.handleQueueDragOver.bind(this));
        this.queueContainer.addEventListener('dragleave', this.handleQueueDragLeave.bind(this));
        this.queueContainer.addEventListener('drop', this.handleQueueDrop.bind(this));
        this.queueContainer.addEventListener('dragend', this.handleQueueDragEnd.bind(this));
    }

    handleQueueDragStart(e) {
        this.draggedElement = e.target;
        if (e.target.classList.contains('queued-sound')) {
            e.dataTransfer.setData('text/plain', e.target.dataset.soundId);
            e.target.style.opacity = '0.5';
        }
    }

    handleSceneDragStart(e) {
        console.log("START")
        this.draggedElement = e.target;
        console.log(e.target);
        if (e.target.classList.contains('scene-header')) {
            //e.target.closest('.scene').classList.add('dragging');
            e.target.classList.add('dragging');
        }
    }

    handleQueueDragOver(e) {
        e.preventDefault();
        if (this.draggedElement.classList.contains('queued-sound')) {
            const targetElement = e.target.closest('.queued-sound');
            if (targetElement && targetElement !== this.draggedElement && targetElement.classList.contains('scene-header')) {
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

    handleSceneDragOver(e) {
        e.preventDefault();
        //console.log(e.target)
        if (this.draggedElement.classList.contains('scene-header')) {
            const closestScene = this.getDragAfterElement(this.scenesContainer, e.clientY);
            if (e.target.classList.contains('scene-header'))  {
                if (closestScene && !closestScene.classList.contains('visual-queue')) {
                    this.scenesContainer.insertBefore(this.draggedElement.parentNode, closestScene);
                } else {
                    this.scenesContainer.appendChild(this.draggedElement.parentNode);
                }
            }
            
        }
    }

    handleQueueDragLeave(e) {
        if (e.target.classList.contains('queued-sound')) {
            e.target.style.borderTop = '';
            e.target.style.borderBottom = '';
        }
    }

    handleSceneDragLeave(e) {
        console.log("LEAVE")
        if (e.target.classList.contains('scene-header')) {
            //e.target.classList.remove('dragging');
        }
    }

    handleQueueDrop(e) {
        e.preventDefault();
        
        if (this.draggedElement.classList.contains('queued-sound')) {
            console.log(e.target)
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

    handleSceneDrop(e) {
        console.log("DROP")
        /*
        e.preventDefault();
        if (this.draggedElement) {
            const targetElement = e.target.closest('.queued-sound');
            if (e.target.classList.contains('scene-header')) {
                console.log("Dropped scene");
                this.draggedElement.classList.remove('dragging');
                this.updateSceneOrder();
            }
        }
        */
    }

    handleQueueDragEnd(e) {
        if (this.draggedElement.classList.contains('queued-sound')) {
            
            this.draggedElement.style.opacity = '1';
            this.draggedElement = null;
            
            this.queueContainer.querySelectorAll('.queued-sound').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            
        }
    }

    handleSceneDragEnd(e) {
        console.log("END");
        if (e.target.classList.contains('scene-header')) {
            //document.querySelector('.scene.dragging')?.classList.remove('dragging');
            this.draggedElement.classList.remove('dragging');
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

    async updateSceneOrder() {
        console.log(this.scenes)

        this.scenes = Array.from(this.scenesContainer.querySelectorAll('.scene:not(.visual-queue)'))
            .map(el => this.scenes.find(scene => scene.element.dataset.sceneId === el.dataset.sceneId));
            console.log(this.scenes)
        await window.electronAPI.updateSceneOrder(this.scenes.map(scene => scene.id));
    }

    updateQueueOrder() {
        const newOrder = Array.from(this.queueContainer.querySelectorAll('.queued-sound'))
            .map(el => this.musicQueue.find(sound => sound.id === el.dataset.soundId));
        this.musicQueue = newOrder;
    }

}


let keySequence = '';
const secretCode = 'deletescenesx';

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
    //await soundboard.saveState(); // This was causing problems, uncomment at your own risk I guess
});

window.onYouTubeIframeAPIReady = function() {
    console.log('YouTube IFrame API ready');
    soundboard = new Soundboard();
    soundboard.loadState().catch(error => {
        console.error('Failed to load state:', error);
    });
    const viewManager = new ViewManager();
    document.addEventListener('keydown', function(event) {
        // Hotkeys
        if (soundboard.allowHotkeys) {
            if (event.key === 'f') {
                event.preventDefault();
                soundboard.showFindSceneDialog();
            }
            if (event.key === 'm') {
                event.preventDefault();
                window.electronAPI.minimizeApp();
            }
        }
        
    });

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

