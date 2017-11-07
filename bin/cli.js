#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const STDIN_OR_OUT = Symbol('STDIN_OR_OUT');
const fs = require('fs');
const Dump = require('../lib/dump');
const Data = require('../lib/data');

const parser = new ArgumentParser({
  addHelp: true,
  description: 'Utility to load and save knex-based databases.'
});
parser.addArgument('command', {choices: ['dump', 'restore']});
parser.addArgument('--file', {defaultValue: STDIN_OR_OUT});
parser.addArgument('--db', {defaultValue: null});
const args = parser.parseArgs();

let config;

if (args.db) {
    config = {
        client: 'sqlite3',
        connection: {
            filename: args.db
        },
        useNullAsDefault: true
    };
} else {
    config = require(process.cwd() + '/knexfile.js');
}
let knexDump = new Dump(config);

switch(args.command) {

    case 'dump':
        knexDump.dump().then(output => {
            if (args.file===STDIN_OR_OUT) {
                console.log(output.toString());
            } else {
                fs.writeFileSync(args.file, output.toString());
            }
            process.exit();
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
        break;

    case 'restore':
        if (args.file===STDIN_OR_OUT) {
            console.error("Reading STDIN not implemented.");
        } else {
            let input = JSON.parse(fs.readFileSync(args.file, 'utf8'));
            knexDump.restore(new Data(input)).then(() => {
                process.exit(0);
            }).catch(err => {
                console.error(err);
                process.exit(1);
            });
        }
        break;
}
