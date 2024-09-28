import SQLWrapper from '/vendor/sql-wrapper.js';
import Sequelize from '/vendor/sequelize.js';

export class DatabaseManager {
  constructor(dbPath) {
    this.db = null;
    this.dbPath = dbPath;
  }

  async init() {
    SQLWrapper.configure({
      filePath: this.dbPath
    });
    this.db = new Sequelize('sqlite://:memory:', {
      dialectModule: SQLWrapper
    });

    await this.db.sync();

    return this.db;
  }
}

import { initBackend } from '/vendor/absurd-sql/indexeddb-main-thread.js';

export function InitDatabaseWorker(workerPath) {
    let worker = new Worker(new URL(workerPath, import.meta.url), { type: 'module' });
    console.log('Database Worker created');

    worker.onerror = function(error) {
        console.error('Worker Error: ', error.message);
    };

    worker.onmessage = function(event) {
        console.log('Message from worker: ', event.data);
    };

    initBackend(worker);
}