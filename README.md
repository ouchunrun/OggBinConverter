## 说明

### 转换格式与限制

.ogg 转换要求：

- Format: Opus
- Channel(s) : 1 channel (单声道)
- Sampling rate : 16000 Hz (16KHz 采样率)
- 编码器：OPUS
- 输出文件后缀为 .ogg

.bin转换要求：(GRP自定义私有音频格式)

- Format : PCM
- Channel(s) : 1 channel  (单声道)
- Sampling rate : 8 000 Hz  (8KHz 采样率)
- Bit depth : 16 bits (位深)
- 编码器 u-Law (G.711u)
- 添加特定文件头，包含 file_size、check_sum、version、time、ring.bin 信息
- 输出文件后缀为 .bin
- 输出文件尺寸不超过192KB（GRP话机限制）
  
### 处理逻辑

> 前端实现录音有两种方式，一种是使用MediaRecorder，另一种是使用WebRTC的getUserMedia结合AudioContext。这里我们使用AudioContext处理。

- 1.添加一个file input用于文件上传，当用户选择文件后会触发onchange事件，在onchange回调里面就可以拿到文件的内容进行处理
- 2.使用一个FileReader读取文件，读取为ArrayBuffer即原始的二进制内容
- 3.拿到ArrayBuffer之后，使用AudioContext的decodeAudioData进行解码，生成一个AudioBuffer实例，把它做为AudioBufferSourceNode对象的buffer属性，
```js
// 解码后的audioBuffer包括音频时长，声道数量和采样率。
fileReader.onload = function () {
    let buffer = this.result
    audioCtx.decodeAudioData(buffer).then(function (decodedData) {
        console.log('upload file duration: ' + decodedData.duration + '(s)')
      // 创建一个新的AudioBufferSourceNode接口, 该接口可以通过AudioBuffer 对象来播放音频数据
      bufferSource = audioCtx.createBufferSource()
      bufferSource.buffer = decodedData
      bufferSource.onended = bufferSourceOnEnded

      // 创建一个媒体流的节点
      let destination = audioCtx.createMediaStreamDestination()
      recordingDuration = Math.min(data.duration, decodedData.duration)  // 文件总时长小于指定的录制时长时，以文件时长为主
      // 更新录制时长
      recorder.setRecordingDuration(recordingDuration)
      bufferSource.connect(destination)
      bufferSource.start()

      // 创建一个新的 createMediaStreamSource 对象，将声音输入这个对像
      mediaStreamSource = audioCtx.createMediaStreamSource(destination.stream)
      // 创建audioContext，开始处理声音数据
      recorder.start(mediaStreamSource, recorderStopHandler)
    }, function (error) {
        console.warn('Error catch: ', error)
      
    })
}
```
- 4.在scriptProcessorNode.onaudioprocess中以固定时间间隔返回处理数据。总数据时长达到设置时长时，停止recorder
- 5.录制结束后，页面生成下载链接和audio在线播放链接
 
### bin 文件转换大小限制与音频渐弱处理说明

1.worker 收到buffer数据后保存并立即对数据进行扁平化和下采样处理
2.当处理后的数据剩余最大尺寸的25%时，通知recorder开始设置音频渐弱
3.当处理后的数据大于限制尺寸时，通知recorder停止转换，生成最终文件。超出尺寸限制的文件转换时长小于页面设置时长。
4.若转换的文件未超出尺寸限制，则根据转换时间设置音频渐弱时间。剩余转换时长小于recordingDuration*0.25时，设置渐弱。

### 调用示例：

```javascript
/**
 * 文件上传
 * @type {HTMLElement}
 */
let fileInput = document.getElementById('fileInput')
fileInput.onchange = function () {
  audioEncoder({
        file: this.files[0],
        duration: 30,
        progressCallback: progressCallback,
        doneCallBack: doneCallBack,
        errorCallBack: errorCallBack,
        monitorGain: parseInt(monitorGain.value, 10),
        recordingGain: parseInt(recordingGain.value, 10),
        numberOfChannels: parseInt(numberOfChannels.value, 10),
        encoderSampleRate: parseInt(encoderSampleRate.value, 10),
        encoderWorkerPath: '/to-ogg-worker/encoderWorker.js',
    })
    fileInput.value = "";  // clear input
};
``` 

### 问题记录

- 1.录制时长不等于指定录制时长问题
  - 原因：通话定时器计算处理时长，start 过后，并不一定会立即进入录音状态，最后的数据时长不一定和定时时间匹配
  - 处理：scriptProcessorNode.onaudioprocess 以固定时间间隔触发，总触发次数不定。需要计算总次数*固定时间才是录制的时长
```
this.scriptProcessorNode.onaudioprocess = (e) => {
  if(!audioprocessDuration){
    audioprocessDuration = e.inputBuffer.duration
    console.log('get onaudioprocess trigger duration: ' + audioprocessDuration)
  }
  audioprocessCount++
  this.encodeBuffers(e.inputBuffer)

  audioprocessTotalDuration = audioprocessCount * audioprocessDuration
  if(audioprocessTotalDuration > This.recordingDuration){
    console.log('process count: ', audioprocessCount)
    console.log('audio process total duration: ', audioprocessTotalDuration)
    if(This.recorderStopHandler){
      This.recorderStopHandler({state: 'stop'})
    }
  }else {
    if(This.recorderStopHandler){
      // 返回当前时长，计算处理进度
      This.recorderStopHandler({state: 'running', totalDuration: audioprocessTotalDuration})
    }
  }
}
```  

## LICENSE

- [opus-recorder](https://github.com/chris-rudmin/opus-recorder/blob/master/LICENSE.md)
- [alawmulaw](https://github.com/rochars/alawmulaw/blob/master/LICENSE)

### 参考

- [opus-recorder](https://github.com/chris-rudmin/opus-recorder)
- [RecorderToText](https://github.com/httggdt/RecorderToText)
- [如何实现前端录音功能](https://zhuanlan.zhihu.com/p/43710364)
- 采样位深、编码处理：
  - @see [https://github.com/rochars/wavefile](https://github.com/rochars/wavefile)
  - @see [https://github.com/rochars/alawmulaw](https://github.com/rochars/alawmulaw)
  - @see [https://github.com/rochars/bitdepth](https://github.com/rochars/bitdepth)
