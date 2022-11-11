
let waveWorker
self.onmessage = function (e) {
    switch (e.data.command) {
        case 'init':
            waveWorker.init(e.data)
            break
        case 'encode':
            // 记录数据
            waveWorker.record(e.data.buffers)
            break
        case 'done':
            waveWorker.exportWAV()
            break
        case 'getBuffer':
            waveWorker.getBuffer()
            break
        case 'close':
            waveWorker.clear()
            break
        default:
            break
    }
}

function WaveWorker(){
    this.recorderBufferLength = 0
    this.recorderBuffers = []
    this.originalSampleRate = undefined
    this.desiredSampleRate = undefined     // 目标采样率
    this.numberOfChannels = undefined      // 采样通道。 1 = 单声道，2 = 立体声。默认为 1。最多支持 2 个通道。
    this.bitsPerSample = null
    this.singleProcessSize = 0
    this.fadeOutTime = false   // true 标识达到渐弱时间
    this.fadeOutRatio = 0.15   // 渐弱比例
    this.fileSizeLimit = false // 是否限制文件大小
}

WaveWorker.prototype.init = function (config){
    console.info('worker init config:', JSON.stringify(config, null, '    '))
    this.originalSampleRate = config.originalSampleRate || 48000
    this.desiredSampleRate = config.desiredSampleRate || 8000
    this.numberOfChannels = config.numberOfChannels || 1
    this.bitsPerSample = config.bitsPerSample || 16
    this.fileSizeLimit = config.fileSizeLimit || false

    this.initBuffers()
}

/**
 * 初始化recorder buffer 数据
 */
WaveWorker.prototype.initBuffers = function (){
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
        this.recorderBuffers[channel] = []
    }
}

/**
 * 停止录制时清除录制数据
 */
WaveWorker.prototype.clear = function (){
    this.recorderBufferLength = 0
    this.recorderBuffers = []
    this.initBuffers()
}

/**
 * 处理onaudioprocess返回的buffer数据
 * @param inputBuffer
 */
WaveWorker.prototype.record = function (inputBuffer){
    for (let channel = 0; channel < this.numberOfChannels; channel++) {
        this.recorderBuffers[channel].push(inputBuffer[channel])
    }
    this.recorderBufferLength += inputBuffer[0].length

    // 计算已转换数据大小
    this.convertedSizeCalculate()
}

/**
 * 动态计算已转换的文件数据是否超出限制
 * GXP16XX上ring.bin尺寸要求不超过 196608 Byte(192KB)
 */
WaveWorker.prototype.convertedSizeCalculate = function (){
    let downSampledBuffer = this.getDownSampledBuffer()
    // 计算转换文件大小
    let fileLimit = 196608
    let fileHeaderOfferSetLength = 64
    let totalFileLength = fileHeaderOfferSetLength + downSampledBuffer.length * 2
    let maxFileLength = fileLimit - fileHeaderOfferSetLength // 可转换的最大文件尺寸
    let remainingSize = maxFileLength - totalFileLength  // 剩余转换尺寸

    if(!this.singleProcessSize){  // onaudioprocess每次触发时的buffer大小
        this.singleProcessSize = downSampledBuffer.length * 2
    }

    if(totalFileLength >= maxFileLength){
        console.warn('File exceeds limit, stop converting!')
        self.postMessage({
            message: 'fileExceedsLimit'
        })
    }else if(remainingSize <= fileLimit * this.fadeOutRatio){  // 文件转换剩余百分之15时，设置音频渐弱
        if(!this.fadeOutTime){
            console.warn('File conversion remaining 15 percent~')
            this.fadeOutTime = true
            self.postMessage({
                message: 'fadeOutTime',
                remainingTimes: remainingSize / this.singleProcessSize,  // record剩余触发次数
            })
        }
    }
}

WaveWorker.prototype.getBuffer = function (){
    let This = this
    let buffers = []
    for (let channel = 0; channel < This.numberOfChannels; channel++) {
        buffers.push(This.mergeBuffers(This.recorderBuffers[channel], This.recorderBufferLength))
    }

    self.postMessage({
        message: 'getBuffer',
        data: buffers
    })
}

/**
 * mergeBuffers将recBuffers数组扁平化
 * @param buffers
 * @param bufferLength
 * @returns {Float32Array}
 */
WaveWorker.prototype.mergeBuffers = function (buffers, bufferLength){
    let result = new Float32Array(bufferLength)
    let offset = 0
    for (let i = 0; i < buffers.length; i++) {
        result.set(buffers[i], offset)
        offset += buffers[i].length
    }
    return result
}

/**
 * interleave将各声道信息数组扁平化
 * @param inputL
 * @param inputR
 * @returns {Float32Array}
 */
WaveWorker.prototype.interleave = function (inputL, inputR) {
    let length = inputL.length + inputR.length
    let result = new Float32Array(length)
    let index = 0
    let inputIndex = 0

    while (index < length) {
        result[index++] = inputL[inputIndex]
        result[index++] = inputR[inputIndex]
        inputIndex++
    }
    return result
}

/**
 * floatTo16bitPCM将音频设备采集的元素范围在[0,1]之间的Float32Array，转换成一个元素是16位有符号整数的Float32Array中
 * @param output
 * @param offset
 * @param input
 */
WaveWorker.prototype.floatTo16BitPCM = function (output, offset, input){
    for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

/**
 * 下采样 缓冲区
 * 重采样的原理上，程序根据重采样和原始采用率的比值，间隔采样音频原数据，丢弃掉其他采样点数据，从而模拟采样率的等比例下降。
 * 注：间隔丢弃原数据在重采样率是原采样率的整数倍分之一时（即1、1/2、1/3…）才不会损失用户音色。
 *      另外，重采样率比原采样率高时，需要在采样点中间额外插值，这里未实现。
 * @param buffer 获取的buffer数据
 * @param desiredSampleRate 采样比例
 * @returns {Float32Array|*}
 */
WaveWorker.prototype.downSampleBuffer = function (buffer, desiredSampleRate){
    if (desiredSampleRate === this.originalSampleRate) {
        return buffer
    }
    if (desiredSampleRate > this.originalSampleRate) {
        throw "down sampling rate show be smaller than original sample rate"
    }
    let sampleRateRatio = this.originalSampleRate / desiredSampleRate
    let newLength = Math.round(buffer.length / sampleRateRatio)
    let result = new Float32Array(newLength);
    let offsetResult = 0
    let offsetBuffer = 0
    while (offsetResult < result.length) {
        let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio)
        let accum = 0, count = 0
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i]
            count++
        }
        result[offsetResult] = accum / count
        offsetResult++
        offsetBuffer = nextOffsetBuffer
    }

    return result
}

/**
 * buffer 处理
 * @returns {*}
 */
WaveWorker.prototype.getDownSampledBuffer = function (){
    let This = this
    let buffers = []
    // 1.将recBuffers数组扁平化
    for (let channel = 0; channel < This.numberOfChannels; channel++) {
        buffers.push(This.mergeBuffers(This.recorderBuffers[channel], This.recorderBufferLength))
    }
    let interleaved
    let downSampledBuffer
    // 2.下采样
    if (This.numberOfChannels === 2) {
        interleaved = This.interleave(buffers[0], buffers[1])
        downSampledBuffer = This.downSampleBuffer(interleaved, This.desiredSampleRate)
    } else {
        interleaved = buffers[0]
        downSampledBuffer = This.downSampleBuffer(interleaved, This.desiredSampleRate)
    }
    return downSampledBuffer
}

WaveWorker.prototype.writeString = function (view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
    }
}

/**
 * 为即将生成的音频文件写入音频头
 * 一般情况下，wav数据实际上就是裸数据pcm外面包了一层文件头。除了其前部增加44个字节的wav头，其他的就是pcm数据
 * @param samples
 * @returns {DataView}
 */
WaveWorker.prototype.encodeWAV = function (samples){
    let fileHeaderOfferSet = 44   // 头文件长度
    /* 自定义文件头长度 */
    fileHeaderOfferSet +=8        // ring.bin, Filed size 8
    fileHeaderOfferSet +=4        // 年, Filed size 4
    fileHeaderOfferSet +=2        // 月, Filed size 2
    fileHeaderOfferSet +=2        // 日, Filed size 2
    fileHeaderOfferSet +=2        // 时, Filed size 2
    fileHeaderOfferSet +=2        // 分, Filed size 2
    /* 自定义文件头长度*/

    let buffer = new ArrayBuffer(fileHeaderOfferSet + samples.length * 2)
    let view = new DataView(buffer)

    // WAV音频文件头信息
    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF')
    /* RIFF chunk length */
    view.setUint32(4, 36 + samples.length * 2, true)
    /* RIFF type */
    this.writeString(view, 8, 'WAVE')
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ')
    /* format chunk length */
    view.setUint32(16, 16, true)
    /* sample format (raw) */
    view.setUint16(20, 1, true)
    /* channel count */
    view.setUint16(22, this.numberOfChannels, true)
    /* sample rate */
    view.setUint32(24, this.desiredSampleRate, true)
    /* byte rate (sample rate * block align) */
    view.setUint32(28, this.desiredSampleRate * 4, true)
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, this.numberOfChannels * 2, true)
    /* bits per sample */
    view.setUint16(34, this.bitsPerSample, true)
    /* data chunk identifier */
    this.writeString(view, 36, 'data')
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true)
    /* 到这里文件头信息填写完成，通常情况下共44个字节*/

    // 添加自定义文件头信息
    let myDate = new Date()
    let year = myDate.getFullYear();
    let month = myDate.getMonth();
    let date = myDate.getDate();
    let hour = myDate.getHours();
    let minutes = myDate.getMinutes();

    this.writeString(view, 44, 'ring.bin')     // ring.bin, Filed size: 8
    view.setUint16(52, year, true)      // 年, Filed size 4
    view.setUint16(56, month, true)     // 月, Filed size 2
    view.setUint16(58, date, true)      // 日, Filed size 2
    view.setUint16(60, hour, true)      // 时, Filed size 2
    view.setUint16(62, minutes, true)   // 分, Filed size 2
    // 添加自定义文件头信息结束

    /* 给wav头增加pcm体 */
    this.floatTo16BitPCM(view, fileHeaderOfferSet, samples)

    return view
}

/**
 * GRP .bin 格式文件
 * @param samples
 * @returns {DataView}
 */
WaveWorker.prototype.encodeGRPBin = function (samples){
    let fileHeaderOfferSet = 512   // 1.bin文件整个头是固定 512 字节的
    let buffer = new ArrayBuffer(fileHeaderOfferSet + samples.length * 2)
    let view = new DataView(buffer)

    /**
     *    .bin文件里都是用的大端模式
     *    filesize 从 0 开始，占4字节； （uint32类型的值：对应的值=文件属性->大小->字节/2）
     *    check_sum 从 4 开始，占2字节； （unit 16类型的值，每两个字节按照unit16相加）
     *    version 从 6 开始，占 4 字节； （默认设置为1）
     *    ring.bin 从 16 开始，占8个字节
     */
    // (1) filesize 从 0 开始，占4字节； （uint32类型的值)
    let file_size = (view.byteLength) / 2   // filesize = byteLength / 2
    // littleEndian 参数：指示 32 位 int 是以小端格式还是大端格式存储。如果为 false 或未定义，则写入大端值。
    view.setUint32(0, file_size, false)

    // (2) check_sum 从 4 开始，占2字节； （unit 16类型的值）默认先写入0
    let check_sum = 0
    view.setUint16(4, check_sum, false)

    // (3) version 从 6 开始，占 4 字节； （版本默认设置为1）
    let version = 1
    view.setUint8(6, version)

    // (4) 年、月、日、时、分 从 10 开始，占 6 字节
    let myDate = new Date()
    view.setUint16(10, myDate.getFullYear(), false)      // 年, 从10开始，占 2 字节
    view.setUint8(12, myDate.getMonth(), false)      // 月, 占 1 字节  （getMonth() 获取当前月份(0-11,0代表1月)）
    view.setUint8(13, myDate.getDate(), false)       // 日, 占 1 字节
    view.setUint8(14, myDate.getHours(), false)      // 时, 占 1 字节
    view.setUint8(15, myDate.getMinutes(), false)    // 分, 占 1 字节

    // (5) ring.bin 从 16 开始，占8个字节 (Uint8类型值)
    this.writeString(view, 16, 'ring.bin')
    // 添加自定义文件头信息结束

    /* 给wav头增加pcm体 */
    this.floatTo16BitPCM(view, fileHeaderOfferSet, samples)

    /**
     * （6）rewrite check_sum value
     * 0x010000 转换为十进制 为 65536
     * 累加值 = view 所有 字节按照 uint16 读取并累加
     * check_sum = 65536 - 累加值
     * */
    for(let offset = 0; offset<view.byteLength; offset+=2){
        check_sum = check_sum + view.getInt16(offset)
    }
    check_sum = 65536 - check_sum
    view.setUint16(4, check_sum, false)

    /**
     * padding 部分好像没有必要处理：
     *  一个字节为8 bit，每个没有值的bit位需要补齐为0。
     *  DataView 的 length 为 512 + samples.length * 2（双字节）。
     */
    return view
}


/**
 * 生成导出数据
 */
WaveWorker.prototype.exportWAV = function (){
    // 1.获取下采样数据
    let downSampledBuffer = this.getDownSampledBuffer()

    // 2.计算文件尺寸是否超出限制
    let fileLimit = 196608
    let fileHeaderOfferSetLength = 512  // 整个头是固定 512 字节的
    let totalFileLength = fileHeaderOfferSetLength + downSampledBuffer.length * 2
    let maxFileLength = fileLimit - fileHeaderOfferSetLength // 除去头文件长度，文件内容不超过192KB-64
    if(totalFileLength > maxFileLength){
        downSampledBuffer = downSampledBuffer.slice(0, maxFileLength/2)
        console.warn('ring.bin尺寸要求不超过 196608 Byte(192KB): ', downSampledBuffer)
    }

    // 3.添加文件头
    let dataView = this.encodeWAV(downSampledBuffer)
    // 处理GRP 生成bin文件
    // let dataView = this.encodeGRPBin(downSampledBuffer)

    self.postMessage({
        message: 'done',
        data: dataView
    })
}

waveWorker = new WaveWorker()
self.postMessage({message: 'ready'})
