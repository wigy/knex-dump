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
	dump() {
		let self = this;
		return new Promise(function(resolve, reject) {
			self.tables()
				.then(tables => {
					return tables
						.filter(table => table.name !== 'knex_migrations' && table.name !== 'knex_migrations_lock')
						.sort();
				})
				.then(tables => {
					let queries = [];
					let output = new Data();
					tables.forEach(table => {
						let knex = self.knex(table.name).select('*');
						table.order.map(column => (knex = knex.orderBy(column)));
						queries.push(
							knex.then(rows => {
								output.add(table.name, table.order, rows);
								return null;
							})
						);
					});
					Promise.all(queries).then(() => {
						resolve(output);
					});
				})
				.catch(err => reject(err));
		});
	}

	/**
	 * Return a promise that resolves after all data has been written into the database.
	 */
	restore(data) {
		let self = this;
		return new Promise(function(resolve, reject) {
			let queries = [];

			data.getTables().forEach(table => {
				queries.push(
					self.truncate(table).then(() => {
						let entries = data.getData(table);
						if (entries && entries.length) {
							return Promise.all(splitArray(entries, 100).map(chunk => self.knex(table).insert(chunk)));
						}
						return Promise.resolve(null);
					})
				);
			});

			Promise.all(queries)
				.then(() => {
					resolve();
				})
				.catch(err => reject(err));
		});
	}
}

module.exports = Dump;
