import initSqlJs from '/vendor/sql.js/sql-wasm.js';
import { SQLiteFS } from '/vendor/absurd-sql/index.js';
import IndexedDBBackend from '/vendor/absurd-sql/indexeddb-backend.js';

async function init() {
    let SQL = await initSqlJs({ locateFile: file => file });
    let sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);
  
    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');
  
    let db = new SQL.Database('/sql/db.sqlite', { filename: true });
    db.exec(`
      PRAGMA page_size=8192;
      PRAGMA journal_mode=MEMORY;
    `);
    return db;
  }
  
//   async function runQueries() {
//     let db = await init();
  
//     try {
//       db.exec('CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)');
//     } catch (e) {}
  
//     db.exec('BEGIN TRANSACTION');
//     let stmt = db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
//     for (let i = 0; i < 5; i++) {
//       stmt.run([i, ((Math.random() * 100) | 0).toString()]);
//     }
//     stmt.free();
//     db.exec('COMMIT');
  
//     stmt = db.prepare(`SELECT SUM(value) FROM kv`);
//     stmt.step();
//     console.log('Result:', stmt.getAsObject());

//     postMessage('Done!');
//     stmt.free();
//   }
  
//   runQueries();

import SQLWrapper from '/vendor/sql-wrapper.js';

SQLWrapper.configure({
  initSqlJs,
  wasmFileBaseUrl: '/vendor/sql.js/sql-wasm.wasm'
});

import Sequelize from 'https://unpkg.com/sequelize-browser@6.1.3/sequelize.js';

const sequelize = new Sequelize('sqlite://:memory:', {
  dialectModule: SQLWrapper
});

const User = sequelize.define('user', {
  username: Sequelize.DataTypes.STRING,
  birthday: Sequelize.DataTypes.DATE
})

await sequelize.sync()

// Create and fetch a record.

let user = await User.create({
  username: 'jane',
  birthday: Date.UTC(1980, 6, 1)
})

user = user.get({ plain: true })
delete user.createdAt
delete user.updatedAt

console.log(user);

// Clear the database.
await User.truncate()