const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

class SoundboardDB {
    constructor() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'soundboard.sqlite');
        this.db = new Database(dbPath, { verbose: console.log });
        this.initDatabase();
    }

    initDatabase() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sounds (
                id TEXT PRIMARY KEY,
                scene_id TEXT,
                name TEXT NOT NULL,
                source TEXT NOT NULL,
                type TEXT NOT NULL,
                volume REAL NOT NULL,
                FOREIGN KEY (scene_id) REFERENCES scenes(id)
            );

            CREATE TABLE IF NOT EXISTS queue (
                position INTEGER PRIMARY KEY AUTOINCREMENT,
                sound_id TEXT,
                FOREIGN KEY (sound_id) REFERENCES sounds(id)
            );
        `);
    }

    saveScene(scene) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO scenes (id, name) VALUES (?, ?)');
        stmt.run(scene.id, scene.name);
    }

    saveSound(sound) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO sounds (id, scene_id, name, source, type, volume) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(sound.id, sound.scene_id, sound.name, sound.source, sound.type, sound.volume);
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
        return this.db.prepare('SELECT * FROM scenes').all();
    }

    getSounds() {
        return this.db.prepare('SELECT * FROM sounds').all();
    }

    getQueue() {
        return this.db.prepare('SELECT sound_id FROM queue ORDER BY position').all();
    }

    deleteAllScenes() {
        const deleteScenes = this.db.prepare('DELETE FROM scenes');
        const deleteSounds = this.db.prepare('DELETE FROM sounds');
        const deleteQueue = this.db.prepare('DELETE FROM queue');

        const deleteAllTx = this.db.transaction(() => {
            deleteScenes.run();
            deleteSounds.run();
            deleteQueue.run();
        });

        deleteAllTx();
    }
}

module.exports = SoundboardDB;