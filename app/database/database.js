import * as SQLite from 'expo-sqlite';
import {useState, useEffect} from 'react';

// ✅ Open (or create) the database
const db = SQLite.openDatabaseSync('configurations.db');

// ✅ Initialize tables
export const initializeDatabase = () => {
    db.transaction(tx => {
        tx.executeSql(
            `CREATE TABLE IF NOT EXISTS configurations (
                id TEXT PRIMARY KEY, 
                name TEXT
            );`
        );

        tx.executeSql(
            `CREATE TABLE IF NOT EXISTS speakers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_id TEXT,
                name TEXT,
                offset INTEGER,
                mac TEXT,
                FOREIGN KEY (config_id) REFERENCES configurations(id)
            );`
        );
    });
};

export default db;
