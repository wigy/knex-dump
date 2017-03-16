# Wigy's Knex Dump

This is a tool to backup and restore small Knex-based databases.

## Usage

In the directory containing a `knexfile.js`, you can save all data to the dump file:
```shell
    knex-dump --file dump.json save
```

Then it can be restored to the database
```shell
    knex-dump --file dump.json load
```

## Future ideas

* Figure out some canonical sorting. For example: primary key, indexes, then other fields in alphabetical order.
* If this is needed for bigger databases, it would require some refactoring in order to
handle streams instead of JSON-data blocks in memory.

## Version history
