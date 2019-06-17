const splitArray = require('split-array');
const Data = require('./data');

/**
 * A dump and restore utility.
 */
class Dump {
	/**
	 * Initialize dump utility with the given knexfile object.
	 */
	constructor(config) {
		this.config = config;
		this.knex = require('knex')(this.config);
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

	/**
	 * Return a promise that resolves after all data has been written into the database.
	 */
	async restore(data) {
		let self = this;
		const tables = data.getTables();

		for (let t = 0; t < tables.length; t++) {
			const table = tables[t];
			await self.truncate(table);
		}

		for (let t = tables.length - 1; t >= 0; t--) {
			const table = tables[t];
			const entries = data.getData(table);
			if (entries && entries.length) {
				await Promise.all(splitArray(entries, 100).map(chunk => self.knex(table).insert(chunk)));
			}
		}
	}
}

module.exports = Dump;
