import pkg from '@peculiar/webcrypto'
const { Crypto } = pkg
const crypto = new Crypto()

const random = (arr, count) => {
  let random = crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
  let result = []
  Array.from({ length: count }, () => {
    arr = arr.filter((item) => !result.includes(item))
    result.push(arr[(random * arr.length) | 0])
  })
  return result
}
export default random
