#!/usr/bin/env node

import { exec } from 'child_process'
import * as yargs from 'yargs'
import * as fs from 'fs'
import * as path from 'path'
import * as rimraf from 'rimraf'

console.log('Clean up yarn cache like a boss.\n')
const argv = yargs
  .usage('yacr pakcage1 package2@version @scope/package@version')
  .demand(1, 'Please give package name to remove from cache: `package` or `package@version`')
  .help()
  .argv

const promisify = <P, R>(fn: (param: P, callback?: (err: any, res: R, ...rest: any[]) => any) => any) =>
  (param: P) => new Promise<R>((resolve, reject) => {
    fn(param, (err, res) => err ? reject(err) : resolve(res))
  })
const execCmd = promisify(exec)

export const getYarnCachDir = () =>
  new Promise<string>((resolve, reject) =>
    exec('yarn cache dir', (err, stdout) => err
      ? reject(err)
      : resolve(stdout.trim()))
  )

const readDir = (path: string) =>
  new Promise<string[]>((resolve, reject) => {
    fs.readdir(path, (err, list) => err
      ? reject(err)
      : resolve(list)
    )
  })

const removeDir = (path: string) =>
  new Promise((resolve, reject) =>
    rimraf(path, (err) => err
      ? reject(err)
      : resolve()
    ))

const parsePackageName = (packageName: string) => {
  let match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  return { scope: (match[1] || '').slice(0, -1), name: match[2] || '', version: match[3] || '' }
    
}

interface Options {
  cacheFolder?: string
}

let execute = async (packages: string[], options: Options = {}) => {
  let cacheDir = options.cacheFolder
    ? path.resolve(process.cwd(), options.cacheFolder)
    : await getYarnCachDir()
  if (!cacheDir) {
    console.log('Could not get yarn cache directory location.')
    return
  }
  let dirList = await readDir(cacheDir)
  packages.forEach(async (packageName) => {
    var pkg = parsePackageName(packageName)
    if (!pkg.name) {
      console.log('Could not parse package name', pkg.name)
    }
    let scopeDir = ''
    if (pkg.scope) {
      scopeDir = 'npm-' + pkg.scope
      dirList = await readDir(cacheDir + '/' + scopeDir)      
    }
    dirList.forEach(async (dirName) => {
      const nameParts = dirName.split(/-/)
      const repoType = pkg.scope ? 'npm' : nameParts.shift()
      const nameWithoutRepo = nameParts.join('-')      
      if (nameWithoutRepo.indexOf(pkg.name!) === 0) {
        const dirPath = path.join(cacheDir, scopeDir, dirName)
        const cachePkg = JSON.parse(fs.readFileSync(path.join(dirPath, 'package.json'), 'utf-8'))
        
        const versionMatch = !pkg.version || (pkg.version === cachePkg.version)
        const fullName = (pkg.scope ? pkg.scope + '/' + pkg.name : pkg.name)
        let nameMatch = fullName === cachePkg.name
        if (nameMatch && versionMatch) {
          console.log(`Removing ${cachePkg.name}@${cachePkg.version} (${dirName})`)
          await removeDir(dirPath)
        }
      }
    })

  })
}

execute(argv._)