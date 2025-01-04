const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class SoundboardDB {
    constructor() {
        this.db = null;
    }

    async initDatabase() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'soundboard.sqlite');
        this.db = new Database(dbPath, { verbose: console.log });

        this.db.pragma('foreign_keys = ON');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS assets (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                source TEXT NOT NULL,
                type TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sounds (
                id TEXT PRIMARY KEY,
                scene_id TEXT,
                asset_id TEXT,
                name TEXT NOT NULL,
                volume REAL NOT NULL,
                FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
                FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS queue (
                position INTEGER PRIMARY KEY AUTOINCREMENT,
                sound_id TEXT,
                FOREIGN KEY (sound_id) REFERENCES sounds(id) ON DELETE CASCADE
            );

            
        `);

        // Add order_index column if it doesn't exist
        const tableInfo = this.db.prepare("PRAGMA table_info(scenes)").all();
        const hasOrderIndex = tableInfo.some(column => column.name === 'order_index');
        
        if (!hasOrderIndex) {
            this.db.exec(`
                ALTER TABLE scenes ADD COLUMN order_index INTEGER;
                UPDATE scenes SET order_index = (SELECT COUNT(*) FROM scenes s2 WHERE s2.id <= scenes.id);
            `);
        }
    }

    saveScene(scene) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO scenes (id, name) VALUES (?, ?)');
        stmt.run(scene.id, scene.name);
    }

    saveSound(sound) {
        console.log("++ Saved sound id "+sound.id);
        const stmt = this.db.prepare('INSERT OR REPLACE INTO sounds (id, scene_id, asset_id, name, volume) VALUES (?, ?, ?, ?, ?)');
        stmt.run(sound.id, sound.scene_id, sound.asset_id, sound.name, sound.volume);
    }

    saveAsset(asset) {
        console.log("++ Saved asset id "+asset.id);
        const stmt = this.db.prepare('INSERT OR REPLACE INTO assets (id, name, title, source, type) VALUES (?, ?, ?, ?, ?)');
        stmt.run(asset.id, asset.name, asset.title, asset.source, asset.type);
    }

    saveQueue(queue) {
        const deleteStmt = this.db.prepare('DELETE FROM queue');
        const insertStmt = this.db.prepare('INSERT INTO queue (sound_id) VALUES (?)');
        
        const saveQueueTx = this.db.transaction((queueItems) => {
            deleteStmt.run();
            for (const sound of queueItems) {
                insertStmt.run(sound.id);
            }
        });

        saveQueueTx(queue);
    }

    getScenes() {
        return this.db.prepare('SELECT * FROM scenes ORDER BY order_index').all();
    }

    getSounds() {
        return this.db.prepare('SELECT * FROM sounds').all();
    }

    getAssets() {
        return this.db.prepare('SELECT * FROM assets').all();
    }

    getQueue() {
        return this.db.prepare('SELECT sound_id FROM queue ORDER BY position').all();
    }

    async updateSceneOrder(sceneIds) {
        const updateOrder = this.db.prepare('UPDATE scenes SET order_index = ? WHERE id = ?');
        
        const transaction = this.db.transaction((ids) => {
            ids.forEach((id, index) => {
                updateOrder.run(index, id);
            });
        });

        transaction(sceneIds);
    }

    async updateSoundName(soundId, newName) {
        const stmt = this.db.prepare('UPDATE sounds SET name = ? WHERE id = ?');
        stmt.run(newName, soundId);
    }

    async updateSoundVolume(soundId, newVolume) {
        const stmt = this.db.prepare('UPDATE sounds SET volume = ? WHERE id = ?');
        stmt.run(newVolume, soundId);
    }

    async updateSoundSource(soundId, newSource) {
        const stmt = this.db.prepare('UPDATE sounds SET source = ? WHERE id = ?');
        stmt.run(newSource, soundId);
    }


    async deleteScene(sceneId) {
        const transaction = this.db.transaction((id) => {
            // Delete sounds associated with the scene
            this.db.prepare('DELETE FROM sounds WHERE scene_id = ?').run(id);
            
            // Delete the scene
            const result = this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id);
            
            if (result.changes === 0) {
                throw new Error('Scene not found');
            }
        });

        try {
            transaction(sceneId);
        } catch (error) {
            console.error('Error deleting scene:', error);
            throw error;
        }
    }

    async deleteSound(soundId) {
        const deleteSound = this.db.prepare('DELETE FROM sounds WHERE id = ?');

        const transaction = this.db.transaction((id) => {
            deleteSound.run(id);
        });

        transaction(soundId);
    }

    deleteAllScenes() {
        const deleteScenes = this.db.prepare('DELETE FROM scenes');
        //const deleteSounds = this.db.prepare('DELETE FROM sounds');
        const deleteQueue = this.db.prepare('DELETE FROM queue');

        const deleteAllTx = this.db.transaction(() => {
            deleteScenes.run();
            deleteSounds.run();
            deleteQueue.run();
        });

        deleteAllTx();
    }

    async deleteAsset(assetId) {
        const deleteAsset = this.db.prepare('DELETE FROM assets WHERE id = ?');
        const deleteSounds = this.db.prepare('DELETE FROM sounds WHERE asset_id = ?');
        const deleteQueueEntries = this.db.prepare('DELETE FROM queue WHERE sound_id IN (SELECT id FROM sounds WHERE asset_id = ?)');
    
        const transaction = this.db.transaction((id) => {
            // Delete queue entries first (due to foreign key constraints)
            deleteQueueEntries.run(id);
            // Then delete sounds that use this asset
            deleteSounds.run(id);
            // Finally delete the asset itself
            deleteAsset.run(id);
        });
    
        transaction(assetId);
    }
}

/* Currently, there is no uninstall option. 
document.getElementById('uninstall-button').addEventListener('click', () => {
    if (confirm('Are you sure you want to uninstall the application? This will delete all app data.')) {
      window.electronAPI.uninstallApp();
    }
  });
*/

module.exports = SoundboardDB;