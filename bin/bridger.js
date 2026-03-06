#!/usr/bin/env node

'use strict';

const {
    runCLI
} = require('../dist/cli/index');
runCLI(process.argv.slice(2));