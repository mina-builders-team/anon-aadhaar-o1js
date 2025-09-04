import { readFileSync } from 'fs'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const certificateName = process.argv[2]
if (!certificateName) {
  console.error('Please provide certificate path')
  process.exit(1)
}
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const certPath = path.join(__dirname, '../../../', certificateName)
console.log('using certificate: ', certificateName)

const pkData = readFileSync(certPath)
const pk = crypto.createPublicKey(pkData)
const jwk = pk.export({ format: 'jwk' }) as unknown as { n: string }
const pubKey = '0x' + Buffer.from(jwk.n, 'base64url').toString('hex')

console.log(pubKey)

// node build/src/scripts/extractPublicKey.js ./src/assets/uidai_offline_publickey_17022026.cer