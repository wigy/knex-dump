const Dump = require('./dump');

const SQL = {
	findExistingSequences: `
		SELECT table_name, column_name, column_default
		FROM information_schema.columns
		WHERE table_name <> 'knex_migrations'
		AND column_default ILIKE 'nextval%'
	`,
	updateSequence: 'SELECT setval(?, ?)'
};

class PostgresDump extends Dump {
	async restore(data) {
		await super.restore(data);

		const { rows } = await this.knex.raw(SQL.findExistingSequences, this.config.schema);
		for (let s = 0; s < rows.length; s++) {
			const { table_name, column_name, column_default } = rows[s];
			const [_, sequence] = /nextval\('([^']*)'::.*\)/.exec(column_default);
			const lastValueForSequence = data.getData(table_name).reduce((res, d) => Math.max(res, d[column_name]), 0);
			await this.knex.raw(SQL.updateSequence, [sequence, lastValueForSequence]);
		}
	}
}

module.exports = PostgresDump;
