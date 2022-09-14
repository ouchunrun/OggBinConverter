let tip = document.getElementsByClassName('tip')[0]
let fileUploadContent = document.getElementById('fileUploadContent')
let fileConversion = document.getElementById('fileConversion')
let fileIcon = document.getElementsByClassName('fileIcon')[0]
let fileName = document.getElementsByClassName('fileName')[0]
let consoleArea = document.getElementsByClassName('console')[0]
let consoleLog = document.getElementById('consoleLog')

let uploadFile
let uploadFileInput = document.getElementById('uploadFile')
let selectButton = document.getElementById('selectButton')
let fileWitchButton = document.getElementById('fileWitch')

let recordingDurationInput = document.querySelector('div.duration > input[type=range]')
let switchProcess = document.getElementById('progress')
let durationSelect = document.querySelector('div.duration')
let recorderPlayer = document.getElementById('player')

selectButton.onclick = function (){
    console.log('Trigger the real file upload button')
    uploadFileInput.click()
}
uploadFileInput.onchange = function (){
    fileOnChange(this.files[0])
}

/**
 * duration
 * @param e
 */
recordingDurationInput.onchange = function (e){
    let durationShow = document.getElementsByClassName('durationShow')[0]
    durationShow.textContent = parseInt(e.target.value)
}

/**
 * 上传的文件发生改变
 */
function fileOnChange(file){
    if(file){
        console.log('upload file: ', file.name)
        consoleLogPrint('upload file: ' + file.name)
        uploadFile = file

        // 显示上传的文件名和文件duration设置
        fileIcon.style.display = 'none'
        fileUploadContent.style.padding = '0'
        fileConversion.style.display = 'block'
        fileName.innerText = file.name
        consoleArea.style.display = 'block'
    }else {
        alert('file not found!')
    }
}

/**
 * 文件转换
 */
fileWitchButton.onclick = function (){
    if(fileWitchButton.classList.contains('fileDownload')){
        // 下载
        let fileDownloadLink = document.getElementById('fileDownloadLink')
        fileDownloadLink.click()
    }else {
        // 隐藏文件上传区域
        fileUploadContent.style.display = 'none'
        fileWitchButton.style.opacity = '0.6'
        fileWitchButton.disabled = true
        recordingDurationInput.disabled = true

        // 转换
        let duration = recordingDurationInput.value
        consoleLogPrint('Recorder duration has been set to ' + duration)
        console.log('Start file conversion: ', uploadFile.name)

        encoderOgg({
            file: uploadFile,
            duration: duration,   // 文件录制时长
            monitorGain: 0,
            recordingGain: 1,
            numberOfChannels: 1,
            encoderSampleRate: 16000,
            encoderWorkerPath: './to-ogg-worker/encoderWorker.js',

            /**
             * 进度处理
             * @param data
             */
            progressCallback: function (data){
                if(data.state === 'recording'){
                    switchProcess.style.width = Math.round(data.percent * 100) + '%'
                }else if(data.state === 'done'){
                    switchProcess.style.width = '100%'
                    console.log('recorder complete!')
                    consoleLogPrint('Recorder complete!')

                    tip.style.opacity = '1'
                    setTimeout(function (){
                        tip.style.opacity = '0'
                    }, 5000)
                }
            },
            /**
             * 转换完成后的处理
             * @param file
             * @param blob
             */
            doneCallBack:function (file, blob){
                // 隐藏duration选择，显示audio播放器
                durationSelect.style.display = 'none'
                recorderPlayer.style.display = 'block'

                let dataBlob = new Blob([blob], {type: 'audio/ogg'});
                let url = URL.createObjectURL(dataBlob)
                let audioPlayer = document.querySelector("#player > audio")
                audioPlayer.src = url;

                // 生成下载链接
                let downLoadLink = document.createElement('a')
                downLoadLink.id = 'fileDownloadLink'
                downLoadLink.href = url;
                downLoadLink.download = file.name;
                downLoadLink.style.display = 'none'
                downLoadLink.innerHTML = '<br>' + '[' + new Date().toLocaleString() + '] '+ file.name
                recorderPlayer.appendChild(downLoadLink)
                consoleLogPrint('download link generated!')

                fileWitchButton.classList.add('fileDownload')
                fileWitchButton.innerText = 'Download'
                fileWitchButton.style.opacity = '1'
                fileWitchButton.disabled = false
            },
            /**
             * 错误处理
             * @param error
             */
            errorCallBack: function (error){
                console.error(error.message)
                consoleLogPrint('【Error】' + error.message)
            }
        })
    }
}

/************************************************文件拖拽上传******************************************************/
fileUploadContent.addEventListener("drop",function(e){
    this.style.borderColor = '#288ef6';
    console.warn('dataTransfer file: ', e.dataTransfer.files[0])
    fileOnChange(e.dataTransfer.files[0])
})

/**
 * 文件拖来拖去并进入区域时，设置边框颜色
 * @param event
 */
fileUploadContent.ondragover = function (event) {
    event.preventDefault();
    // for firefox
    event.stopPropagation();
    this.style.borderColor = '#00bcd4';
}

/**
 * 文件拖离时恢复边框颜色
 */
fileUploadContent.ondragleave = function () {
    this.style.borderColor = '#288ef6';
}
document.addEventListener("drop",function(e){ // 拖离
    e.preventDefault();
})
document.addEventListener("dragleave",function(e){ // 拖后放
    e.preventDefault();
})
document.addEventListener("dragenter",function(e){ // 拖进
    e.preventDefault();
})
document.addEventListener("dragover",function(e){ // 拖来拖去
    e.preventDefault();
})

/************************************************日志打印******************************************************/
function consoleLogPrint(text) {
    if(!text){
        return
    }
    let p = document.createElement('p')
    p.innerText = text
    consoleLog.appendChild(p)
}
