const JSONFormat = require('json-format');

class Output {

    constructor(tableData) {
        this.data = {
            date: new Date().toISOString(),
            tables: Object.keys(tableData),
            data: tableData,
        };
    }

    toString() {
        return JSONFormat(this.data.data, {
            type: 'space',
            size: 2
        });
    }
}

module.exports = Output;
