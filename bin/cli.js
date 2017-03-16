#!/usr/bin/env node

const JSONFormat = require('json-format');
const ArgumentParser = require('argparse').ArgumentParser;

const Dump = require('../lib/dump');

let configPath = process.cwd() + '/knexfile.js';
let dump = new Dump(configPath);

const parser = new ArgumentParser({
  addHelp: true,
  description: 'Utility to load and save knex-based databases.'
});
parser.addArgument('command', {choices: ['save', 'load']});
parser.addArgument('--file', {defaultValue: Symbol('STDOUT')});
const res = parser.parseArgs();

switch(res.command) {
    case 'save':
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
        break;
// TODO: Restore functionality.
}
