const JSONFormat = require('json-format');

class Data {

    constructor(init) {
        init = init || {};
        this.content = {
            date: init.date || new Date().toISOString(),
            tables: init.tables || [],
            data: init.data || {},
        };
    }

    add(table, rows) {
        this.content.tables.push(table);
        this.content.data[table] = rows;
    }

    toString() {
        return JSONFormat(this.content, {
            type: 'space',
            size: 2
        });
    }
}

module.exports = Data;
