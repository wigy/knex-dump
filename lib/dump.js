const splitArray = require('split-array');
const Data = require('./data');

/**
 * A dump and restore utility.
 */
class Dump {

    /**
     * Initialize dump utility with the given knexfile.
     */
    constructor(configPath) {
        this.config = require(configPath);
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
                                // Collect field names from SQL definitions.
                                let fields = row.sql.replace(/^[^(]*\((.*)\)/, '$1').split(',');
                                fields.forEach(field => {
                                    let name = field.replace(/^\s*"([^"]+)".*/, '$1');
                                    if (name !== field) {
                                        if (/primary/.test(field)) {
                                            primary[row.name].push(name);
                                        } else {
                                            others[row.name].push(name);
                                        }
                                    }
                                });
                                // Parse primary key definition.
                                let key = row.sql.replace(/.*primary key \(([^)]*)\).*/, '$1');
                                if (key !== row.sql) {
                                    key.split(',').forEach(name => {
                                        name = name.trim().replace(/^"/, '').replace(/"$/, '');
                                        if (primary[row.name].indexOf(name) < 0) {
                                            primary[row.name].push(name);
                                        }
                                    });
                                }
                            } else if(row.type === 'index') {
                                if (!row.sql) {
                                    return;
                                }
                                // Collect first of each indexed field names from SQL definitions.
                                let table = row.sql.replace(/.* on "(.*?)".*/, '$1');
                                let fields = row.sql.replace(/^[^(]*\((.*)\)/, '$1').split(',');
                                fields.forEach(field => {
                                    field = field.trim().replace(/^"/, '').replace(/"$/, '');
                                    indexed[table].push(field);
                                });
                            }
                        });

                        // Combine now findings into result data.
                        data.forEach(row => {
                            if (row.type === 'table') {
                                let order = primary[row.name];
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
