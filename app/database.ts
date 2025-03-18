import * as SQLite from 'expo-sqlite';

// open
const db = SQLite.openDatabaseSync("syncsonic.db");

// create
export const setupDatabase = () => { // autoincrement—no need to handle that
    db.execSync(
        `CREATE TABLE IF NOT EXISTS configurations (
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            name TEXT NOT NULL
        );`
    );
    db.execSync( //many to one from speaker to config
        `CREATE TABLE IF NOT EXISTS speakers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            config_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            mac TEXT NOT NULL,
            FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE
        );`
    );
};

// push new config
export const addConfiguration = (name: string, callback: (id: number) => void) => {
    const result = db.runSync(
        `INSERT INTO configurations (name) VALUES (?);`,
        [name]
    );
    callback(result.lastInsertRowId);
};

// insert new speaker (associated with config many-to-one)
export const addSpeaker = (configId: number, name: string, mac: string) => {
    db.runSync(
        `INSERT INTO speakers (config_id, name, mac) VALUES (?, ?, ?);`,
        [configId, name, mac]
    );
};


export const getConfigurations = (): any[] => {
    return db.getAllSync(`SELECT * FROM configurations;`);
};

// get speakers of a given config
export const getSpeakers = (configId: number, setDevices?: unknown): any[] => {
    return db.getAllSync(`SELECT * FROM speakers WHERE config_id = ?;`, [configId]);
};

// delete from config (and obviously in general)
export const deleteSpeaker = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

//change name
export const updateConfiguration = (id: number, name: string) => {
    db.runSync(
        `UPDATE configurations SET name = ? WHERE id = ?;`,
        [name, id]
    );
};

// is this not a reapeat ................ whoops i'll fix [k]
export const deleteSpeakerById = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

export const deleteConfiguration = (id: number) => {
    db.runSync(`DELETE FROM speakers WHERE config_id = ?;`, [id]); // delete speakers in config
    db.runSync(`DELETE FROM configurations WHERE id = ?;`, [id]); // delete config
};

// for debugging
export const resetDatabase = () => {
    db.execSync(`DROP TABLE IF EXISTS speakers;`);
    db.execSync(`DROP TABLE IF EXISTS configurations;`);
    setupDatabase(); // recreate tables
};

//  sdebugging
export const logDatabaseContents = () => {
    console.log("Fetching database contents...");

    db.getAllSync(`SELECT * FROM configurations;`)
        .forEach(config => console.log("Config:", config));

    db.getAllSync(`SELECT * FROM speakers;`)
        .forEach(speaker => console.log("Speaker:", speaker));
};

export default db;
