// drizzle-kit's CLI resolves nested requires via plain Node CJS resolution, which can't
// follow the NodeNext-style ".js" extensions our source uses for ".ts" files. This hook
// falls back to the ".ts" file whenever the literal ".js" path doesn't exist.
const Module = require('module')

const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request.endsWith('.js')) {
    try {
      return originalResolve.call(this, request, ...rest)
    } catch (err) {
      const tsRequest = request.slice(0, -3) + '.ts'
      try {
        return originalResolve.call(this, tsRequest, ...rest)
      } catch {
        throw err
      }
    }
  }
  return originalResolve.call(this, request, ...rest)
}
