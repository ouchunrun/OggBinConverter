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

let outputFormatSelect = document.getElementById('outputFormat')
let recordingDurationInput = document.querySelector('div.duration > input[type=range]')
let switchProcess = document.getElementById('progress')
let audioFadeOut = document.getElementById('audioFadeOut')
let durationSelect = document.querySelector('div.duration')
let recorderPlayer = document.getElementById('player')

outputFormatSelect.onchange = function (){
    console.log('set output format:', outputFormatSelect.options[outputFormatSelect.selectedIndex].value)
}

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

function formatFileSize(fileSize){
    if (fileSize < 1024) {
        return fileSize + ' B';
    } else if (fileSize < (1024*1024)) {
        let temp = fileSize / 1024;
        temp = temp.toFixed(2);
        return temp + ' KB';
    } else if (fileSize < (1024*1024*1024)) {
        let temp = fileSize / (1024*1024);
        temp = temp.toFixed(2);
        return temp + ' MB';
    } else {
        let temp = fileSize / (1024*1024*1024);
        temp = temp.toFixed(2);
        return temp + ' GB';
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
        audioFadeOut.disabled = true
        outputFormatSelect.disabled = true

        // 转换
        let duration = recordingDurationInput.value
        consoleLogPrint('start file conversion ==> ' + uploadFile.name)
        console.log('start file conversion: ', uploadFile.name)
        consoleLogPrint('recorder duration ' + duration)
        console.log('audio fade out enabled ', audioFadeOut.checked)
        consoleLogPrint('audio fade out enabled ' + audioFadeOut.checked)
        let outputFormat = outputFormatSelect.options[outputFormatSelect.selectedIndex].value
        console.log('outputFormat:', outputFormat)

        audioEncoder({
            file: uploadFile,
            duration: duration,   // 文件录制时长
            encoderType: outputFormat,
            audioFadeOut: audioFadeOut.checked,

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
                    if(data.fileExceedsLimit){
                        console.log('Due to file size limitations, the conversion time did not reach the recording duration.')
                        consoleLogPrint('Due to file size limitations, the conversion time did not reach the recording duration.')
                    }
                    consoleLogPrint('Recorder complete!')
                }
            },
            /**
             * 转换完成后的处理，mediaRecorder.ondataavailable 返回
             * @param file
             * @param blob
             */
            doneCallBack:function (file, blob){
                // 隐藏duration选择，显示audio播放器
                durationSelect.style.display = 'none'
                recorderPlayer.style.display = 'block'

                tip.style.opacity = '1'
                setTimeout(function (){
                    tip.style.opacity = '0'
                }, 5000)
                consoleLogPrint('recorder ondataavailable received!')

                let dataBlob = new Blob([blob], {type: `audio/${outputFormat}`});
                let url = URL.createObjectURL(dataBlob)
                let audioPlayer = document.querySelector("#player > audio")
                audioPlayer.src = url;

                // 生成下载链接
                console.warn('file size:', formatFileSize(file.size))
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

/**
 * 添加水印效果
 * @param watermarkConfig
 */
function watermark(watermarkConfig) {
    //默认设置
    let defaultSettings = Object.assign({
        watermark_txt: "water mark sample text",
        watermark_x: 20, //水印起始位置x轴坐标
        watermark_y: 20, //水印起始位置Y轴坐标
        watermark_rows: 1, //水印行数
        watermark_cols: 1, //水印列数
        watermark_x_space: 100, //水印x轴间隔
        watermark_y_space: 50, //水印y轴间隔
        watermark_color: '#ddd', //水印字体颜色
        watermark_alpha: 0.4, //水印透明度
        watermark_fontsize: '125px', //水印字体大小
        watermark_font: '微软雅黑', //水印字体
        watermark_width: '100%', //水印宽度
        watermark_height: 350, //水印长度
        watermark_angle: 20, //水印倾斜度数
    }, watermarkConfig)

    let oTemp = document.createDocumentFragment();
    //获取页面最大宽度
    let page_width = Math.max(document.body.scrollWidth, document.body.clientWidth, window.screen.availWidth);
    let cutWidth = page_width * 0.0150;
    page_width = page_width - cutWidth;
    //获取页面最大高度
    let page_height = Math.max(document.body.scrollHeight, document.body.clientHeight) + 450;
    page_height = Math.max(page_height, window.innerHeight - 30);

    //如果将水印列数设置为0，或水印列数设置过大，超过页面最大宽度，则重新计算水印列数和水印x轴间隔
    if (defaultSettings.watermark_cols === 0 || (parseInt(defaultSettings.watermark_x + defaultSettings.watermark_width * defaultSettings.watermark_cols + defaultSettings.watermark_x_space * (defaultSettings.watermark_cols - 1)) > page_width)) {
        defaultSettings.watermark_cols = parseInt((page_width - defaultSettings.watermark_x + defaultSettings.watermark_x_space) / (defaultSettings.watermark_width + defaultSettings.watermark_x_space));
        defaultSettings.watermark_x_space = parseInt((page_width - defaultSettings.watermark_x - defaultSettings.watermark_width * defaultSettings.watermark_cols) / (defaultSettings.watermark_cols - 1));
    }
    //如果将水印行数设置为0，或水印行数设置过大，超过页面最大长度，则重新计算水印行数和水印y轴间隔
    if (defaultSettings.watermark_rows === 0 || (parseInt(defaultSettings.watermark_y + defaultSettings.watermark_height * defaultSettings.watermark_rows + defaultSettings.watermark_y_space * (defaultSettings.watermark_rows - 1)) > page_height)) {
        defaultSettings.watermark_rows = parseInt((defaultSettings.watermark_y_space + page_height - defaultSettings.watermark_y) / (defaultSettings.watermark_height + defaultSettings.watermark_y_space));
        defaultSettings.watermark_y_space = parseInt(((page_height - defaultSettings.watermark_y) - defaultSettings.watermark_height * defaultSettings.watermark_rows) / (defaultSettings.watermark_rows - 1));
    }

    let x;
    let y;
    for (let i = 0; i < defaultSettings.watermark_rows; i++) {  // 水印行数
        y = defaultSettings.watermark_y + (defaultSettings.watermark_y_space + defaultSettings.watermark_height) * i;
        for (let j = 0; j < defaultSettings.watermark_cols; j++) {  // 水印列数
            x = defaultSettings.watermark_x + (defaultSettings.watermark_width + defaultSettings.watermark_x_space) * j;
            let mask_div = document.createElement('div');
            mask_div.id = 'mask_div' + i + j;
            mask_div.className = 'mask_div';
            mask_div.appendChild(document.createTextNode(defaultSettings.watermark_txt));
            //设置水印div倾斜显示
            // mask_div.style.webkitTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
            // mask_div.style.MozTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
            // mask_div.style.msTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
            // mask_div.style.OTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
            // mask_div.style.transform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
            mask_div.style.visibility = "";
            mask_div.style.position = "absolute";
            // mask_div.style.left = x + 'px';
            // mask_div.style.top = y + 'px';
            mask_div.style.overflow = "hidden";
            mask_div.style.zIndex = "-1";
            //让水印不遮挡页面的点击事件
            mask_div.style.pointerEvents = 'none';
            mask_div.style.opacity = defaultSettings.watermark_alpha;
            mask_div.style.fontSize = defaultSettings.watermark_fontsize;
            mask_div.style.fontFamily = defaultSettings.watermark_font;
            mask_div.style.color = defaultSettings.watermark_color;
            mask_div.style.textAlign = "center";
            mask_div.style.width = defaultSettings.watermark_width + 'px';
            mask_div.style.height = defaultSettings.watermark_height + 'px';
            mask_div.style.display = "block";

            // 居中设置
            mask_div.style.top = '0';
            mask_div.style.left = '0';
            mask_div.style.right = '0';
            mask_div.style.bottom = '0';
            mask_div.style.margin = 'auto';
            mask_div.style['line-height'] = defaultSettings.watermark_height + 'px';
            mask_div.style['text-align'] = 'center';
            // mask_div.style['text-shadow'] = 'rgb(255 255 255) 3px 5px 0px, rgb(165 165 165) 4px 6px 3px, rgb(173 173 173) 8px 11px 10px'
            oTemp.appendChild(mask_div);
        }
    }
    // document.body.appendChild(oTemp)
    fileUploadContent.appendChild(oTemp)
}

window.onload = function (){
    // watermark({ watermark_txt: 'Copyright © Grandstream Networks, Inc.' })
    watermark({ watermark_txt: 'Grandstream' })

    fetch('./toOgg/oggOpusEncoderWorker.js').then(response =>
        console.log('Fetch oggOpusEncoderWorker success, ', response)
    ).catch(function (error){
        console.error('Fetch oggOpusEncoderWorker.wasm error, ', error)
    })
}

/************************************************日志打印******************************************************/
function consoleLogPrint(text) {
    if(!text){
        return
    }
    let p = document.createElement('p')
    p.innerText = text
    consoleLog.appendChild(p)
}

