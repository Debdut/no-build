import Sequelize from '/vendor/sequelize.js';
import { DatabaseManager } from '/lib/db.js';

async function runSequelizeQueries(db) {
  const User = db.define('user', {
    username: Sequelize.DataTypes.STRING,
    birthday: Sequelize.DataTypes.DATE
  });

  await User.sync();

  let user = await User.create({
    username: 'debdut',
    birthday: new Date(Date.UTC(2002, 3, 1))
  });

  let users = await User.findAll();

  console.log('Found Users:', users);
}

async function main() {
  const dbManager = new DatabaseManager("/sql/db.sqlite");
  const db = await dbManager.init();
  await runSequelizeQueries(db);
  console.log('All operations completed successfully!');
}

main().catch(error => console.error('An error occurred:', error));