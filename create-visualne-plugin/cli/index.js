#!/usr/bin/env node
'use strict';

module.exports = async(program) => {
    require = require('esm')(module /*, options*/);
    return require('./createVisualnePlugin').cli(program);
};

