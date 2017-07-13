# Wigy's Knex Dump

This is a tool to backup and restore small Knex-based databases.
Note that this is using only in-memory JSON-blocks and does not use streaming.
Thus it is not suitable for huge databases.

## Usage

### Command line

In the directory containing a `knexfile.js`, you can save all data to the dump file:
```shell
    knex-dump --file dump.json save
```

Then it can be restored to the database
```shell
    knex-dump --file dump.json load
```

### For seed data

In a project using Knex, you can make seed data managament easy. Add a script
```json
  "scripts": {
    ...
    "save": "knex-dump --file seeds/data.json save"
  },
```
to your `package.json`. Then you can dump the current state of the database as seed data
by running
```shell
    npm run save
```

Then you need only one seed file, for example `seeds/load-database.js`, having
```javascript
exports.seed = function(knex, Promise) {
  return require('knex-dump').load(__dirname + '/../knexfile.js', __dirname + '/data.json');
};
```


## Version history

* 1.0.0 Simple dumping and restoring on a file.
* 1.0.1 Canonical sorting for all columns.
* 1.0.2 An interface for using `neat-dump` as a Node-module.
* 1.0.3 Avoid crash if data is missing.
* 1.0.4 Load data in chunks to avoid sqlite limitations.
