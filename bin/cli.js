#!/usr/bin/env node

const Dump = require('../lib/dump');
let configPath = process.cwd() + '/knexfile.js';
let dump = new Dump(configPath);

dump.dump().then(data => {
    console.log("Dump complete");
//    process.exit();
}).catch(err => console.log(err));
