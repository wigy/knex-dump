const splitArray = require('split-array');
const Data = require('./data');

/**
 * A dump and restore utility.
 */
class Dump {

    /**
     * Initialize dump utility with the given knexfile object.
     */
    constructor(config) {
        this.config = config;
        this.knex = require('knex')(this.config);
    }

    /**
     * Return a promise resolving with the list of table descriptions {name: *table name*, order: *sorting order*}.
     */
    tables() {
        switch(this.config.client) {
            case 'sqlite3':
                return this.knex.raw("SELECT * FROM sqlite_master")
                    .then(data => {

                        let ret = [];
                        let primary = {};
                        let indexed = {};
                        let others = {};

                        data = data.filter(row => row.name !== 'sqlite_sequence');

                        // Parse SQL definitions to find out field names.
                        data.forEach(row => {

                            primary[row.name] = primary[row.name] || [];
                            indexed[row.name] = indexed[row.name] || [];
                            others[row.name] = others[row.name] || [];

                            if (row.type === 'table') {
                                let sql = row.sql.replace(/^[^(]*\((.*)\)/, '$1');
                                let line, name, type, attrs;
                                while (sql !== '') {
                                    sql = sql.trim();
                                    let skip = /^(FOREIGN|PRIMARY) KEY \((.*?)\)( REFERENCES \w+ \(\w+\))?/.exec(sql);
                                    if (skip) {
                                        [line, type, name] = skip;
                                        if (type === 'PRIMARY') {
                                            primary[row.name].push(name);
                                        } else {
                                            indexed[row.name].push(name);
                                        }
                                        line = skip[0];
                                    } else {
                                        let match = /^(\w+) (INTEGER|VARCHAR\(\d+\)|NUMERIC\(\d+,\s*\d+\)|DATE|DATETIME|BOOL|TEXT)(( PRIMARY KEY| AUTOINCREMENT| (NOT )NULL)*)\s*/i.exec(sql);

                                        if (!match) {
                                            throw new Error('Not able to parse SQL: ' + sql);
                                        }
                                        [line, name, type, attrs] = match;

                                        if (/PRIMARY KEY/i.test(attrs)) {
                                            primary[row.name].push(name);
                                        } else {
                                            others[row.name].push(name);
                                        }
                                    }
                                    sql = sql.substr(line.length);
                                    sql = sql.replace(/^\s*,\s*/, '');
                                }
                            } else if(row.type === 'index') {
                                if (!row.sql) {
                                    return;
                                }
                                // Collect first of each indexed field names from SQL definitions.
                                let regex = /CREATE INDEX \w+ ON "?(\w+)"? \((.*)\)/.exec(row.sql);
                                let table = regex[1];
                                let fields = regex[2].trim().split(',');
                                if (!table) {
                                    throw new Error('Cannot find table name from SQL: ' + row.sql);
                                }
                                if (!fields) {
                                    throw new Error('Cannot find field names from SQL: ' + row.sql);
                                }
                                fields.forEach(field => {
                                    field = field.trim().replace(/^"/, '').replace(/"$/, '');
                                    indexed[table].push(field);
                                });
                            }
                        });

                        // Combine now findings into result data.
                        data.forEach(row => {
                            if (row.type === 'table') {
                                let order = primary[row.name].sort();
                                indexed[row.name].forEach(name => {
                                    if (order.indexOf(name) < 0) {
                                        order.push(name);
                                    }
                                });
                                others[row.name].sort().forEach(name => {
                                    if (order.indexOf(name) < 0) {
                                        order.push(name);
                                    }
                                });
                                ret.push({name: row.name, order: order});
                            }
                        });

                        return ret;
                    });
            default:
                throw new Error("Database engine '" + this.config.client + "' not yet supported (in tables()).");
        }
    }

    /**
     * Return a promise truncating the given table.
     */
    truncate(table) {
        switch(this.config.client) {
            case 'sqlite3':
                return this.knex.raw('DELETE FROM `' + table + '`');
            default:
                throw new Error("Database engine '" + this.config.client + "' not yet supported (in truncate()).");
        }
    }

    /**
     * Return a promise resolved with the full Data object containing all database data.
     */
    dump() {
        let self = this;
        return new Promise(function(resolve, reject) {

            self.tables()
                .then(tables => {
                    return tables.filter(table => table.name !== 'knex_migrations' && table.name !== 'knex_migrations_lock').sort();
                })
                .then(tables => {
                    let queries = [];
                    let output = new Data();
                    tables.forEach(table => {
                        let knex = self.knex(table.name).select('*');
                        table.order.map(column => knex = knex.orderBy(column));
                        queries.push(knex.then(rows => {
                            output.add(table.name, table.order, rows);
                            return null;
                        }));
                    });
                    Promise.all(queries).then(() => {
                        resolve(output);
                    });
                })
                .catch(err => reject(err));
        });
    }

    /**
     * Return a promise that resolves after all data has been written into the database.
     */
    restore(data) {
        let self = this;
        return new Promise(function(resolve, reject) {

            let queries = [];

            data.getTables().forEach(table => {
                queries.push(self.truncate(table).then(() => {
                    let entries = data.getData(table);
                    if (entries && entries.length) {
                        return Promise.all(splitArray(entries,100).map(chunk => self.knex(table).insert(chunk)));
                    }
                    return Promise.resolve(null);
                }));
            });

            Promise.all(queries).then(() => {
                resolve();
            }).catch(err => reject(err));
        });
    }
}

module.exports = Dump;
