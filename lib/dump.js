const Output = require('./output');

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
                throw new Error("Database engine '" + this.config.client + "' not yet supported.");
        }
    }

    dump() {
        var self = this;
        return new Promise(function(resolve, reject) {
            self.tables()
                .then(tables => {
                    return tables.filter(table => table !== 'knex_migrations' && table !== 'knex_migrations_lock');
                })
                .then(tables => {
                    let queries = [];
                    let data = {};
                    tables.forEach(table => {
                        queries.push(self.knex(table).select('*').then(rows => {
                                data[table] = rows;
                                return rows;
                            }));
                    });
                    Promise.all(queries).then(results => {
                        resolve(new Output(data));
                    });
                })
                .catch(err => reject(err));
        });
    }
}

module.exports = Dump;
