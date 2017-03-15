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
        let queries = [];
        let data = {};
        this.tables()
            .then(tables => {
                return tables.filter(table => table !== 'knex_migrations' && table !== 'knex_migrations_lock');
            })
            .then(tables => tables.forEach(table => {
                queries.push(this.knex(table).select('*').then(rows => {
                        data[table] = rows;
                        console.log("Fetched", table);
                    }));
                }
            ));

        return Promise.all(queries);
    }
}

module.exports = Dump;
