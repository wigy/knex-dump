const Dump = require('./dump');

const SQL = {
	listTables: `SELECT "table_name" AS "name" FROM "information_schema"."tables" WHERE "table_schema" = ? AND "table_type" = 'BASE TABLE'`,
	listColumns:
		'SELECT "table_name" AS "tableName", "ordinal_position" AS "position", "column_name" AS "name" FROM "information_schema"."columns" WHERE "table_schema" = ?',
	listConstraints: `SELECT tc."table_name" AS "foreignTable", tc2."table_name" AS "primaryTable"
	FROM "information_schema"."table_constraints" tc
	INNER JOIN "information_schema"."referential_constraints" rc
		ON tc."constraint_name" = rc."constraint_name"
	INNER JOIN "information_schema"."table_constraints" tc2
		ON rc."unique_constraint_name" = tc2."constraint_name"
	WHERE tc."constraint_type" = 'FOREIGN KEY'
	AND tc."table_schema" = ?`,
	findExistingSequences: `
		SELECT table_name, column_name, column_default
		FROM information_schema.columns
		WHERE table_name <> 'knex_migrations'
		AND table_schema = ?
		AND column_default ILIKE 'nextval%'
	`,
	updateSequence: 'SELECT setval(?, ?)'
};

class PostgresDump extends Dump {
	tables() {
		return Promise.all([
			this.knex.raw(SQL.listTables, this.config.schema),
			this.knex.raw(SQL.listColumns, this.config.schema),
			this.knex.raw(SQL.listConstraints, this.config.schema)
		]).then(([tables, columns, constraints]) => {
			let toSort = tables.rows.map(({ name }) => ({
				name,
				order: [columns.rows.find(c => c.tableName === name && c.position === 1).name]
			}));
			let result = [];
			while (toSort.length > 0) {
				// sort tables with the less dependents first
				const nonDependents = toSort.filter(t => !constraints.rows.find(c => c.primaryTable === t.name && c.foreignTable !== t.name));
				result.push(...nonDependents);
				toSort = toSort.filter(t => !nonDependents.some(d => d === t));
				constraints.rows = constraints.rows.filter(c => !result.some(r => c.foreignTable === r.name));
			}

			return result;
		});
	}

	insert(trx, table, chunk) {
		chunk = chunk.map(row =>
			Object.keys(row).reduce(
				(res, k) => ({ ...res, [k]: Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k] }),
				{}
			)
		);
		return super.insert(trx, table, chunk);
	}

	async restore(data) {
		await super.restore(data);

		const { rows } = await this.knex.raw(SQL.findExistingSequences, this.config.schema);
		for (let s = 0; s < rows.length; s++) {
			const { table_name, column_name, column_default } = rows[s];
			const dataRows = data.getData(table_name);
			if (dataRows && dataRows.length) {
				const [_, sequence] = /nextval\('([^']*)'::.*\)/.exec(column_default);
				const lastValueForSequence = dataRows.reduce((res, d) => Math.max(res, d[column_name]), 0);
				await this.knex.raw(SQL.updateSequence, [sequence, lastValueForSequence]);
			}
		}
	}
}

module.exports = PostgresDump;
