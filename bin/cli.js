#!/usr/bin/env node

const JSONFormat = require('json-format');
const Dump = require('../lib/dump');
let configPath = process.cwd() + '/knexfile.js';
let dump = new Dump(configPath);

// TODO: Command-line parsing (use cli-argparse for example).
// TODO: Display usage by default.
// TODO: Restore functionality.
dump.dump().then(data => {
    // TODO: Do some canonical sorting.
    let output = {
        date: new Date().toISOString(),
        tables: Object.keys(data),
        data: data,
    };
    console.log(JSONFormat(output, {
        type: 'space',
        size: 2
    }));
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
