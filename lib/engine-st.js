import LocalStream from '@lib/local-stream'
import Event from '@lib/event'
import Signalling from '@lib/signalling'

class STEngine extends Event {
  static _inited = false

  static _joined = false

  static createStream (options) {
    if (!STEngine._inited) throw new Error('未初始化 STEngine')
    if (!STEngine._joined) throw new Error('尚未加入频道')
    return LocalStream.createStream(options)
  }

  static createClient () {
    return new STEngine()
  }

  constructor () {
    super()

    this._signalling = null

    this._uid = null

    this._peers = new Set()

    this._offserConnections = new Map()

    this._answerConnections = new Map()

    this._published = false

    this._localStream = null
  }

  init (appId, resolve, reject) {
    STEngine._inited = true

    const signalling = this._signalling = Signalling.create(appId)

    signalling.on('connect_signalling_success', () => {
      resolve && resolve()
    })

    signalling.on('connect_signalling_error', (err) => {
      reject && reject(err)
    })

    signalling.init()

    this._initSignalling(signalling)
  }

  _createPeerConnection (peerid) {
    const peerconnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'turn:47.94.84.203:3478',
          username: 'fq',
          credential: '123456',
        }
      ],
    })

    peerconnection._id = peerid

    return peerconnection
  }

  join (channel, uid) {
    this._signalling.join(channel, uid)
  }

  leave () {
    if (!STEngine._joined) return

    if (this._published) {
      this.unpublish(this._localStream)
    }

    this._signalling.leave()
  }

  _send (data) {
    this._signalling.send(data)
  }

  publish (localStream) {
    if (this._published || !localStream || !STEngine._joined) return
    this._createJoinedPeerConnection(localStream)
    this._signalling.publish()
    this._localStream = localStream
    this._published = true
    if (this._unpublish) {
      this._signalling.publish()
      this._unpublish = false
    }
  }

  unpublish (localStream) {
    if (!this._published || this._unpublish) return
    const { tracks } = localStream
    tracks.forEach((track) => track.stop())
    for (let item of this._offserConnections.values()) {
      console.log(item)
      const { peerconnection } = item
      peerconnection.close()
    }
    this._offserConnections.clear()
    this._signalling.unpublish()
    this._published = false
    this._unpublish = true
  }

  async _createJoinedPeerConnection (localStream) {
    for (let peer of this._peers) {
      const connectionId = this._uid + '-' + peer
      let peerconnection = null
      // if (this._connections.has(connectionId) && this._published) continue
      if (this._offserConnections.has(connectionId)) {
        const { state } = this._offserConnections.get(connectionId)
        if (state == 'connected') continue
      }
      peerconnection = this._createPeerConnection(connectionId)
      const { tracks, stream } = localStream
      tracks.map(track => peerconnection.addTrack(track, stream))
      peerconnection.onicecandidate = (e) => {
        if (e.candidate) {
          this._send({
            from: this._uid,
            to: peer,
            connectionId,
            payload: {
              type: 'candidate',
              candidate: e.candidate,
            }
          })
        }
      }
      this._offserConnections.set(connectionId, {
        uid: this._uid,
        peer,
        peerconnection,
        localStream,
      })
      peerconnection.onconnectionstatechange = () => {
        if (peerconnection.iceConnectionState == 'checking') {}
        if (peerconnection.iceConnectionState == 'connected') {
          this._offserConnections.get(connectionId).state = 'connected'
        }
      }
      const offer = await peerconnection.createOffer()
      peerconnection.setLocalDescription(offer)
      this._send({
        from: this._uid,
        to: peer,
        connectionId,
        payload: offer,
      })
    }
  }

  async _createOtherPeerConnections (peers) {
    for (let peer of peers) {
      const connectionId = peer + '-' + this._uid
      // if (this._connections.has(connectionId)) continue
      const peerconnection = this._createPeerConnection(connectionId)
      this._answerConnections.set(connectionId, {
        uid: this._uid,
        peer,
        peerconnection,
      })
      peerconnection.onicecandidate = (e) => {
        if (e.candidate) {
          this._send({
            from: this._uid,
            to: peer,
            connectionId,
            payload: {
              type: 'candidate',
              candidate: e.candidate,
            }
          })
        }
      }
      peerconnection.onconnectionstatechange = () => {
        if (peerconnection.iceConnectionState == 'checking') {
          this.emit('checking')
        }
        if (peerconnection.iceConnectionState == 'connected') {
          this._answerConnections.get(connectionId).state = 'connected'
          this.emit('added-remote-stream', {
            stream: peerconnection.getRemoteStreams ? peerconnection.getRemoteStreams()[0] : peerconnection._stream,
            getId: () => peer
          })
        }
      }
      peerconnection.ontrack = (e) => {
        peerconnection._stream = e.streams[0]
      }
    }
  }

  _initSignalling (signalling) {
    signalling.on('joined', (data) => {
      STEngine._joined = true
      const { uid, others } = data
      this._uid = uid
      this._createOtherPeerConnections(others)
      others.forEach((item) => this._peers.add(item))
    })

    signalling.on('leaved', (data) => {
      STEngine._joined = false
      for (let item of this._answerConnections.values()) {
        const { peerconnection, state, peer } = item
        peerconnection.close()
        if (state == 'connected') {
          this.emit('removed-remote-stream', {
            getId: () => peer
          })
        }
      }
      this._peers.clear()
      this._answerConnections.clear()
    })

    signalling.on('peer-in',async  (data) => {
      const { peer } = data
      this._peers.add(peer)
      this._createOtherPeerConnections([peer])
      if (this._published) {
        this._createJoinedPeerConnection(this._localStream)
      }
    })

    signalling.on('peer-out', (data) => {
      const { peer } = data
      const connectionId = peer + '-' + this._uid
      if (this._answerConnections.has(connectionId)) {
        const { peerconnection, state } = this._answerConnections.get(connectionId)
        if (state == 'connected') {
          this.emit('removed-remote-stream', {
            getId: () => peer
          })
        }
        peerconnection.close()
        this._answerConnections.delete(connectionId)
      }
      if (this._published) {
        console.log(this._offserConnections.keys())
        const connectionId = this._uid + '-' + peer
        const { peerconnection } = this._offserConnections.get(connectionId)
        peerconnection.close()
        this._offserConnections.delete(connectionId)
        console.log(this._offserConnections.keys())
      }
      this._peers.delete(peer)
    })

    signalling.on('peer-publish', (data) => {
      const { peer } = data
      this._createOtherPeerConnections([peer])
    })

    signalling.on('peer-unpublish', (data) => {
      const { peer } = data
      const connectionId = peer + '-' + this._uid
      const { peerconnection } = this._answerConnections.get(connectionId)
      peerconnection.close()
      this._answerConnections.delete(connectionId)
      this.emit('removed-remote-stream', {
        getId: () => peer
      })
    })

    signalling.on('received_offer', async (data) => {
      const { from, to, connectionId, payload } = data
      const { peerconnection } = this._answerConnections.get(connectionId)
      peerconnection.setRemoteDescription(new RTCSessionDescription(payload))
      const answer = await peerconnection.createAnswer()
      peerconnection.setLocalDescription(answer)
      this._send({
        from: this._uid,
        to: from,
        connectionId,
        payload: answer
      })
    })

    signalling.on('received_answer', (data) => {
      const { from, to, connectionId, payload } = data
      const { peerconnection } = this._offserConnections.get(connectionId)
      peerconnection.setRemoteDescription(payload)
    })

    signalling.on('received_candidate', (data) => {
      const { from, to, connectionId, payload } = data
      const { peerconnection } = this._answerConnections.get(connectionId) || this._offserConnections.get(connectionId)
      const candidate = new RTCIceCandidate(payload.candidate)
      peerconnection.addIceCandidate(candidate)
    })
  }
}

export default STEngine
