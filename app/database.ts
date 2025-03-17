import * as SQLite from 'expo-sqlite';

// Open database
const db = SQLite.openDatabaseSync("syncsonic.db");

// Create Tables
export const setupDatabase = () => {
    db.execSync(
        `CREATE TABLE IF NOT EXISTS configurations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );`
    );

    db.execSync(
        `CREATE TABLE IF NOT EXISTS speakers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            mac TEXT NOT NULL,
            FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE
        );`
    );
};

// Insert Configuration
export const addConfiguration = (name: string, callback: (id: number) => void) => {
    const result = db.runSync(
        `INSERT INTO configurations (name) VALUES (?);`,
        [name]
    );
    callback(result.lastInsertRowId);
};

// Insert Speaker
export const addSpeaker = (configId: number, name: string, mac: string) => {
    db.runSync(
        `INSERT INTO speakers (config_id, name, mac) VALUES (?, ?, ?);`,
        [configId, name, mac]
    );
};

// Fetch Configurations
export const getConfigurations = (): any[] => {
    return db.getAllSync(`SELECT * FROM configurations;`);
};

// Fetch Speakers for a Configuration
export const getSpeakers = (configId: number, setDevices?: unknown): any[] => {
    return db.getAllSync(`SELECT * FROM speakers WHERE config_id = ?;`, [configId]);
};

// Delete Speaker
export const deleteSpeaker = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

export const updateConfiguration = (id: number, name: string) => {
    db.runSync(
        `UPDATE configurations SET name = ? WHERE id = ?;`,
        [name, id]
    );
};

// Permanently delete a speaker by ID
export const deleteSpeakerById = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

// Delete configuration and all related speakers
export const deleteConfiguration = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE config_id = ?;`, [id]); // Delete related speakers first
    db.runSync(`DELETE FROM configurations WHERE id = ?;`, [id]); // Then delete configuration
};



export const resetDatabase = () => {
    db.execSync(`DROP TABLE IF EXISTS speakers;`);
    db.execSync(`DROP TABLE IF EXISTS configurations;`);
    setupDatabase(); // Recreate tables
};


export const logDatabaseContents = () => {
    console.log("Fetching database contents...");

    db.getAllSync(`SELECT * FROM configurations;`)
        .forEach(config => console.log("Config:", config));

    db.getAllSync(`SELECT * FROM speakers;`)
        .forEach(speaker => console.log("Speaker:", speaker));
};

export default db;
