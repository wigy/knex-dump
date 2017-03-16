const JSONFormat = require('json-format');

class Output {

    constructor(tableData) {
        this.data = {
            date: new Date().toISOString(),
            tables: [],
            data: {},
        };
    }

    add(table, rows) {
        this.data.tables.push(table);
        this.data.data[table] = rows;
    }

    toString() {
        return JSONFormat(this.data.data, {
            type: 'space',
            size: 2
        });
    }
}

module.exports = Output;
