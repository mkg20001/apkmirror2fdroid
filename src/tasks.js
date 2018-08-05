'use strict'

const Queue = require('bull')

const downloadQueue = new Queue('downloading')
const checkQueue = new Queue('update checks')

checkQueue.process((job, done) => {
  console.log(job)
})

downloadQueue.process((job, done) => {

})

module.exports = {
  downloadQueue,
  checkQueue
}
