// Runs once when the Next.js server process starts.
// Overwrites logs/app.log so each dev session starts with a clean slate.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const fs   = await import('fs')
    const path = await import('path')

    const logsDir = path.join(process.cwd(), 'logs')
    const logFile = path.join(logsDir,       'app.log')

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true })
    }

    const sep    = '═'.repeat(60)
    const header = [
      sep,
      `  JARVIS — Session started`,
      `  ${new Date().toISOString()}`,
      sep,
      '',
    ].join('\n')

    fs.writeFileSync(logFile, header, 'utf8')
    console.log(`[logger] Log file reset → ${logFile}`)
  }
}
