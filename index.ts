import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as rimraf from 'rimraf'

const promisify = <P, R>(fn: (param: P, callback?: (err: any, res: R, ...rest: any[]) => any) => any) =>
  (param: P) => new Promise<R>((resolve, reject) => {
    fn(param, (err, res) => err ? reject(err) : resolve(res))
  })
const execCmd = promisify(exec)

export const getCacheDir = ({ cacheFolder }: { cacheFolder?: string } = {}) =>
  new Promise<string>((resolve, reject) =>
    exec('yarn cache dir' + (cacheFolder ? ` --cache-folder ${cacheFolder}` : ''), (err, stdout) => err
      ? reject(err)
      : resolve(stdout.trim()))
  )

const readJSONFile = <T>(path: string) =>
  new Promise<T>((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        try {
          resolve(JSON.parse(data) as T)
        } catch (e) {
          reject(e)
        }
      }
    })
  })

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

export interface Options {
  silent?: boolean
  /**
   * yarn --cache-folder value
   */
  cacheFolder?: string,  
  /**
   * Particular location of cached modules
   */
  cacheDir?: string
}

type PackageManifest = {
  name: string
  version: string
}

export const removeFromCache = (packages: string[], options: Options = {}) => {
  return new Promise(async (resolve, reject) => {
    let cacheDir = options.cacheDir
      ? path.resolve(process.cwd(), options.cacheDir)
      : await getCacheDir({ cacheFolder: options.cacheFolder })
    if (!cacheDir) {
      !options.silent &&
        console.log('Could not get yarn cache directory location.')
      return
    }
    let dirList = await readDir(cacheDir)
    packages.forEach(async (packageName) => {
      var pkg = parsePackageName(packageName)
      if (!pkg.name) {
        !options.silent &&
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
          let cachePkg: PackageManifest
          try {
            cachePkg = await readJSONFile<PackageManifest>
              (path.join(dirPath, 'package.json'))
          } catch (e) {
            cachePkg = { name: '', version: '' }
          }
          const versionMatch = !pkg.version || (pkg.version === cachePkg.version)
          const fullName = (pkg.scope ? pkg.scope + '/' + pkg.name : pkg.name)
          let nameMatch = fullName === cachePkg.name
          if (nameMatch && versionMatch) {
            !options.silent &&
              console.log(`Removing ${cachePkg.name}@${cachePkg.version} (${dirName})`)
            await removeDir(dirPath)
          }
        }
      })
    })
    resolve()
  })
}