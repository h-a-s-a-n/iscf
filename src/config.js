import pkg from '@peculiar/webcrypto'
const { Crypto } = pkg
const crypto = new Crypto()

const config = {
  qps: 50,
  resolvers: [
    {
      name: 'Cloudflare',
      base: 'https://cloudflare-dns.com/dns-query'
    }
  ]
}
export default config
