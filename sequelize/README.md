# Sequelize ORM with SQLite on IndexedDB

I somehow managed to patch **absurd-sql**, **Sequelize**, and **sql.js** together, and now there's a **fully functional Sequelize ORM** on an **editable SQLite** that lives inside a **filesystem built on IndexedDB**. Yeah, it's as crazy as it sounds.

## Table of Contents
- [About](#about)
- [Installation](#installation)
- [Usage](#usage)
- [How it Works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

## About
This project integrates three libraries:
- [absurd-sql](https://github.com/jlongster/absurd-sql) 
- [Sequelize](https://sequelize.org/)
- [sql.js](https://sql.js.org/)

I spent the past week reading and patching each of these separately, then together, to make them work on an editable SQLite database in a browser using IndexedDB. Never thought it was possible!

## Installation
1. **Clone the repo**:
    ```bash
    git clone https://github.com/Debdut/no-build/
    cd sequelize
    ```

2. **Run it**:  
   Serve the project using a local server, and open it in your browser, and open the console.

    ```bash
    go install github.com/debdut/golive
    golive -H "Cross-Origin-Opener-Policy:same-origin,Cross-Origin-Embedder-Policy:require-corp"
    ```

## Usage
Once it's running, you can use Sequelize ORM just like you would in any Node.js project, but it works inside the browser. All the SQL transactions are backed by **IndexedDB**.

### Example
Here’s a basic example of how you'd define and use models:

```js
const User = sequelize.define('User', {
  name: Sequelize.STRING,
  email: Sequelize.STRING,
});

User.sync().then(() => {
  return User.create({
    name: 'John Doe',
    email: 'john@example.com'
  });
});
```

Check the browser console for output.

## How it Works
- [absurd-sql](https://github.com/jlongster/absurd-sql): Handles translating the SQLite database to work over IndexedDB.
- [Sequelize](https://github.com/sequelize/sequelize): A powerful ORM that handles database queries and model definitions.
- [sql.js](https://github.com/sql-js/sql.js): A compiled version of SQLite that runs in the browser as WebAssembly.

The magic happens when these libraries are patched together. Sequelize communicates with the SQLite database (via sql.js), and absurd-sql ensures that the database can be persisted and queried through IndexedDB.

## Contributing
If you want to dive into the code or make improvements, feel free to fork the repo and submit a PR.

## License
[MIT](LICENSE)
