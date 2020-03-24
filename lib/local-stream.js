import Event from '@lib/event'

import Logger from '@lib/logger'

class LocalStream extends Event {
  constructor (options = {}) {
    super()

    this.streamId = options.streamId || ''
    this.audio = true
    this.video = true
    this.screen = false

    Object.assign(this, options)

    this.stream = null
    this.tracks = null
    this.audioTrack = { type: 'audio', track: null, }
    this.videoTrack = { type: 'video', track: null, }
  }

  async init (resolve, reject) {
    try {
      this.stream = await this._createLocalStream()
      this.tracks = this.stream.getTracks()
      this.audioTrack.track = this.stream.getAudioTracks()[0]
      this.videoTrack.track = this.stream.getVideoTracks()[0]
      this.emit('init_localstream_success', this)
      resolve && resolve(this)
    } catch (err) {
      Logger.error('未能获取到相关权限', err)
      this.emit('init_localstream_fail', this)
      reject && reject(err)
    }
  }

  async _createLocalStream () {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: this.audio,
      video: this.video
    })
    return stream
  }

  static createStream (options = {}) {
    return new LocalStream(options)
  }
}

export default LocalStream
