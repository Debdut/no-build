var EventEmitter = (function (moduleFactory) {
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var prefix = "~";

    function EventRegistry() {}

    function Listener(fn, context, once) {
        this.fn = fn;
        this.context = context;
        this.once = once || false;
    }

    function addListener(emitter, event, fn, context, once) {
        if (typeof fn !== "function") {
            throw new TypeError("The listener must be a function");
        }
        var listener = new Listener(fn, context || emitter, once);
        var eventKey = prefix ? prefix + event : event;
        if (emitter._events[eventKey]) {
            if (emitter._events[eventKey].fn) {
                emitter._events[eventKey] = [emitter._events[eventKey],
                    listener
                ];
            } else {
                emitter._events[eventKey].push(listener);
            }
        } else {
            emitter._events[eventKey] = listener;
            emitter._eventsCount++;
        }
        return emitter;
    }

    function removeListener(emitter, eventKey) {
        if (--emitter._eventsCount === 0) {
            emitter._events = new EventRegistry();
        } else {
            delete emitter._events[eventKey];
        }
    }

    function EventEmitter() {
        this._events = new EventRegistry();
        this._eventsCount = 0;
    }

    Object.create && (EventRegistry.prototype = Object.create(null), (
        new EventRegistry).__proto__ || (prefix = false));

    EventEmitter.prototype.eventNames = function () {
        var events = this._events;
        var names = [];
        if (this._eventsCount === 0) return names;
        for (var name in events) {
            if (hasOwnProperty.call(events, name)) {
                names.push(prefix ? name.slice(1) : name);
            }
        }
        return Object.getOwnPropertySymbols ? names.concat(Object
            .getOwnPropertySymbols(events)) : names;
    };

    EventEmitter.prototype.listeners = function (event) {
        var eventKey = prefix ? prefix + event : event;
        var listeners = this._events[eventKey];
        if (!listeners) return [];
        if (listeners.fn) return [listeners.fn];
        return listeners.map(listener => listener.fn);
    };

    EventEmitter.prototype.listenerCount = function (event) {
        var eventKey = prefix ? prefix + event : event;
        var listeners = this._events[eventKey];
        return listeners ? (listeners.fn ? 1 : listeners.length) :
        0;
    };

    EventEmitter.prototype.emit = function (event, ...args) {
        var eventKey = prefix ? prefix + event : event;
        if (!this._events[eventKey]) return false;
        var listeners = this._events[eventKey];
        if (listeners.fn) {
            if (listeners.once) this.removeListener(event, listeners
                .fn, undefined, true);
            listeners.fn.apply(listeners.context, args);
        } else {
            for (var i = 0; i < listeners.length; i++) {
                if (listeners[i].once) this.removeListener(event,
                    listeners[i].fn, undefined, true);
                listeners[i].fn.apply(listeners[i].context, args);
            }
        }
        return true;
    };

    EventEmitter.prototype.on = function (event, fn, context) {
        return addListener(this, event, fn, context, false);
    };

    EventEmitter.prototype.once = function (event, fn, context) {
        return addListener(this, event, fn, context, true);
    };

    EventEmitter.prototype.removeListener = function (event, fn,
        context, once) {
        var eventKey = prefix ? prefix + event : event;
        if (!this._events[eventKey]) return this;
        if (!fn) {
            removeListener(this, eventKey);
            return this;
        }
        var listeners = this._events[eventKey];
        if (listeners.fn) {
            if (listeners.fn !== fn || (once && !listeners.once) ||
                (context && listeners.context !== context))
            return this;
            removeListener(this, eventKey);
        } else {
            var remainingListeners = [];
            for (var i = 0; i < listeners.length; i++) {
                if (listeners[i].fn !== fn || (once && !listeners[i]
                        .once) || (context && listeners[i]
                        .context !== context)) {
                    remainingListeners.push(listeners[i]);
                }
            }
            if (remainingListeners.length) {
                this._events[eventKey] = remainingListeners
                    .length === 1 ? remainingListeners[0] :
                    remainingListeners;
            } else {
                removeListener(this, eventKey);
            }
        }
        return this;
    };

    EventEmitter.prototype.removeAllListeners = function (event) {
        if (event) {
            var eventKey = prefix ? prefix + event : event;
            if (this._events[eventKey]) removeListener(this,
                eventKey);
        } else {
            this._events = new EventRegistry();
            this._eventsCount = 0;
        }
        return this;
    };

    EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
    EventEmitter.prototype.addListener = EventEmitter.prototype.on;
    EventEmitter.prefixed = prefix;
    EventEmitter.EventEmitter = EventEmitter;

    moduleFactory.exports = EventEmitter;
});

function getType(value) {
    return typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ?
        typeof value : value && typeof Symbol === "function" && value
        .constructor === Symbol && value !== Symbol.prototype ? "symbol" :
        typeof value;
}

function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, toPrimitive(descriptor.key), descriptor);
    }
}

function toPrimitive(input, hint) {
    if (getType(input) !== "object" || input === null) return input;
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
        var res = prim.call(input, hint || "default");
        if (getType(res) !== "object") return res;
        throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
}

function construct(Parent, args, Class) {
    return construct = Reflect.construct ? Reflect.construct.bind() : function (
        Parent, args, Class) {
        var a = [null];
        a.push.apply(a, args);
        var Constructor = Function.bind.apply(Parent, a);
        var instance = new Constructor();
        if (Class) setPrototypeOf(instance, Class.prototype);
        return instance;
    }, construct(Parent, args, Class);
}

function setPrototypeOf(obj, proto) {
    return setPrototypeOf = Object.setPrototypeOf || function (obj, proto) {
        obj.__proto__ = proto;
        return obj;
    }, setPrototypeOf(obj, proto);
}

var config = {};

function configure(options) {
    var initSqlJs = options.initSqlJs;
    var wasmFileBaseUrl = options.wasmFileBaseUrl;
    config.initSqlJs = initSqlJs;
    config.wasmFileBaseUrl = wasmFileBaseUrl;
}

var Sqlite3Database = (function (EventEmitter) {
    function Sqlite3Database(initOptions, callback) {
        var self = this;
        EventEmitter.call(this);

        if (typeof initOptions === "function") {
            callback = initOptions;
            initOptions = undefined;
        }

        var handleError = function (error) {
            if (callback) {
                callback(error);
            } else {
                self.emit("error", error);
            }
        };

        var wasmFileBaseUrl = config.wasmFileBaseUrl || (
            typeof window !== "undefined" ? window
            .SQL_JS_WASM_FILE_BASE_URL : undefined);
        var isNode = typeof process !== "undefined" && process.release
            .name === "node";

        if (!isNode) {
            if (!wasmFileBaseUrl) {
                return handleError(new Error(
                    "The base URL for `sql.js` `*.wasm` files is not configured"
                    ));
            }
            if (wasmFileBaseUrl[wasmFileBaseUrl.length - 1] !== "/") {
                return handleError(new Error(
                    'The base URL for `sql.js` `*.wasm` files must end with a "/"'
                    ));
            }
        }

        (config.initSqlJs ? Promise.resolve(config.initSqlJs) : isNode ?
            import("sql.js").then(function (module) {
                return module.default;
            }) : typeof window !== "undefined" ? Promise.resolve(window
                .initSqlJs) : Promise.reject(new Error(
                "`window` is not defined")))
        .then(function (initSqlJs) {
            if (!initSqlJs) {
                return handleError(new Error(
                    "`sql.js` not found"));
            }
            return initSqlJs({
                locateFile: isNode ? undefined :
                    function (file) {
                        return wasmFileBaseUrl + file;
                    }
            }).then(function (SQL) {
                self.database = new SQL.Database();
                self.emit("open");
                if (callback) callback(null);
            }, handleError);
        }, handleError);

        return self;
    }

    if (typeof EventEmitter !== "function" && EventEmitter !== null) {
        throw new TypeError(
            "Super expression must either be null or a function");
    }

    Sqlite3Database.prototype = Object.create(EventEmitter &&
        EventEmitter.prototype, {
            constructor: {
                value: Sqlite3Database,
                writable: true,
                configurable: true
            }
        });

    if (EventEmitter) setPrototypeOf(Sqlite3Database, EventEmitter);

    Sqlite3Database.prototype.close = function (callback) {
        this.database.close();
        this.emit("close");
        if (callback) callback(null);
    };

    Sqlite3Database.prototype.configure = function (options, callback) {
        // Configuration logic can be added here
    };

    Sqlite3Database.prototype.loadExtension = function (path,
    callback) {
        throw new Error("`loadExtension()` is not supported");
    };

    Sqlite3Database.prototype.interrupt = function () {
        // Interrupt logic can be added here
    };

    Sqlite3Database.prototype.wait = function (callback) {
        if (callback) callback(null);
    };

    Sqlite3Database.prototype.serialize = function (callback) {
        if (callback) callback();
    };

    Sqlite3Database.prototype.parallelize = function (callback) {
        if (callback) callback();
    };

    Sqlite3Database.prototype.run = function () {
        var args = Array.prototype.slice.call(arguments);
        var {
            query,
            parameters,
            callback
        } = parseArguments(args);
        var context = {};

        if (callback) callback = callback.bind(context);

        try {
            this.database.run(query, parameters);
            var isInsert = /^\s*insert\s+/i.test(query);
            var isUpdate = /^\s*update\s+/i.test(query);
            var isDelete = /^\s*delete\s+/i.test(query);

            if (isInsert) {
                context.lastID = this.database.exec(
                    "select last_insert_rowid();")[0].values[0][
                    0
                ];
            }
            if (isInsert || isUpdate || isDelete) {
                context.changes = this.database.exec(
                    "select changes();")[0].values[0][0];
            }
            if (callback) asyncCallback(callback, null);
        } catch (error) {
            if (callback) {
                asyncCallback(callback, error);
            } else {
                this.emit("error", error);
            }
        }
        return this;
    };

    Sqlite3Database.prototype.all = function () {
        var args = Array.prototype.slice.call(arguments);
        var {
            query,
            parameters,
            callback
        } = parseArguments(args);

        try {
            var results = [];
            this.database.each(query, parameters, function (row) {
                results.push(row);
            }, function () {
                if (callback) asyncCallback(callback, null,
                    results);
            });
        } catch (error) {
            if (!callback) throw error;
            asyncCallback(callback, error);
        }
        return this;
    };

    Sqlite3Database.prototype.each = function () {
        var args = Array.prototype.slice.call(arguments);
        var {
            query,
            parameters,
            callback
        } = parseArguments(args);

        try {
            this.database.each(query, parameters, function (row) {
                if (callback) asyncCallback(callback, null,
                    row);
            });
        } catch (error) {
            if (!callback) throw error;
            asyncCallback(callback, error);
        }
        return this;
    };

    Sqlite3Database.prototype.get = function () {
        var args = Array.prototype.slice.call(arguments);
        var {
            query,
            parameters,
            callback
        } = parseArguments(args);

        try {
            var result = this.database.exec(query, parameters)[0];
            if (callback) asyncCallback(callback, null, result);
        } catch (error) {
            if (!callback) throw error;
            asyncCallback(callback, error);
        }
        return this;
    };

    Sqlite3Database.prototype.exec = function (query, callback) {
        try {
            this.database.exec(query);
            if (callback) asyncCallback(callback, null);
        } catch (error) {
            if (callback) {
                asyncCallback(callback, error);
            } else {
                this.emit("error", error);
            }
        }
        return this;
    };

    Sqlite3Database.prototype.prepare = function () {
        var args = Array.prototype.slice.call(arguments);
        var {
            query,
            parameters,
            callback
        } = parseArguments(args);
        var statement = {};

        try {
            statement = this.database.prepare(query, parameters);
            if (callback) asyncCallback(callback, null);
        } catch (error) {
            if (!callback) throw error;
            asyncCallback(callback, error);
        }
        return statement;
    };

    return Sqlite3Database;
})(EventEmitter);

var nextTick = (function () {
    if (typeof process !== "undefined" && typeof process.nextTick ===
        "function") {
        return function (callback) {
            process.nextTick(callback);
        };
    }

    var setImmediateAvailable = typeof window !== "undefined" && window
        .setImmediate;
    var postMessageAvailable = typeof window !== "undefined" && window
        .postMessage && window.addEventListener;

    if (setImmediateAvailable) {
        return function (callback) {
            window.setImmediate(callback);
        };
    }

    if (postMessageAvailable) {
        var messageQueue = [];
        window.addEventListener("message", function (event) {
            if (event.source === window && event.data ===
                "process-tick") {
                event.stopPropagation();
                if (messageQueue.length > 0) {
                    messageQueue.shift()();
                }
            }
        }, true);

        return function (callback) {
            messageQueue.push(callback);
            window.postMessage("process-tick", "*");
        };
    }

    return function (callback) {
        setTimeout(callback, 0);
    };
})();

function asyncCallback(callback, error, result) {
    nextTick(function () {
        callback(error, result);
    });
}

function parseArguments(args) {
    var query = args.shift();
    var parameters = [];
    var callback;

    if (args.length === 0) {
        parameters = [];
    } else if (typeof args[args.length - 1] === "function") {
        callback = args.pop();
        parameters = args;
    } else {
        parameters = args;
    }

    if (parameters.length === 1 && parameters[0] !== null && typeof parameters[
            0] === "object") {
        parameters = parameters[0];
    }

    return {
        query: query,
        parameters: parameters,
        callback: callback
    };
}

function verbose() {
    return {
        Database: Sqlite3Database,
        verbose: verbose
    };
}

export default {
    Database: Sqlite3Database,
    configure: configure,
    verbose: verbose
}