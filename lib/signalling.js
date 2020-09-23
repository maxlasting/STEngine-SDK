import io from 'socket.io-client'

import Logger from '@lib/logger'

import Event from '@lib/event'

class Signalling extends Event {
  static create (appId) {
    return new Signalling(appId)
  }

  constructor (appId) {
    super()

    this._dev = process.env.NODE_ENV === 'development'

    // const url = this._dev ? 'http://localhost:3333' : 'wss://www.dabuguowoba.com'
    const url = 'wss://www.dabuguowoba.com'

    this._io = io.connect(url)

    this._ready = false

    this._io.on('connect', () => {
      this._ready = true
      Logger.info('信令服务器连接成功')
      this.emit('connect_signalling_success', this._io)
    })

    this._io.on('connect_error', (err) => {
      this._ready = false
      Logger.err('信令服务器连接失败', err)
      this.emit('connect_signalling_error', err)
    })
  }

  init () {
    const client = this._io

    client.on('joined', (data) => {
      Logger.info('当前用户加入频道成功', data)
      this.emit('joined', data)
    })

    client.on('joinerr', (data) => {
      Logger.error('当前用户加入频道失败', data)
      this.emit('joinerr', data)
    })

    client.on('leaved', (data) => {
      Logger.info('当前用户已离开此频道', data)
      this.emit('leaved', data)
    })

    client.on('hasjoin', (data) => {
      Logger.warn('当前用户已经在此频道', data)
      this.emit('hasjoin', data)
    })

    client.on('kick', (data) => {
      console.log(data)
      Logger.warn('当前用户已被踢出此频道', data)
      this.emit('kick', data)
    })

    client.on('peer-in', (data) => {
      Logger.info('有用户加入当前频道', data)
      this.emit('peer-in', data)
    })

    client.on('peer-out', (data) => {
      Logger.info('有用户离开当前频道', data)
      this.emit('peer-out', data)
    })

    client.on('message', (data) => {
      // data => from  to  peerId  payload
      if (data && data.payload && data.payload.type === 'offer') {
        Logger.info('接收到远端 offer', data)
        this.emit('received_offer', data)
        return
      }

      if (data && data.payload && data.payload.type === 'answer') {
        Logger.info('接收到远端 answer', data)
        this.emit('received_answer', data)
        return
      }

      if (data && data.payload && data.payload.type === 'candidate') {
        Logger.info('接收到远端 candidate', data)
        this.emit('received_candidate', data)
        return
      }
    })

    client.on('peer-publish', (data) => {
      Logger.info('远端开始推流', data)
      this.emit('peer-publish', data)
    })

    client.on('peer-unpublish', (data) => {
      Logger.info('远端停止推流', data)
      this.emit('peer-unpublish', data)
    })
  }

  join (channel, uid) {
    this._io.emit('join', channel, uid)
  }

  leave () {
    this._io.emit('leave')
  }

  send (data) {
    this._io.emit('message', data)
  }

  publish () {
    this._io.emit('publish')
  }

  unpublish () {
    this._io.emit('unpublish')
  }
}

export default Signalling
