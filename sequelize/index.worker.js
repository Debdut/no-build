
import SQLWrapper from '/vendor/sql-wrapper.js';
import Sequelize from '/vendor/sequelize.js';

class DatabaseManager {
  constructor() {
    this.sequelize = null;
  }

  async init() {
    SQLWrapper.configure({
      filePath: '/sql/db.sqlite'
    });
    this.sequelize = new Sequelize('sqlite://:memory:', {
      dialectModule: SQLWrapper
    });

    await this.sequelize.sync();
  }

  async runSequelizeQueries() {
    const User = this.sequelize.define('user', {
      username: Sequelize.DataTypes.STRING,
      birthday: Sequelize.DataTypes.DATE
    });

    await User.sync();

    let user = await User.create({
      username: 'bani',
      birthday: new Date(Date.UTC(1999, 6, 1))
    });

    let users = await User.findAll();
    // user = user.get({ plain: true });
    // delete user.createdAt;
    // delete user.updatedAt;

    console.log('Found Users:', users);
  }
}

async function main() {
  const dbManager = new DatabaseManager();
  await dbManager.init();
  // await dbManager.runLowLevelQueries();
  await dbManager.runSequelizeQueries();
  console.log('All operations completed successfully!');
}

main().catch(error => console.error('An error occurred:', error));