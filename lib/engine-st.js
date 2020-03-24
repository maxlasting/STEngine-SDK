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

    this._connections = new Map()

    this._localStream = null

    this._published = false
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

    signalling.on('joined', (data) => {
      STEngine._joined = true
      const { uid, others } = data
      this._uid = uid
      this._createOtherPeerConnections(others)
      others.forEach((item) => this._peers.add(item))
    })

    signalling.on('leaved', (data) => {
      STEngine._joined = false
      for (let peer of this._peers) {
        this._closePeerConnection(peer)
      }
      this._published = false
      this._peers.clear()
    })

    signalling.on('peer-in',async  (data) => {
      const { peer } = data
      this._peers.add(peer)
      this._createOtherPeerConnections([peer])
      if (this._published) {
        this._createJoinedPeerConnection()
      }
    })

    signalling.on('peer-out', (data) => {
      const { peer } = data
      this._closePeerConnection(peer)
      this._peers.delete(peer)
    })

    signalling.on('peer-publish', (data) => {
      const { peer } = data
      this._createOtherPeerConnections([peer])
    })

    signalling.on('peer-unpublish', (data) => {
      const { peer } = data
      const connectionId = peer + '-' + this._uid
      const { peerconnection } = this._connections.get(connectionId)
      peerconnection.close()
      this._connections.delete(connectionId)
      this.emit('removed-remote-stream', {
        getId: () => peer
      })
    })

    signalling.on('received_offer', async (data) => {
      const { from, to, connectionId, payload } = data
      const { peerconnection } = this._connections.get(connectionId)
      peerconnection.setRemoteDescription(new RTCSessionDescription(payload))

      peerconnection.onicecandidate = (e) => {
        if (e.candidate) {
          this._send({
            from: this._uid,
            to: from,
            connectionId,
            payload: {
              type: 'candidate',
              candidate: e.candidate,
            }
          })
        }
      }

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
      const { peerconnection } = this._connections.get(connectionId)
      peerconnection.setRemoteDescription(payload)
    })

    signalling.on('received_candidate', (data) => {
      const { from, to, connectionId, payload } = data
      const { peerconnection } = this._connections.get(connectionId)
      const candidate = new RTCIceCandidate(payload.candidate)
      peerconnection.addIceCandidate(candidate)
    })
  }

  _createPeerConnection (peerid) {
    const peerconnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'turn:turn.maxlasting.com',
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
    this._localStream = localStream
    this._createJoinedPeerConnection()
    this._published = true
    this._signalling.publish()
  }

  unpublish () {
    if (!this._published) return
    this._localStream.tracks.forEach(track => track.stop())
    for (let peer of this._peers) {
      const connectionId = this._uid + '-' + peer
      const { peerconnection } = this._connections.get(connectionId)
      peerconnection.close()
      this._connections.delete(connectionId)
    }
    this._signalling.unpublish()
    this._published = false
  }

  async _createOtherPeerConnections (peers) {
    for (let peer of peers) {
      const connectionId = peer + '-' + this._uid
      if (this._connections.has(connectionId)) continue
      const peerconnection = this._createPeerConnection(connectionId)
      this._connections.set(connectionId, {
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
          this.emit('added-remote-stream', {
            stream: peerconnection.getRemoteStreams()[0],
            getId: () => peer
          })
        }
      }

      peerconnection.ontrack = (e) => {}
    }
  }

  async _createJoinedPeerConnection () {
    for (let peer of this._peers) {
      const connectionId = this._uid + '-' + peer
      let peerconnection = null
      if (this._connections.has(connectionId) && this._published) continue
      peerconnection = this._createPeerConnection(connectionId)
      const { tracks, stream } = this._localStream
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
      this._connections.set(connectionId, {
        uid: this._uid,
        peer,
        peerconnection,
      })
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

  _closePeerConnection (peer) {
    const id = peer + '-' + this._uid
    if (this._connections.has(id)) {
      console.log(2)
      const target = this._connections.get(id)
      if (target.peerconnection.iceConnectionState == 'connected') {
        this.emit('removed-remote-stream', {
          getId: () => peer
        })
      }
      target.peerconnection.close()
      this._connections.delete(id)
    }
  }
}

export default STEngine
