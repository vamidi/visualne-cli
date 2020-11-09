#!/usr/bin/env node
'use strict';

const currentVersion = process.versions.node;
const requiredMajorVersion = parseInt(currentVersion.split(".")[0], 10);
const minimumMajorVersion = 10

if (requiredMajorVersion < minimumMajorVersion) {
    console.error(`Node.js v${currentVersion} is out of date and unsupported!`);
    console.error(`Please use Node.js v${minimumMajorVersion} or higher.`);
    process.exit(1);
}

const program = require('commander');

program.version(require('../package.json').version)
program.option('-g --git', 'Initialize plugin with git');
program.option('-y --yes', 'Skip prompt');
program.option('-i --install', 'Build plugin with dependencies');
program.option('-t --template <name>', 'Build plugin with template');
program.parse(process.argv);

// npx create-snowpack-app new-dir --template @snowpack/app-template-NAME [--use-yarn | --use-pnpm | --no-install]
if(program.template)
    require('./cli')(program);
console.log(program.version);
