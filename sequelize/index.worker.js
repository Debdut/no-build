import initSqlJs from '/vendor/sql.js/sql-wasm.js';
import { SQLiteFS } from '/vendor/absurd-sql/index.js';
import IndexedDBBackend from '/vendor/absurd-sql/indexeddb-backend.js';
import SQLWrapper from '/vendor/sql-wrapper.js';
import Sequelize from 'https://unpkg.com/sequelize-browser@6.1.3/sequelize.js';

class DatabaseManager {
  constructor() {
    this.db = null;
    this.sequelize = null;
  }

  async init() {
    const SQL = await initSqlJs({ locateFile: file => file });
    const sqlFS = new SQLiteFS(SQL.FS, new IndexedDBBackend());
    SQL.register_for_idb(sqlFS);

    SQL.FS.mkdir('/sql');
    SQL.FS.mount(sqlFS, {}, '/sql');

    this.db = new SQL.Database('/sql/db.sqlite', { filename: true });
    this.db.exec(`
      PRAGMA page_size=8192;
      PRAGMA journal_mode=MEMORY;
    `);

    SQLWrapper.configure({
      initSqlJs,
      wasmFileBaseUrl: 'http://localhost/vendor/sql.js/'
    });

    this.sequelize = new Sequelize('sqlite://:memory:', {
      dialectModule: SQLWrapper
    });

    await this.sequelize.sync();
  }

  async runLowLevelQueries() {
    try {
      this.db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
    } catch (e) {
      console.error('Error creating table:', e);
    }

    this.db.exec('BEGIN TRANSACTION');
    const stmt = this.db.prepare('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)');
    for (let i = 0; i < 5; i++) {
      stmt.run([i, Math.floor(Math.random() * 100).toString()]);
    }
    stmt.free();
    this.db.exec('COMMIT');

    const sumStmt = this.db.prepare('SELECT SUM(CAST(value AS INTEGER)) AS total FROM kv');
    sumStmt.step();
    console.log('Sum Result:', sumStmt.getAsObject());
    sumStmt.free();
  }

  async runSequelizeQueries() {
    const User = this.sequelize.define('user', {
      username: Sequelize.DataTypes.STRING,
      birthday: Sequelize.DataTypes.DATE
    });

    await User.sync();

    let user = await User.create({
      username: 'jane',
      birthday: new Date(Date.UTC(1980, 6, 1))
    });

    user = user.get({ plain: true });
    delete user.createdAt;
    delete user.updatedAt;

    console.log('Created User:', user);

    await User.truncate();
  }
}

async function main() {
  const dbManager = new DatabaseManager();
  await dbManager.init();
  await dbManager.runLowLevelQueries();
  await dbManager.runSequelizeQueries();
  console.log('All operations completed successfully!');
}

main().catch(error => console.error('An error occurred:', error));