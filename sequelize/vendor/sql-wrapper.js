import EventEmitter from '/vendor/event-emitter.js'

// https://timnew.me/blog/2014/06/23/process-nexttick-implementation-in-browser/
function getNextTickFunction() {
	// In Node.js.
	if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
		// Calls the `callback` via `process.nextTick(callback, error)` to emulate "asynchronous" behavior.
		// https://nodejs.org/en/docs/guides/event-loop-timers-and-nexttick#why-use-processnexttick
		return function(f) {
			process.nextTick(f)
		}
	}

	const canSetImmediate = typeof window !== 'undefined' && window.setImmediate
	const canPost = typeof window !== 'undefined' && window.postMessage && window.addEventListener

	if (canSetImmediate) {
		return function(f) {
			window.setImmediate(f)
		}
	}

	if (canPost) {
		const queue = []
		window.addEventListener('message', function(ev) {
			const source = ev.source
			if ((source === window || source === null) && ev.data === 'process-tick') {
				ev.stopPropagation()
				if (queue.length > 0) {
					const fn = queue.shift()
					fn()
				}
			}
		}, true)

		return function nextTick(fn) {
			queue.push(fn)
			window.postMessage('process-tick', '*')
		}
	}

	return function nextTick(fn) {
		setTimeout(fn, 0)
	}
}

let config = {}

function configure({ initSqlJs, wasmFileBaseUrl }) {
	config.initSqlJs = initSqlJs
	config.wasmFileBaseUrl = wasmFileBaseUrl
}

// `sqlite3`'s `Database` interface:
// https://github.com/TryGhost/node-sqlite3/blob/master/lib/sqlite3.d.ts
//
// Extends `EventEmitter` to mimick `sqlite3`'s `Database` behavior.
// Only emits a few events:
// * "open"
// * "close"
// * "error"
// Doesn't emit events:
// * "trace"
// * "profile"
// * "change"
//
class Database extends EventEmitter {
	// `filename: string` is a path to the file in which the data will be stored. Example: ":memory:".
	// `mode?: number` is an optional access mode: read-only, read-write, etc.
	// `callback?: function` gets called after the database is ready, or if there was an error.
	constructor(filename, mode, callback) {
		super()

		if (typeof mode === 'function') {
			callback = mode
			mode = undefined
		}

		// Since `sqlite3`'s `Database` is declared to be an `EventEmitter`,
		// developers will be (appropriately) using it as:
		//
		// const database = new Database(filename, callback)
		// database.on('eventName', eventHandler)
		//
		// And they'll be expecting the `callback` to always be fired after those `.on()` calls
		// and never before them.
		// If the `callback` was called here as is, i.e. as simply `callback()`,
		// it would've been called before those `.on()` event listeners have been set up
		// resulting in a potential loss of some of the events.
		//
		// So the name of this function signals that `callback()` should always be called
		// "asynchronously" rather than "synchronously".
		//
		const callCallbackAsynchronously = (error) => {
			// `process.nextTick()` workaround is not used in this code, the reasons being:
			// * It only works on server side.
			// * The `initSqlJs()` function already introduces an "asynchronicity" of its own.
			callback(error)
		}

		// "By default, sql.js uses wasm, and thus needs to load a `.wasm` file
		//  in addition to the javascript library. You can find this file in
		//  `./node_modules/sql.js/dist/sql-wasm.wasm` after installing sql.js from npm,
		//  and instruct your bundler to add it to your static assets or load it from a CDN".
		//
		// "Then use the locateFile property of the configuration object passed to
		//  `initSqlJs` to indicate where the file is. If you use an asset builder
		//  such as webpack, you can automate this".
		//
		// "Required to load the wasm binary asynchronously.
		//  Of course, you can host it wherever you want".
		//
		// A client application could define the "base" URL of a WASM file either way:
		// * By calling `.config()` static function with a `wasmFileBaseUrl` parameter.
		// * By setting `window.SQL_JS_WASM_FILE_BASE_URL` global variable.
		//
		const sqlJsWasmFileBaseUrl = config.wasmFileBaseUrl || (typeof window !== 'undefined' ? window.SQL_JS_WASM_FILE_BASE_URL : undefined)

		const isNodeJs = (typeof process !== 'undefined') && (process.release.name === 'node')

		const onError = (error) => {
			if (callback) {
				// Call the `callback`.
				callCallbackAsynchronously(error)
			} else {
				// "If no `callback` is provided and an error occurred,
				// an `error` event with the error object as the only parameter
				// will be emitted".
				this.emit('error', error)
			}
		}

		const onSuccess = () => {
			// "If opening succeeded, an `open` event with no parameters is emitted,
			//  regardless of whether a `callback` was provided or not".
			this.emit('open')
			// Call the `callback`.
			if (callback) {
				callCallbackAsynchronously(null)
			}
		}

		if (!isNodeJs) {
			if (!sqlJsWasmFileBaseUrl) {
				return onError(new Error('The base URL for `sql.js` `*.wasm` files is not configured'))
			}
			if (sqlJsWasmFileBaseUrl[sqlJsWasmFileBaseUrl.length - 1] !== '/') {
				return onError(new Error('The base URL for `sql.js` `*.wasm` files must end with a "/"'))
			}
		}

		const initSqlJsPromise = config.initSqlJs ? Promise.resolve(config.initSqlJs) : (
			isNodeJs ? import('sql.js').then(_ => _.default) : (
				typeof window !== 'undefined' ? Promise.resolve(window.initSqlJs) : Promise.reject(new Error('`window` is not defined'))
			)
		)

		initSqlJsPromise.then((initSqlJs) => {
			if (!initSqlJs) {
				return onError(new Error('`sql.js` not found'))
			}
			// Initialize `sql.js` — fetch the ".wasm" file and run it.
			return initSqlJs({
				// "You can omit `locateFile` when running in Node.js".
				//
				// When `locateFile` parameter is not omitted in Node.js, it throws an error:
				// "Error: ENOENT: no such file or directory, open 'https:\sql.js.org\dist\sql-wasm.wasm'".
				//
				// May be somehow related: https://github.com/sql-js/sql.js/issues/528
				//
				locateFile: isNodeJs ? undefined : filename => `${sqlJsWasmFileBaseUrl}${filename}`
			}).then((SQL) => {
				// Create a database.
				this.database = new SQL.Database()
				onSuccess()
			}, onError)
		}, onError)
	}

	// "Closes the database.
	//  `callback` (optional): If provided, this function will be called when the database
	//  was closed successfully or when an error occurred. The first argument is an `error` object.
	//  When it is null, closing succeeded. If no `callback` is provided and an error occurred,
	//  an "error" event with the `error` object as the only parameter will be emitted on the database object.
	//  If closing succeeded, a "close" event with no parameters is emitted, regardless of whether
	//  a `callback` was provided or not.
	close(callback) {
		this.database.close()
		this.emit('close')
		if (callback) {
			callback(null)
		}
	}

	// "Set a configuration option for the database. Valid options are:
	//  * Tracing & profiling
	//    * trace: provide a function callback as a value. Invoked when an SQL statement executes, with a rendering of the statement text.
	//    * profile: provide a function callback. Invoked every time an SQL statement executes.
	//  * busyTimeout: provide an integer as a value. Sets the busy timeout".
	configure(option, value) {}

	// "Loads a compiled SQLite extension into the database connection object".
	loadExtension(path, callback) {
		throw new Error('`loadExtension()` is not supported')
	}

	// "Allows the user to interrupt long-running queries.
	//  Wrapper around `sqlite3_interrupt` and causes other data-fetching functions
	//  to be passed an `error` with `code = sqlite3.INTERRUPT`".
	interrupt() {
		// This method is not implemented because `sql.js` methods are "synchronous" ("blocking").

		// this.database.exec('select interrupt();')
	}

	// There're no docs on this method.
	// I guess it calls the `callback` after all queries have finished.
	wait(callback) {
		// `sql.js` methods are "synchronous" ("blocking")
		// so the `wait()` method doesn't really make sense here.
		// It just calls the `callback`.
		if (callback) {
			callback(null)
		}
	}

	// https://stackoverflow.com/questions/41949724/how-does-db-serialize-work-in-node-sqlite3
	// "Each command inside the `serialize()`'s `func` function is guaranteed to finish executing
	//  before the next one starts".
	serialize(func) {
		func()
	}

	// https://www.sqlitetutorial.net/sqlite-nodejs/statements-control-flow/
	// "The `serialize()` method allows you to execute statements in serialized mode,
	//  while the `parallelize()` method executes the statements in parallel".
	parallelize(func) {
		func()
	}

	// "Runs the SQL query with the specified parameters and calls the `callback` afterwards.
	//  It does not retrieve any result data".
	run(...args) {
		const {
			query,
			callback: unboundCallback,
			parameters
		} = getRunArguments(args)

		// "The context of the `callback` function (the `this` object inside the function)
		//  is the statement object".
		//
		// "If execution was successful, the this object will contain two properties named
		//  `lastID` and `changes` which contain the value of the last inserted row ID
		//  and the number of rows affected by this query respectively".
		//
		const statement = {}

		let callback = unboundCallback
		if (callback) {
			callback = callback.bind(statement)
		}

		try {
			// Run the query.
			this.database.run(query, parameters)

			// Just a simple "lame" SQL operation type detection.
			const isInsert = /^\s*insert\s+/i.test(query)
			const isUpdate = /^\s*update\s+/i.test(query)
			const isDelete = /^\s*delete\s+/i.test(query)

			// Gets a value from the database.
			const getValue = (query) => {
				const results = this.database.exec(query + ';')
				return results[0].values[0][0]
			}

			if (isInsert) {
				// The row ID of the most recent successful INSERT.
				statement.lastID = getValue('select last_insert_rowid()')
			}

			if (isInsert || isUpdate || isDelete) {
				// The number of rows modified, inserted or deleted by the most recently completed
				// INSERT, UPDATE or DELETE statement.
				statement.changes = getValue('select changes()')
			}

			if (callback) {
				callCallbackAsynchronously(callback, null)
			}
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				// "When no `callback` is provided and an error occurs,
				//  an "error" event will be emitted".
				this.emit('error', error)
				// throw error
			}
		}

		// Returns `this` for method chaining.
		return this
	}

	// "Runs the SQL query with the specified parameters and calls the `callback`
	//  with all result rows afterwards".
	all(...args) {
		const {
			query,
			callback,
			parameters
		} = getRunArguments(args)

		try {
			const results = []

			this.database.each(query, parameters,
				// When a query has produced a result (only for `SELECT` queries).
				function(result) {
					results.push(result)
				},
				// When all queries have finished.
				function() {
					if (callback) {
						callCallbackAsynchronously(callback, null, results)
					}
				}
			)
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				throw error
			}
		}

		// Returns `this` for method chaining.
		return this
	}

	// "Runs the SQL query with the specified parameters and calls the `callback`
	//  once for each result row".
	each(...args) {
		const {
			query,
			callback,
			parameters
		} = getRunArguments(args)

		try {
			const results = []
			this.database.each(query, parameters,
				// When a query has produced a result (only for `SELECT` queries).
				function(result) {
					if (callback) {
						callCallbackAsynchronously(callback, null, result)
					}
				}
			)
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				throw error
			}
		}

		// Returns `this` for method chaining.
		return this
	}

	get(...args) {
		const {
			query,
			callback,
			parameters
		} = getRunArguments(args)

		try {
			const results = this.database.exec(query, parameters)

			// "If the result set is empty, the second parameter is `undefined`,
			//  otherwise it is an object containing the values for the first row.
			//  The property `names` correspond to the column names of the result set".
			//
			// I dunno if the `result` object is correct or not.
			// It's more of a "placeholder" implementation.
			//
			const result = results[0]

			if (callback) {
				callCallbackAsynchronously(callback, null, result)
			}
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				throw error
			}
		}

		// Returns `this` for method chaining.
		return this
	}

	// "Runs all SQL queries in the supplied string. No result rows are retrieved".
	exec(query, callback) {
		try {
			this.database.exec(query)

			if (callback) {
				callCallbackAsynchronously(callback, null)
			}
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				// "When no `callback` is provided and an error occurs,
				//  an "error" event will be emitted".
				this.emit('error', error)
				// throw error
			}
		}

		// Returns `this` for method chaining.
		return this
	}

	// "Prepares the SQL statement and optionally binds the specified parameters
	//  and calls the callback when done. The function returns a Statement object."
	prepare(...args) {
		const {
			query,
			callback,
			parameters
		} = getRunArguments(args)

		let statement = {}

		try {
			statement = this.database.prepare(query, parameters)

			if (callback) {
				callCallbackAsynchronously(callback, null)
			}
		} catch (error) {
			if (callback) {
				callCallbackAsynchronously(callback, error)
			} else {
				throw error
			}
		}

		return statement
	}
}

const nextTick = getNextTickFunction()
function callCallbackAsynchronously(callback, error, result) {
	nextTick(() => callback(error, result))
}

function getEnvVars() {
	if (typeof process !== 'undefined') {
		return process.env
	}
}

function getRunArguments(args) {
	const query = args.shift()
	let parameters
	let callback

	// Sort out the arguments.
	if (args.length === 0) {
		parameters = []
	} else {
		if (typeof args[args.length - 1] === 'function') {
			callback = args.pop()
		}
		parameters = args
	}

	// If parameters were passed as an object then convert them to an object.
	if (parameters.length === 1) {
		if (parameters[0] !== null && typeof parameters[0] === 'object') {
			parameters = parameters[0]
		}
	}

	return {
		query,
		parameters,
		callback
	}
}

export function verbose() {
	const VerboseLib = {
		Database,
		verbose() {
			return VerboseLib
		}
	}
	return VerboseLib
}

export default {
	Database,
	configure,
	verbose
}