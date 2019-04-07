const Dump = require('./dump');

class SQLite3Dump extends Dump {
	tables() {
		return this.knex.raw('SELECT * FROM sqlite_master').then(data => {
			let ret = [];
			let primary = {};
			let indexed = {};
			let others = {};

			data = data.filter(row => row.name !== 'sqlite_sequence');

			// Parse SQL definitions to find out field names.
			data.forEach(row => {
				primary[row.name] = primary[row.name] || [];
				indexed[row.name] = indexed[row.name] || [];
				others[row.name] = others[row.name] || [];

				if (row.type === 'table') {
					let sql = row.sql.replace(/^[^(]*\((.*)\)/, '$1');
					let line, name, type, attrs;
					while (sql !== '') {
						sql = sql.trim();
						let skip = /^(FOREIGN|PRIMARY) KEY \((.*?)\)( REFERENCES \w+ \(\w+\))?/.exec(sql);
						if (skip) {
							[line, type, name] = skip;
							if (type === 'PRIMARY') {
								primary[row.name].push(name);
							} else {
								indexed[row.name].push(name);
							}
							line = skip[0];
						} else {
							let match = /^[`"]?(\w+)["`]? (INTEGER|VARCHAR\(\d+\)|NUMERIC\(\d+,\s*\d+\)|DATE|DATETIME|BOOL|TEXT|TIME)(( PRIMARY KEY| AUTOINCREMENT| (NOT )?NULL)*)\s*/i.exec(
								sql
							);

							if (!match) {
								throw new Error('Not able to parse SQL: ' + sql);
							}
							[line, name, type, attrs] = match;

							if (/PRIMARY KEY/i.test(attrs)) {
								primary[row.name].push(name);
							} else {
								others[row.name].push(name);
							}
						}
						sql = sql.substr(line.length);
						sql = sql.replace(/^\s*,\s*/, '');
					}
				} else if (row.type === 'index') {
					if (!row.sql) {
						return;
					}
					// Collect first of each indexed field names from SQL definitions.
					let regex = /CREATE (?:UNIQUE )?INDEX [`"]?\w+[`"]? ON [`"]?(\w+)[`"]? \((.*)\)/i.exec(row.sql);
					let table = regex && regex[1];
					let fields = regex && regex[2].trim().split(',');
					if (!table) {
						throw new Error('Cannot find table name from SQL: ' + row.sql);
					}
					if (!fields) {
						throw new Error('Cannot find field names from SQL: ' + row.sql);
					}
					fields.forEach(field => {
						field = field
							.trim()
							.replace(/^[`"]/, '')
							.replace(/[`"]$/, '');
						indexed[table].push(field);
					});
				}
			});

			// Combine now findings into result data.
			data.forEach(row => {
				if (row.type === 'table') {
					let order = primary[row.name].sort();
					indexed[row.name].forEach(name => {
						if (order.indexOf(name) < 0) {
							order.push(name);
						}
					});
					others[row.name].sort().forEach(name => {
						if (order.indexOf(name) < 0) {
							order.push(name);
						}
					});
					ret.push({ name: row.name, order: order });
				}
			});

			return ret;
		});
	}
}

module.exports = SQLite3Dump;
