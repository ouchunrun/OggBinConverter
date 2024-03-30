/* eslint-disable */
// import {FFT, WindowFunction} from './dsp'

function AudioOnsetDetection(){
    this.THRESHOLD_WINDOW_SIZE = 10
    this.MULTIPLIER = 1.5 // 每个阈值的放大倍数
    this.STEP_SIZE = 1024 // 窗口步长，与sampleSize保持一致
    this.sampleSize = 1024 // 每个窗口的样本数量
    this.sampleRate = 0 // 采样率
    this.audioContext = null
    this.fft = null
    this.fftSize = 1024

    this.spectrum = [] // 当前频谱
    this.lastSpectrum = [] // 最后频谱

    this.spectralFlux = [] // 光谱通量
    this.prunnedSpectralFlux = [] // 修剪过的光谱通量
    this.threshold = [] // 光谱通量平均值
    this.tagsInfo = '' // 振动信息

    this.staringPoint = [] // 光谱通量起始时间段
    this.timePeriodAndAverage = [] // 窗口的平均值的平均值
}

/**
 * 监听事件
 * @type {{onVibrationDataCompleted: null}}
 */
AudioOnsetDetection.prototype.EVENTS = {
    onVibrationDataCompleted: null,
}

AudioOnsetDetection.prototype.init = function (){
    let audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.audioContext = audioContext
    this.sampleRate = audioContext.sampleRate
    // 创建傅里叶变换
    this.fft = new FFT(this.fftSize, this.sampleRate)
}

/**
 * 读取上传文件
 * @param file
 */
AudioOnsetDetection.prototype.readFile = function (file){
    let This = this
    let reader = new FileReader();
    reader.onload = function(event) {
        This.audioContext.decodeAudioData( event.target.result, function(decodedData) {
            This.readSamples(decodedData)
        })
    };
    reader.readAsArrayBuffer(file);
}

/**
 * 根据设置步长，循环读取数据样本
 * @param decodedData decodeAudioData 返回的数据
 */
AudioOnsetDetection.prototype.readSamples = function (decodedData){
    if(!decodedData){
        console.warn('结束')
        // 计算光谱通量平均值
        this.calculateThreshold(this.spectralFlux)
        // 修剪光谱通量
        this.calculateSpectralFlux(this.threshold, this.spectralFlux)

        this.trigger('onVibrationDataCompleted', )
        return
    }

    // 在 PCM 格式的音频数据中，每个样本都是一个数字，表示在每个时间片段内的声音振幅。
    let pcmData = decodedData.getChannelData(0)
    // 创建傅里叶变换
    // this.fft = new FFT(this.fftSize, this.sampleRate)
    // 在计算傅里叶变换之前，将这个汉明窗应用于样本。它基本上是一个平滑函数，让我们的样本看起来更漂亮。通过FFT类启用汉宁窗平滑
    this.applyHannWindow(pcmData)

    // 计算光谱通量
    let currentIndex = 0; // 当前读取位置
    while (currentIndex < pcmData.length) {
        // 计算当前步长
        let currentStep = Math.min(this.STEP_SIZE, pcmData.length - currentIndex);
        // 从 PCM 数据数组中读取当前步长的数据
        let currentChunk = pcmData.subarray(currentIndex, currentIndex + currentStep);
        this.processPCMChunk(currentChunk);
        // 更新当前读取位置
        currentIndex += currentStep;
    }

    // // 计算光谱通量平均值
    // this.calculateThreshold(this.spectralFlux)
    // // 修剪光谱通量
    // this.calculateSpectralFlux(this.threshold, this.spectralFlux)

    // 方案1：以1秒为时间分段，第一个峰值为振动起始点，最后一个峰值为振动结束点
    // this.getVibrationByTimePeriod(this.prunnedSpectralFlux)

    // 方案2：计算峰值的起始点，起始点时间差大于100ms时，即认为是振动事件段
    // this.getVibrationByStartingPoint()

    // 方案3：以1秒时间分段，计算1秒内所有窗口的平均值的平均值，连续高于平均值的，即可认为是振动时间段
    // this.getVibrationByTimePeriodAndAverage()
}

/**
 * 启用汉宁窗（Hamming window）平滑功能，平滑信号并减少频谱泄漏。
 * @param data
 */
AudioOnsetDetection.prototype.applyHannWindow = function (data){
    const window = new WindowFunction(7);
    window.process(data);
}

/**
 * 获取光谱通量
 * @param samples
 */
AudioOnsetDetection.prototype.processPCMChunk = function (samples){
    // 通过调用fft.forward(samples)计算这个样本窗口的傅里叶变换和频谱
    if(samples.length % this.sampleSize !== 0){
        console.warn('原始内容:', samples)
        // TODO: 最后结尾的数据大小可能与定义的 FFT 大小不一致时，进行补零操作
        console.warn('TODO: 最后结尾的数据大小可能与定义的 FFT 大小不一致时，进行补零操作')
        return
    }

    // 将音频数据传递给 FFT 进行频谱分析
    this.fft.forward( samples );
    // 然后将刚刚计算的频谱复制到 spectrum 中。
    this.spectrum = this.fft.spectrum

    // 开始处理数据
    if(this.spectrum.length && this.lastSpectrum.length){
        let flux = 0;
        for( let i = 0; i < this.spectrum.length; i++ ) {
            // 我们从当前的频谱箱中减去上一个频谱箱的值，并将其添加到称为flux的求和变量中。
            let value = this.spectrum[i] - this.lastSpectrum[i]
            // 校正:忽略负谱通量值。 我们对光谱通量的下降不感兴趣，而只对光谱通量的上升感兴趣。
            flux += value < 0? 0: value;
        }
        // 当循环结束，flux 包含... 当前频谱的频谱通量。这个值被添加到spectralFlux ArrayList中。
        this.spectralFlux.push( flux );  // 保存频谱通量
    }
    // 然后将上一个频谱的数据复制到 lastSpectrum 中
    this.lastSpectrum = this.spectrum.slice()
}

/**
 * 计算光谱通量函数的平均值
 * @param spectralFlux
 */
AudioOnsetDetection.prototype.calculateThreshold = function (spectralFlux){
    for( let i = 0; i < spectralFlux.length; i++ ) {
        // 取其前后的阈值THRESHOLD_WINDOW_SIZE谱通量值并计算平均值
        let start = Math.max( 0, i - this.THRESHOLD_WINDOW_SIZE );
        let end = Math.min( spectralFlux.length - 1, i + this.THRESHOLD_WINDOW_SIZE );
        let mean = 0;
        for( let j = start; j <= end; j++ ){
            mean += spectralFlux[j]
        }
        mean /= (end - start);
        // 产生的平均值存储在一个名为threshold中。注意，我们还将每个阈值乘以本例中设置为1.5的乘数
        this.threshold.push( mean * this.MULTIPLIER );
    }

    // console.log('光谱通量平均值this.threshold:', this.threshold)
}

/**
 * 修剪光谱通量
 * @param threshold
 * @param spectralFlux
 */
AudioOnsetDetection.prototype.calculateSpectralFlux = function (threshold, spectralFlux){
    // 把谱通量函数和阈值函数结合起来，处理得到一个只包含大于或等于阈值函数的值
    // 循环处理：在当前光谱通量的prunnedSpectralFlux列表中添加0，使其小于相应的阈值函数值，
    // 或者我们添加spectrul flux值减去位置i处的阈值，得到的prunned spectrum flux
    let prunnedSpectralFlux = []
    for( let i = 0; i < threshold.length; i++ ) {
        if( threshold[i] <= spectralFlux[i] ){
            let diff = spectralFlux[i] - threshold[i]
            prunnedSpectralFlux.push(diff)
        } else {
            prunnedSpectralFlux.push(0)
        }
    }
    this.prunnedSpectralFlux = prunnedSpectralFlux
}

/***********************************************************************************************************/
/********************************************计算振动时间段***************************************************/
/***********************************************************************************************************/

/**
 * 方案1：
 * 以1秒为时间分段，第一个峰值为振动起始点，最后一个峰值为振动结束点
 * @param dataLists
 */
AudioOnsetDetection.prototype.getVibrationByTimePeriod = function (dataLists){
    let tags = "VIBRATION="
    // 每次处理的数据量
    let chunkSize = parseInt(this.sampleRate / this.sampleSize)
    // 开始索引
    let startIndex = 0;
    // 结束索引
    let endIndex = Math.min(startIndex + chunkSize, dataLists.length);
    let perWinTime = 1 / (this.sampleRate / this.sampleSize)  // 一个窗口数的时间(秒) = 1 秒 / 1秒内的窗口数
    console.log('perWinTime:', perWinTime)

    // 循环处理数组直到结束
    while (startIndex < dataLists.length) {
        // 获取当前片段的数据
        let chunks = dataLists.slice(startIndex, endIndex)
        console.warn('chunks:', chunks)
        console.log(`startIndex ${startIndex}, endIndex ${endIndex}`)
        // 处理当前片段的数据
        let startTime
        let endTime
        for (let i = 0; i < chunks.length; i++) {
            let chunk = chunks[i]
            if (chunk) {
                if (!startTime) {
                    startTime = ((startIndex + i) * perWinTime)
                    console.log(`startTime chunk index ${i}, chunk is `, chunk, ' , startTime:', startTime)
                } else {
                    endTime = ((startIndex + i) * perWinTime)
                    console.log(`endTime chunk index ${i}, chunk is `, chunk, ', endTime ', endTime)
                }
            }
        }

        if (startTime && endTime) {
            // 以秒为单位，保留两位小数
            startTime = Number(startTime.toFixed(2))
            endTime = Number(endTime.toFixed(2))
            let timeInterval = endTime - startTime
            if(timeInterval <= 0.1){
                console.warn(`startTime ${startTime}, endTime ${endTime}, 振动时间低于100ms时，增加100ms的振动`)
                endTime += 0.1 // 振动时间低于100ms时，可能没有效果。
                console.warn('修改后的endTime: ', endTime)
                timeInterval = endTime - startTime
            }

            tags += startTime.toFixed(2) + '-' + endTime.toFixed(2) + ';'
            console.warn('振动tag:', startTime + '-' + endTime, ', 时间间隔为: ', ( timeInterval * 1000 ).toFixed(2) , ' 毫秒')
        }
        // 更新索引
        startIndex = endIndex
        endIndex = Math.min(startIndex + chunkSize, dataLists.length);
    }


    let tagsInfo = '["' + tags + '"]'
    tagsInfo = encodeURIComponent(tagsInfo)
    this.tagsInfo = tagsInfo

    console.log('onset detection get tags info:', tags)
    console.log('encodeURIComponent tags info:', tagsInfo)
    this.trigger('onVibrationDataCompleted', tagsInfo)
}

/**
 * 查找峰值的起始时间
 * startIndex: 峰值开始上升的点
 * endIndex: 峰值开始下降的点
 * 处理：峰值过程中覆盖到的其他峰值，不再做处理
 * @param targetIndex
 * @returns {{startIndex: string, endIndex: string}}
 */
AudioOnsetDetection.prototype.findStartingPointOfThePeak = function (targetIndex){
    let indexValue = {
        startIndex: '',
        endIndex: ''
    }

    for(let i = targetIndex; i > 0; i--){
        if(this.threshold[i] < this.threshold[i-1]){
            indexValue.startIndex = i
            // console.log(`start index ${i}, value is ${this.threshold[i]}` )
            break
        }
    }
    for(let i = targetIndex; i < this.threshold.length; i++){
        if(this.threshold[i] > this.threshold[i+1]){
            indexValue.endIndex = i
            // console.log(`end index ${i}, value is ${this.threshold[i]}` )
            break
        }
    }

    if(indexValue.startIndex !== indexValue.endIndex){
        let exist = false
        for(let k = 0; k<this.staringPoint.length; k++){
            if(this.staringPoint[k].startIndex === indexValue.startIndex){
                console.log('repeat value!!!')
                exist = true
                break
            }
        }

        if(!exist){
            this.staringPoint.push(indexValue)
        }
    }
}

/**
 * 方案2：
 * 计算峰值的起始点，起始点时间差大于100ms时，即认为是振动事件段
 * 测试效果：并不理想
 */
AudioOnsetDetection.prototype.getVibrationByStartingPoint = function (){
    // 查找峰值起始点
    for( let i = 0; i < this.prunnedSpectralFlux.length - 1; i++ ) {
        if(this.prunnedSpectralFlux[i]){
            this.findStartingPointOfThePeak(i, this.prunnedSpectralFlux[i])
        }
    }

    let perWinTime = this.sampleSize / this.sampleRate  // 一个窗口数的时间(秒)
    console.warn(`一个窗口的时间为 ${perWinTime} (ms)`)
    let timeList = []
    let cash = {}

    let tags = "VIBRATION="
    let times = this.staringPoint
    for(let i = 0; i<times.length; i++){
        let startTime = Number(times[i].startIndex * perWinTime)
        let endTime = Number(times[i].endIndex * perWinTime)
        let diff = endTime - startTime
        if(!cash.startTime){
            cash.startTime = startTime.toFixed(2) // 单位为秒
        }

        if(diff * 1000 > 100){  // 间隔大于100ms
            cash.endTime = endTime.toFixed(2) // 单位为秒
        }else {
            // 时间点小于100ms时，合并振动
        }

        if(cash.startTime && cash.endTime){
            cash.diff = diff
            timeList.push(cash)
            tags += cash.startTime + '-' + cash.endTime + ';'
            cash = {}
        }
    }
    console.warn('节拍点：可能的振动时间点1111111：', timeList)

    let tagsInfo = '["' + tags + '"]'
    console.warn('振动时间点:', tagsInfo)
    tagsInfo = encodeURIComponent(tagsInfo)
    this.tagsInfo = tagsInfo
    this.trigger('onVibrationDataCompleted', tagsInfo)
}

/**
 * 方案3：
 * 以1秒时间分段，计算1秒内所有窗口的平均值的平均值，连续高于平均值的频谱通量，即可认为是振动时间段
 */
AudioOnsetDetection.prototype.getVibrationByTimePeriodAndAverage = function (){
    let This = this
    let stepSize = parseInt(this.sampleRate / this.sampleSize) // 1秒内的窗口数

    let processData = function (datas){
        // console.log('processData：', datas)
        let mean = 0;
        for( let j = 0; j < datas.length; j++ ){
            mean += datas[j]
        }
        mean /= datas.length
        return mean
    }

    let currentIndex = 0;
    while (currentIndex < This.threshold.length){
        let currentStep = Math.min(stepSize, This.threshold.length - currentIndex);
        let currentChunk = This.threshold.slice(currentIndex, currentIndex + currentStep);
        let average = processData(currentChunk)
        // console.log('get average:', average)

        // let testList = []
        for( let i = currentIndex; i < currentIndex + currentStep; i++ ) {
            if(this.spectralFlux[i] >= average){
                this.timePeriodAndAverage.push(this.spectralFlux[i])
                // testList.push(this.spectralFlux[i])
            }else {
                this.timePeriodAndAverage.push(0)
                // testList.push(0)
            }
        }
        // console.log('1秒内：', testList)
        currentIndex += currentStep
    }

    console.log('this.timePeriodAndAverage:', this.timePeriodAndAverage)

    // 计算tags范围
    let cache = {}
    let tags = ''
    let audioprocessDuration = this.sampleSize / this.sampleRate
    for(let i = 0; i<this.timePeriodAndAverage.length; i++){
        let buffer = this.timePeriodAndAverage[i]
        if(buffer){
            if(!cache.t1){
                cache.t1 = audioprocessDuration * (i)  // 每次触发的间隔时间为audioprocessDuration，所以处理索引即可
            }
        }else {
            if(cache.t1){
                cache.t2 = audioprocessDuration * i  // 结束时间为上次非0的时间点
                if(cache.t2 !== cache.t1){
                    let diff = Number(cache.t2) - Number(cache.t1)
                    diff = (diff * 1000).toFixed(2)
                    console.log('时间间隔为:', diff)
                    // if(Number(diff) > 100){
                        if(!tags){
                            tags = tags + "VIBRATION="
                        }
                        tags = tags + cache.t1.toFixed(2) + '-' + cache.t2.toFixed(2) + ';' // 时间以秒为单位，保留两位小数
                    // }else {
                    //     // console.warn('时间间隔小于100ms，不纳入计算。', diff)
                    // }
                }else {
                    // 只有开始时间时，不添加
                }
                cache = {}
            }
        }
    }

    if(tags){
        console.warn('方案3：可能的振动时间点:', tags)
        let tagsInfo = '["' + tags + '"]'
        console.log('get tags info as:', tagsInfo)
        this.vibrationTag = encodeURIComponent(tagsInfo)
        console.log('encodeURIComponent tags info: ', this.vibrationTag)

        this.trigger('onVibrationDataCompleted', tagsInfo)
    }else {
        console.warn('No vibration data obtained!!')
    }

}

/**
 * Function that subscribes a listener to an event.
 * @method on
 * @param {String} eventName The event.
 * @param {Function} callback The listener.
 */
AudioOnsetDetection.prototype.on = function (eventName, callback) {
    if (typeof callback === 'function') {
        this.EVENTS[eventName] = []
        this.EVENTS[eventName].push(callback)
    } else {
        throw new Error('Provided parameter is not a function')
    }
}

/**
 * Function that unsubscribes listeners from an event.
 * @method off
 * @param {String} [eventName] The event.
 * - When not provided, all listeners to all events will be unsubscribed.
 * @param {Function} [callback] The listener to unsubscribe.
 * - When not provided, all listeners associated to the event will be unsubscribed.
 */
AudioOnsetDetection.prototype.off = function (eventName, callback) {
    if (!(eventName && typeof eventName === 'string')) {
        this.EVENTS = {}
    } else {
        if (callback === undefined) {
            this.EVENTS[eventName] = []
            return
        }
        let arr = this.EVENTS[eventName] || []

        // unsubscribe events that is triggered always
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === callback) {
                arr.splice(i, 1)
                break
            }
        }
    }
}

/**
 * Function that triggers an event.
 * The rest of the parameters after the <code>eventName</code> parameter is considered as the event parameter payloads.
 * @method trigger
 */
AudioOnsetDetection.prototype.trigger = function (eventName) {
    // convert the arguments into an array
    let args = Array.prototype.slice.call(arguments)
    let arr = this.EVENTS[eventName]
    args.shift() // Omit the first argument since it's the event name
    if (arr) {
        // for events subscribed forever
        for (let i = 0; i < arr.length; i++) {
            try {
                if (arr[i].apply(this, args) === false) {
                    break
                }
                // 监听事件调用后不删除
                // this.EVENTS[eventName].shift()
            } catch (error) {
                throw error
            }
        }
    }
}

// export default AudioOnsetDetection
if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = {
        AudioOnsetDetection: AudioOnsetDetection,
    };
}
