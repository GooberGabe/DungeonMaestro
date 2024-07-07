const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { app } = require('electron');

class SoundboardDB {
    constructor() {
        this.dbPromise = this.initDatabase();
    }

    async initDatabase() {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'soundboard.sqlite');
        console.log(`Initializing database at: ${dbPath}`);
        
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await db.exec(`
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

        console.log('Database initialized');
        return db;
    }

    async saveScene(scene) {
        console.log(`Saving scene: ${JSON.stringify(scene)}`);
        const db = await this.dbPromise;
        await db.run('INSERT OR REPLACE INTO scenes (id, name) VALUES (?, ?)', [scene.id, scene.name]);
    }

    async saveSound(sound) {
        console.log(`Saving sound: ${JSON.stringify(sound)}`);
        const db = await this.dbPromise;
        await db.run('INSERT OR REPLACE INTO sounds (id, scene_id, name, source, type, volume) VALUES (?, ?, ?, ?, ?, ?)',
            [sound.id, sound.scene_id, sound.name, sound.source, sound.type, sound.volume]);
    }

    async saveQueue(queue) {
        console.log(`Saving queue: ${JSON.stringify(queue)}`);
        const db = await this.dbPromise;
        await db.run('DELETE FROM queue');
        for (const [index, sound] of queue.entries()) {
            await db.run('INSERT INTO queue (position, sound_id) VALUES (?, ?)', [index, sound.id]);
        }
    }

    async getScenes() {
        const db = await this.dbPromise;
        const scenes = await db.all('SELECT * FROM scenes');
        console.log(`Retrieved scenes: ${JSON.stringify(scenes)}`);
        return scenes;
    }

    async getSounds() {
        const db = await this.dbPromise;
        const sounds = await db.all('SELECT * FROM sounds');
        console.log(`Retrieved sounds: ${JSON.stringify(sounds)}`);
        return sounds;
    }

    async getQueue() {
        const db = await this.dbPromise;
        const queue = await db.all('SELECT sound_id FROM queue ORDER BY position');
        console.log(`Retrieved queue: ${JSON.stringify(queue)}`);
        return queue;
    }

    async deleteAllScenes() {
        console.log('Deleting all scenes from the database');
        const db = await this.dbPromise;
        await db.run('DELETE FROM scenes');
        await db.run('DELETE FROM sounds');
        await db.run('DELETE FROM queue');
        console.log('All scenes, sounds, and queue items deleted from the database');
    }
}

module.exports = SoundboardDB;