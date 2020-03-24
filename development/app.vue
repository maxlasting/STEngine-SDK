<template>
  <div class="app-box">
    <p>请打开控制台查看操作反馈，这里懒得写了</p>
    <p>当前状态：{{ msg }}</p>
    <div>
      <p>1 点击初始化</p>
      <button @click="init">初始化</button>
    </div>
    <div>
      <p>2 加入或创建频道</p>
      <input type="text" v-model="channel">
      <button @click="join">加入</button>
    </div>
    <div>
      <p>3 获取本地流并推送</p>
      <button @click="publish">推流</button>
    </div>
    <div>
      <p>4 其他操作</p>
      <button @click="unpublish">停止推流</button>
      <button @click="leave">离开</button>
    </div>
    <div>
      <p>这个是自己本地的流</p>
      <video ref="own" autoplay controls width="240"></video>
    </div>
    <p>这下面开始是其他人</p>
    <div class="videos" ref="videos"></div>
  </div>
</template>

<script>
import STEngine from 'STEngine'

// console.log(STEngine)

const uid = Math.floor(Math.random() * 100000000) + 1

export default {
  data () {
    return {
      client: null,
      channel: '123456',
      uid,
      localStream: null,
      msg: '未初始化',
    }
  },

  mounted () {
  },
  methods: {
    init () {
      if (this.client) return

      this.client = STEngine.createClient()

      this.client.on('added-remote-stream', (e) => {
        const stream = e.stream

        const peerId = e.getId()

        const video = document.createElement('video')

        video.id = 'video' + peerId

        video.width = 320
        video.height = 240

        video.srcObject = stream

        video.controls = true

        this.$refs.videos.appendChild(video)

        video.play()
      })

      this.client.on('removed-remote-stream', (e) => {
        const peerId = e.getId()
        const target = document.getElementById('video' + peerId)
        this.$refs.videos.removeChild(target)
      })

      this.client.init()

      this.msg = '初始化完成'
    },

    join () {
      if (!this.client) return console.log('尚未初始化')
      this.client.join(this.channel, this.uid)
      this.msg = '加入房间'
    },

    leave () {
      if (!this.client) return console.log('尚未初始化')
      this.client.leave()
      this.msg = '离开房间'
    },

    async publish () {
      if (!this.client) return console.log('尚未初始化')
      const localStream = this.localStream =  STEngine.createStream({
        video: true,
        audio: false
      })

      await localStream.init()

      this.$refs.own.srcObject = localStream.stream

      this.client.publish(localStream)
      this.msg = '开始推流'
    },

    unpublish () {
      if (!this.client) return console.log('尚未初始化')
      this.client.unpublish(this.localStream)
      this.msg = '停止推流'
    }
  }
}
</script>

<style lang="scss">
.videos {
  margin-top: 20px; display: flex;
  video {
    margin: 10px;
  }
}
</style>
