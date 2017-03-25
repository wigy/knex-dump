const fs = require('fs');
const Dump = require('./lib/dump');
const Data = require('./lib/data');

module.exports = {

    /**
     * Save the database to the given JSON-file.
     *
     * @param configPath Path to the Knexfile.js
     * @param jsonPath The path to the JSON-file for saving data.
     * @returns A promise resolving successfully when save completed.
     */
    save(configPath, jsonPath) {
        let knexDump = new Dump(configPath);
        return knexDump.dump().then(output => {
            fs.writeFileSync(jsonPath, output.toString());
        });
    },

    /**
     * Load the database content from the given JSON-file.
     *
     * @param configPath Path to the Knexfile.js
     * @param jsonPath The path to the JSON-file containg data to load.
     * @returns A promise resolving successfully when load completed.
     */
    load(configPath, jsonPath) {
        let knexDump = new Dump(configPath);
        let input = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        return knexDump.restore(new Data(input));
    }
};
