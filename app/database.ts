import * as SQLite from 'expo-sqlite';

// Open the database
const db = SQLite.openDatabaseSync("syncsonic.db");

export function setupDatabase() {
  // Create configurations table if it doesn't exist (without isConnected column)
  db.execSync(
    `CREATE TABLE IF NOT EXISTS configurations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT NOT NULL
    );`
  );
  // Migrate configurations: add isConnected if it doesn't exist.
  const configColumns = db.getAllSync(`PRAGMA table_info(configurations);`) as any[];
  const hasIsConnected = configColumns.some((col: any) => col.name === 'isConnected');
  if (!hasIsConnected) {
    db.execSync(`ALTER TABLE configurations ADD COLUMN isConnected INTEGER NOT NULL DEFAULT 0;`);
  }

  // Create speakers table if it doesn't exist (initially without volume and latency)
  db.execSync(
    `CREATE TABLE IF NOT EXISTS speakers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      mac TEXT NOT NULL,
      FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE
    );`
  );
  // Migrate speakers: add volume and latency if they don't exist.
  const speakerColumns = db.getAllSync(`PRAGMA table_info(speakers);`) as any[];
  const hasVolume = speakerColumns.some((col: any) => col.name === 'volume');
  const hasLatency = speakerColumns.some((col: any) => col.name === 'latency');
  if (!hasVolume) {
    db.execSync(`ALTER TABLE speakers ADD COLUMN volume INTEGER NOT NULL DEFAULT 50;`);
  }
  if (!hasLatency) {
    db.execSync(`ALTER TABLE speakers ADD COLUMN latency INTEGER NOT NULL DEFAULT 100;`);
  }

  // Create settings table if it doesn't exist
  db.execSync(
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY NOT NULL,
      key TEXT NOT NULL UNIQUE,
      value TEXT
    );`
  );
  console.log('Database tables created successfully');
}

// Migrate speakers: add is_connected if it doesn't exist.
const speakerColumns = db.getAllSync(`PRAGMA table_info(speakers);`) as any[];
const hasIsConnected = speakerColumns.some((col: any) => col.name === 'is_connected');
if (!hasIsConnected) {
  db.execSync(`ALTER TABLE speakers ADD COLUMN is_connected INTEGER NOT NULL DEFAULT 0;`);
}

// Insert new configuration with default isConnected flag set to 0 (not connected)
export const addConfiguration = (name: string, callback: (id: number) => void) => {
  const result = db.runSync(
    `INSERT INTO configurations (name, isConnected) VALUES (?, 0);`,
    [name]
  );
  callback(result.lastInsertRowId);
};

// Insert new speaker (associated with a configuration)
// New speakers will have default volume 50 and latency 100 unless specified.
export const addSpeaker = (configId: number, name: string, mac: string, volume: number = 50, latency: number = 100) => {
  db.runSync(
    `INSERT INTO speakers (config_id, name, mac, volume, latency) VALUES (?, ?, ?, ?, ?);`,
    [configId, name, mac, volume, latency]
  );
};

export const getConfigurations = (): any[] => {
  return db.getAllSync(`
    SELECT c.id, c.name, c.isConnected,
      (SELECT COUNT(*) FROM speakers WHERE config_id = c.id) AS speakerCount
    FROM configurations c;
  `);
};

// Get speakers for a given configuration.
export const getSpeakers = (configId: number): any[] => {
  return db.getAllSync(`SELECT * FROM speakers WHERE config_id = ?;`, [configId]);
};

// Delete a speaker by id
export const deleteSpeaker = (id: number) => {
  db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

export const updateConfiguration = (id: number, name: string) => {
  db.runSync(
    `UPDATE configurations SET name = ? WHERE id = ?;`,
    [name, id]
  );
};

export const updateConnectionStatus = (id: number, status: number) => {
  db.runSync(
    `UPDATE configurations SET isConnected = ? WHERE id = ?;`,
    [status, id]
  );
};

// Delete a speaker by id (duplicate function for now)
export const deleteSpeakerById = (id: number) => {
  db.runSync(`DELETE FROM speakers WHERE id = ?;`, [id]);
};

// Delete a configuration and its associated speakers
export const deleteConfiguration = (id: number) => {
  db.runSync(`DELETE FROM speakers WHERE config_id = ?;`, [id]); // delete speakers in config
  db.runSync(`DELETE FROM configurations WHERE id = ?;`, [id]); // delete config
};

// For debugging: Reset the database
export const resetDatabase = () => {
  db.execSync(`DROP TABLE IF EXISTS speakers;`);
  db.execSync(`DROP TABLE IF EXISTS configurations;`);
  setupDatabase(); // recreate tables
};

// For debugging: Log the database contents
export const logDatabaseContents = () => {
  console.log("Fetching database contents...");
  db.getAllSync(`SELECT * FROM configurations;`)
    .forEach(config => console.log("Config:", config));
  db.getAllSync(`SELECT * FROM speakers;`)
    .forEach(speaker => console.log("Speaker:", speaker));
};

// Get configuration status (isConnected flag)
export const getConfigurationStatus = (configId: number): number => {
  const rows = db.getAllSync(`SELECT isConnected FROM configurations WHERE id = ?;`, [configId]) as any[];
  return rows.length > 0 ? rows[0].isConnected : 0;
};

export const updateSpeakerSettings = (configId: number, mac: string, volume: number, latency: number) => {
    db.runSync(
      `UPDATE speakers SET volume = ?, latency = ? WHERE config_id = ? AND mac = ?;`,
      [volume, latency, configId, mac]
    );
  };

  export const updateSpeakerConnectionStatus = (configId: number, mac: string, isConnected: boolean) => {
    db.runSync(
      `UPDATE speakers SET is_connected = ? WHERE config_id = ? AND mac = ?;`,
      [isConnected ? 1 : 0, configId, mac]
    );
  };
  
  export const getSpeakersFull = (configId: number) => {
    return db.getAllSync(`
      SELECT mac, name, volume, latency, is_connected
      FROM speakers
      WHERE config_id = ?;
    `, [configId]) as {
      mac: string;
      name: string;
      volume: number;
      latency: number;
      is_connected: number; // 0 or 1 in DB
    }[];
  };
  
  

// Get configuration settings for speakers (volume and latency)
export const getConfigurationSettings = (configId: number): { [mac: string]: { volume: number, latency: number } } => {
  const rows = db.getAllSync(`SELECT mac, volume, latency FROM speakers WHERE config_id = ?;`, [configId]) as any[];
  const settings: { [mac: string]: { volume: number, latency: number } } = {};
  rows.forEach(row => {
    settings[row.mac] = { volume: row.volume, latency: row.latency };
  });
  return settings;
};

export function saveLastConnectedDevice(deviceId: string) {
  db.runSync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);`,
    ['lastConnectedDevice', deviceId]
  );
  console.log('Last connected device saved:', deviceId);
}

export function getLastConnectedDevice(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    try {
      const result = db.getFirstSync<{ value: string }>(
        `SELECT value FROM settings WHERE key = ?;`,
        ['lastConnectedDevice']
      );
      resolve(result?.value ?? null);
    } catch (error) {
      console.error('Error getting last connected device:', error);
      reject(error);
    }
  });
}

export default db;