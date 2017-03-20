# Wigy's Knex Dump

This is a tool to backup and restore small Knex-based databases.
Note that this is using only in-memory JSON-blocks and does not use streaming.
Thus it is not suitable for huge databases.

## Usage

In the directory containing a `knexfile.js`, you can save all data to the dump file:
```shell
    knex-dump --file dump.json save
```

Then it can be restored to the database
```shell
    knex-dump --file dump.json load
```

## Version history

* 1.0.0 Simple dumping and restoring on a file.
* 1.0.1 Canonical sorting for all columns.
