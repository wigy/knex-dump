const Dump = require('./dump');

const SQL = {
	listTables:
		"SELECT TABLE_NAME AS [name] FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' AND TABLE_SCHEMA = ?",
	listColumns:
		'SELECT TABLE_NAME AS [tableName], ORDINAL_POSITION AS [position], COLUMN_NAME AS [name] FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?',
	listConstraints: `SELECT tc.TABLE_NAME AS foreignTable, tc2.TABLE_NAME AS primaryTable
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc2
            ON rc.UNIQUE_CONSTRAINT_NAME = tc2.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
        AND tc.CONSTRAINT_SCHEMA = ?`,
	listIdentityTables:
		"SELECT TABLE_NAME AS [name] FROM INFORMATION_SCHEMA.COLUMNS WHERE COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA+'.'+TABLE_NAME), COLUMN_NAME, 'IsIdentity') = 1",
	listComputedColumns: 'SELECT [name] FROM sys.columns WHERE is_computed = 1 AND object_id = OBJECT_ID(?)',
	setIdentityOn: 'SET IDENTITY_INSERT ??.?? ON',
	setIdentityOff: 'SET IDENTITY_INSERT ??.?? OFF'
};

class MSSQLDump extends Dump {
	tables() {
		return Promise.all([
			this.knex.raw(SQL.listTables, this.config.schema),
			this.knex.raw(SQL.listColumns, this.config.schema),
			this.knex.raw(SQL.listConstraints, this.config.schema)
		]).then(([tables, columns, constraints]) => {
			let toSort = tables.map(({ name }) => ({
				name,
				order: [columns.find(c => c.tableName === name && c.position === 1).name]
			}));
			let result = [];
			while (toSort.length > 0) {
				// sort tables with the less dependents first
				const nonDependents = toSort.filter(t => !constraints.find(c => c.primaryTable === t.name));
				result.push(...nonDependents);
				toSort = toSort.filter(t => !nonDependents.some(d => d === t));
				constraints = constraints.filter(c => !result.some(r => c.foreignTable === r.name));
			}

			return result;
		});
	}

	restore(data) {
		let self = this;

		// list identity tables
		let identityTables;
		return (
			self.knex
				.raw(SQL.listIdentityTables)
				.then(tables => {
					identityTables = tables.map(t => t.name);
				})

				// truncate data
				.then(() =>
					data.getTables().reduce((p, table) => p.then(() => self.truncate(table)), Promise.resolve())
				)

				// insert data
				.then(() =>
					self.knex.transaction(trx =>
						// insert data for tables with the more dependents first
						data
							.getTables()
							.reverse()
							.reduce(
								(p, table) =>
									p
										.then(() => trx.raw(SQL.listComputedColumns, table))
										.then(columns => columns.map(({ name }) => name))
										.then(skipColumns => {
											let entries = data.getData(table);
											let chunks = [];
											while (entries && entries.length) {
												const chunkSize = 100;
												// insert data in chunks to avoid hitting bindings limits
												const chunk = entries.slice(0, chunkSize).map(e =>
													// don't insert computed columns
													Object.keys(e).reduce(
														(res, k) =>
															skipColumns.indexOf(k) < 0 ? { ...res, [k]: e[k] } : res,
														{}
													)
												);
												chunks.push(chunk);
												entries = entries.slice(chunkSize);
											}
											return chunks.reduce((p, chunk) => {
												if (identityTables.indexOf(table) >= 0) {
													// this table has an identity column
													return p.then(() => {
														const on = trx
															.raw(SQL.setIdentityOn, [self.config.schema, table])
															.toSQL();
														const insert = trx(table)
															.insert(chunk)
															.toSQL();
														const off = trx
															.raw(SQL.setIdentityOff, [self.config.schema, table])
															.toSQL();

														// table has an identity column,
														// insert needs to be done with IDENTITY_INSERT ON
														// and that needs to run in the same query as the insert
														return trx.raw(`${on.sql}; ${insert.sql}; ${off.sql};`, [
															...on.bindings,
															...insert.bindings,
															...off.bindings
														]);
													});
												} else {
													return p.then(() => trx(table).insert(chunk));
												}
											}, Promise.resolve());
										}),
								Promise.resolve()
							)
					)
				)
		);
	}
}

module.exports = MSSQLDump;
