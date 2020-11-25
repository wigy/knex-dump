const splitArray = require('split-array');
const Data = require('./data');

/**
 * A dump and restore utility.
 */
class Dump {
	/**
	 * Initialize dump utility with the given knexfile object.
	 */
	constructor(configOrKnex) {
		if (typeof configOrKnex === 'object') {
			this.config = config;
			this.knex =  require('knex')(this.config);
		}
		else {
			this.knex = configOrKnex;
		}
	}

	/**
	 * Return a promise truncating the given table.
	 */
	truncate(table) {
		return this.knex(table).delete();
	}

	/**
	 * Return a promise resolved with the full Data object containing all database data.
	 */
	async dump() {
		const output = new Data();
		const tables = await this.tables().then(tables =>
			tables.filter(table => table.name !== 'knex_migrations' && table.name !== 'knex_migrations_lock')
		);
		for (let t = 0; t < tables.length; t++) {
			const table = tables[t];
			let query = this.knex(table.name).select('*');
			table.order.map(column => (query = query.orderBy(column)));
			const rows = await query;
			output.add(table.name, table.order, rows);
		}
		return output;
	}

	get maxParameters() {
		return 500;
	}

	columnCount(rows) {
		return Object.keys(rows[0]).length;
	}

	insert(trx, table, chunk) {
		return trx(table).insert(chunk);
	}

	/**
	 * Return a promise that resolves after all data has been written into the database.
	 */
	async restore(data) {
		const tables = data.getTables();

		for (let t = 0; t < tables.length; t++) {
			const table = tables[t];
			await this.truncate(table);
		}

		return this.knex.transaction(async trx => {
			for (let t = tables.length - 1; t >= 0; t--) {
				const table = tables[t];
				const entries = data.getData(table);
				if (entries && entries.length) {
					// ensure every chunk doesn't overflow the max parameters
					const chunkSize = Math.floor(this.maxParameters / this.columnCount(entries, table));
					const chunks = splitArray(entries, chunkSize);
					for (let c = 0; c < chunks.length; c++) {
						const chunk = chunks[c];
						await this.insert(trx, table, chunk);
					}
				}
			}
		});
	}
}

module.exports = Dump;
