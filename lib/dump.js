const Data = require('./data');

class Dump {

    constructor(configPath) {
        this.config = require(configPath);
        this.knex = require('knex')(this.config);
    }

    tables() {
        switch(this.config.client) {
            case 'sqlite3':
                return this.knex.raw("SELECT name FROM sqlite_master WHERE type='table'")
                    .then(data => data.map(row => row.name).filter(name => name !== 'sqlite_sequence'));
            default:
                throw new Error("Database engine '" + this.config.client + "' not yet supported (in tables()).");
        }
    }

    truncate(table) {
        switch(this.config.client) {
            case 'sqlite3':
                return this.knex.raw('DELETE FROM `' + table + '`');
            default:
                throw new Error("Database engine '" + this.config.client + "' not yet supported (in truncate()).");
        }
    }

    dump() {
        let self = this;
        return new Promise(function(resolve, reject) {

            self.tables()
                .then(tables => {
                    return tables.filter(table => table !== 'knex_migrations' && table !== 'knex_migrations_lock').sort();
                })
                .then(tables => {
                    let queries = [];
                    let output = new Data();
                    tables.forEach(table => {
                        queries.push(self.knex(table).select('*').then(rows => {
                            output.add(table, rows);
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

    restore(data) {
        let self = this;
        return new Promise(function(resolve, reject) {

            let queries = [];

            data.getTables().forEach(table => {
                queries.push(self.truncate(table).then(() => {
                    return self.knex(table).insert(data.getData(table));
                }));
            });

            Promise.all(queries).then(() => {
                resolve();
            }).catch(err => reject(err));
        });
    }
}

module.exports = Dump;
