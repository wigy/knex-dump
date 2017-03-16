#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const STDOUT = Symbol('STDOUT');
const fs = require('fs');

const Dump = require('../lib/dump');
const Output = require('../lib/output');

let configPath = process.cwd() + '/knexfile.js';
let dump = new Dump(configPath);

const parser = new ArgumentParser({
  addHelp: true,
  description: 'Utility to load and save knex-based databases.'
});
parser.addArgument('command', {choices: ['save', 'load']});
parser.addArgument('--file', {defaultValue: STDOUT});
const args = parser.parseArgs();

switch(args.command) {

    case 'save':
        dump.dump().then(output => {
            // TODO: Do some canonical sorting.
            if (args.file===STDOUT) {
                console.log(output.toString())
            } else {
                fs.writeFileSync(args.file, output.toString());
            }
            process.exit();
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
        break;

// TODO: Restore functionality.
}
