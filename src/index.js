#!/usr/bin/env node

import { readFile } from 'fs/promises'
import axios from 'axios'
import CIDRMatcher from 'cidr-matcher'
import cliProgress from 'cli-progress'
import _colors from 'colors'
import open from 'open'
import { argv } from 'process'
import config from './config.js'
import random from './utils/get-random.js'
import { Console } from 'console'

let input = argv[2]
if (!input) {
  console.log('Please provide a file path')
  process.exit()
}

// create new progress bar
const b1 = new cliProgress.SingleBar({
  format: '' + _colors.cyan('{bar}') + '| {percentage}% || {value}/{total} hostnames || Found: {found} || Errors: {errors}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true,
  stopOnComplete: true,
  clearOnComplete: false
})

let errors = []
let all = 0
let processed = 0
let orangeClouded = []

let matcher

let results = {
  orange: [],
  grey: [],
  fail: [],
  exception: []
}

const init = async () => {
  let hostnames = await parseHostnames(input)
  all = hostnames.length
  b1.start(hostnames.length, 0, { found: '0', errors: '0' })
  matcher = await getMatcher('https://www.cloudflare.com/ips-v4')
  let interval = Math.floor(1000 / config.qps)
  for (let i in hostnames) {
    let item = hostnames[i]
    setTimeout(function () {
      doh(item)
    }, i * interval)
  }
}

const parseHostnames = async (path) => {
  let raw = await readFile(path, 'utf8')
  let hostnames = raw.split('\n').map((x) => x.trim())
  return hostnames
}

const doh = async (item, type = 1) => {
  let output = {
    name: item,
    success: false,
    result: {}
  }
  const resolver = () => random(config.resolvers, 1)[0]
  let server = resolver()
  let url = `${server.base}?name=${item}&type=${type}`
  try {
    const res = await axios.get(url, { headers: { accept: 'application/dns-json', 'content-type': 'application/dns-json' } })
    if (res.data.Status > 1) {
      output.message = res.data.Status
    } else {
      let records = []
      if (res.data.Answer && res.data.Answer.length) {
        records = res.data.Answer.filter((x) => x.type === 1).map((x) => x.data)
        let found = false
        for (let record of records) {
          if (!found) {
            let match = matcher.contains(record)
            if (match) {
              orangeClouded.push({
                hostname: item,
                address: record
              })

              found = true
            }
          }
        }
        output.result.records = records
      }
    }
  } catch (err) {
    errors.push(item + ': ' + err.message)
    b1.increment({ errors: errors.length })
    //console.log(server.name)
    output.message = err.message
    results.exception.push(output)
  }
  b1.increment({ found: orangeClouded.length })
  processed++
  if (processed == all) {
    let output = orangeClouded.map((x) => x.hostname).join('\n')
    //console.log(output)
    if (errors.length) console.log('\nErrors:\n' + errors.join('\n') + '\n\n')
    console.log('\nOrange clouded:\n\n' + output + '\n')
    console.log('Total found: ' + orangeClouded.length)
    // console.log('\n\nGenerating JIRA task template ... ')
    // await open('https://tools.ts.cfdata.org/jira/iwol?count=' + orangeClouded.length)
  }
}

const getMatcher = async (url) => {
  let cidrs = []
  try {
    let res = await axios.get(url)
    cidrs = res.data
      .trim()
      .split('\n')
      .map((x) => x.trim())
    return new CIDRMatcher(cidrs)
  } catch (err) {
    console.log(err.message)
    return null
  }
}

init()
