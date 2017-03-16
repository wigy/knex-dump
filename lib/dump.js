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
                    return tables.filter(table => table !== 'knex_migrations' && table !== 'knex_migrations_lock').sort();
                })
                .then(tables => {
                    let queries = [];
                    let output = new Output();
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
        console.log(data.content.tables);
    }
}

module.exports = Dump;
