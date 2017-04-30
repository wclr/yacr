#!/usr/bin/env node
import * as yargs from 'yargs'
import { removeFromCache } from '.'

console.log('Clean up yarn cache like a boss.\n')

const argv = yargs
  .usage('yacr pakcage1 package2@version @scope/package@version')
  .demand(1, 'Please give package name to remove from cache: `package` or `package@version`')
  .help()
  .argv


removeFromCache(argv._)
