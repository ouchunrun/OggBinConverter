function createRecorder(e){let r;e.encoderType=e.encoderType||"ogg";let o={encoderType:e.encoderType,desiredSampleRate:"ogg"===e.encoderType?16e3:8e3,workerPath:"ogg"===e.encoderType?"./toOgg/oggOpusEncoderWorker.js":"./toBin/encoderWorker.js",originalSampleRateOverride:e.desiredSampleRate};r=new Recorder(o,e);let n=e.file.name.replace(/\.[^\.]+$/,"");return["ring1","ring2","ring3","ring4","ring5","ring6","doorbell","silent"].includes(n)&&(n="cust_"+n),r.fileName=n,r.onstart=function(e){console.log("mediaRecorder is started")},r.onstop=function(e){console.log("mediaRecorder is stopped")},r.onpause=function(e){console.log("mediaRecorder is paused")},r.onresume=function(e){console.log("mediaRecorder is resuming")},r.ondataavailable=function(o){console.log("Data ondataavailable received");let n=new File([o],`${r.fileName}.${e.encoderType}`);r.recoderOptions.doneCallBack(n,o)},r}window.audioEncoder=function(e){let r=Recorder.getBrowserDetails();if(console.log("browserDetails : ",r),"ie"===r.browser||"edge"===r.browser||"safari"===r.browser||"chrome"===r.browser&&r.version<58||"opera"===r.browser&&r.chromeVersion<58||"firefox"===r.browser&&r.version<52)return void e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1007);if(!Recorder.isRecordingSupported())return console.error("AudioContext or WebAssembly is not supported"),void(e&&e.errorCallBack&&(window.AudioContext?window.WebAssembly||e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1003):e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1002)));if(!e||!e.file||!e.doneCallBack)return console.warn(e),void e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1001);let o=e.file;if(console.log("current upload file type "+o.type),!/audio\/\w+/.test(o.type))return void e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1006);let n,t,a=createRecorder(e),c=new AudioContext,i=new FileReader,l=c.createMediaStreamDestination(),d=c.createMediaStreamSource(l.stream);function s(){"recording"!==a.state&&"inactive"===a.state||(console.log("buffer source onEnded!"),a.stop(),n&&n.stop(),n=null,e.progressCallback({state:"done",percent:1}))}try{i.onload=function(){c.decodeAudioData(this.result).then((function(r){r.duration<3?e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1005):(console.log("upload file duration: "+r.duration+"(s)"),function(r){let o=c.createBufferSource();o.buffer=r,o.onended=s,o.connect(l),o.start(),t=Math.min(e.duration,r.duration),a.setRecordingDuration(t),a.start()}(r))}),(function(r){console.error("Error catch: ",r),e.errorCallBack&&e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1009(r))}))},a.init(d,(function(r){try{let o=r.totalDuration;"stop"===r.state?(console.log("recorder.stop"),e.progressCallback({state:"done",percent:1,fileExceedsLimit:r.fileExceedsLimit}),a.stop(),n&&n.stop(),n=null):e.progressCallback({state:"recording",percent:o/t})}catch(r){e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1009(r))}}),(function(){i.readAsArrayBuffer(o)}))}catch(r){e.errorCallBack(Recorder.ERROR_MESSAGE.ERROR_CODE_1009(r))}};