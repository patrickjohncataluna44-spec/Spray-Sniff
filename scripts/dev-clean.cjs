const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const nextDir = path.join(process.cwd(), '.next')

try {
  fs.rmSync(nextDir, { recursive: true, force: true })
  console.log('Cleared .next before starting dev server.')
} catch (error) {
  console.warn('Unable to clear .next before starting dev server.', error)
}

const nextBin = require.resolve('next/dist/bin/next')
const child = spawn(process.execPath, [nextBin, 'dev', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
