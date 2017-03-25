const JSONFormat = require('json-format');

/**
 * Data container.
 */
class Data {

    /**
     * Initialize table data optionally with the given initial data.
     */
    constructor(init) {
        init = init || {};
        this.content = {
            date: init.date || new Date().toISOString(),
            version: require('../package.json').version,
            tables: init.tables || [],
            columns: {},
            rows: {},
            data: init.data || {},
        };
    }

    /**
     * Append a table with the given content into the collection.
     */
    add(table, order, rows) {
        this.content.tables.push(table);
        this.content.data[table] = rows;
        this.content.rows[table] = rows.length;
        this.content.columns[table] = order;
    }

    /**
     * Get a list of table names.
     */
    getTables() {
        return this.content.tables;
    }

    /**
     * Get row data of the given table.
     */
    getData(table) {
        return this.content.data[table];
    }

    /**
     * Convert all data to the string presentation.
     */
    toString() {
        return JSONFormat(this.content, {
            type: 'space',
            size: 2
        });
    }
}

module.exports = Data;
