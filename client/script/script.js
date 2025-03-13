//工学院大学 所有 このプログラムおよびHTMLは著作権により保護されています。不正に悪用、転用する行為はおやめください。
//生体情報処理研究室　2024 鈴木
import vision from "../tasks-vision@0.10.3.js";
const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;
const demosSection = document.getElementById("demos");
const videoBlendShapes = document.getElementById("video-blend-shapes");
let faceLandmarker;
let runningMode = "IMAGE";
let enableWebcamButton;
let webcamRunning = false;
const videoWidth = 480;
let outputBlendshapeGraph = false;
let outputBlendShapeValues = true;
var blendShapesValue = [];
let AxisData = [];

var graphFrame = 60;
var graphLength = 4000;
var graphRefresh = 16;
var graphDelay = 16;

var chart;


let lowEnergyMode = false
// Before we can use Hand Landmarker class we must wait for it to finish
// loading. Machine Learning models can be large and take a moment to
// get everything needed to run.

//スマートフォンか判定
function isSmartPhone() {
    if (navigator.userAgent.match(/iPhone|Android.+Mobile/)) {
        return true;
    } else {
        return false;
    }
}

//FaceMeshのTaskの読み込み
async function createFaceLandmarker() {
    const filesetResolver = await FilesetResolver.forVisionTasks("tasks-vision");
    faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
            modelAssetPath: `face_landmarker.task`,
            delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode,
        numFaces: 1
    });
    //demosSection.classList.remove("invisible");
}
//taskファイルの読み込みを実施
createFaceLandmarker();
//対象のelementを取得
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
//canvasのcontextの2Dを指定
const canvasCtx = canvasElement.getContext("2d");
// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
// If webcam supported, add event listener to button for when user
// wants to activate it.
if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", (event)=>{

        try{
            $("#cameraSelector").val(cameraDeviceIds[0].deviceId)
        }catch(e){
            console.error(e)
        }
        enableCam(event);
    });
}
else {
    console.warn("getUserMedia() is not supported by your browser");

}
// Enable the live webcam view and start detection.
function enableCam(event) {
    if (!faceLandmarker) {
        console.log("Wait! faceLandmarker not loaded yet.");
        notice("読み込み中","mediapipeがまだ読み込み中です。",false)
        return;
    }
    GetCameraID();
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: {
            deviceId:$('option:selected').val()
        }
        //video: $('option:selected').val()
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
        GetCameraID();
        $("#cameraSelector").val(cameraDeviceIds[0].deviceId)
        $("#webcamButton").hide();

        //console.log("console:" + $('option:selected').val());
    }).catch((e)=>{
        if(e.name === "NotAllowedError"){

            notice("権限がありません。","カメラの権限が拒否されています。設定から許可してください。",true)
        }else{

            notice("利用できません。","カメラにアクセスできませんでした。",true)
            notice(e.title,e.message,true)
        }
        console.log(e)
        webcamRunning = false;
        enableWebcamButton.innerText = "カメラを開始";
    });
}


function switchCam(b){
    if (!faceLandmarker) {
        console.log("Wait! faceLandmarker not loaded yet.");
        notice("読み込み中","mediapipeがまだ読み込み中です。",false)
        return;
    }
    if (b === true) {
        webcamRunning = true;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
    }
    else {
        webcamRunning = false;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
    }
    // getUsermedia parameters.
    const constraints = {
        video: {
            deviceId:$('option:selected').val()
        }
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);

        //console.log("console:" + $('option:selected').val());
    }).catch((e)=>{
        if(e.name === "NotAllowedError"){

            notice("権限がありません。","カメラの権限が拒否されています。設定から許可してください。",true)
        }else{

            notice("利用できません。","カメラにアクセスできませんでした。",true)
            notice(e.title,e.message,true)
        }
        console.log(e)
        webcamRunning = false;
        enableWebcamButton.innerText = "カメラを開始";
    });
}
let lastVideoTime = -1;
let results = undefined;
const drawingUtils = new DrawingUtils(canvasCtx);
async function predictWebcam() {
    const radio = video.videoHeight / video.videoWidth;
    video.style.width = videoWidth + "px";
    video.style.height = videoWidth * radio + "px";
    canvasElement.style.width = videoWidth + "px";
    canvasElement.style.height = videoWidth * radio + "px";
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;
    // Now let's start detecting the stream.
    if (runningMode === "IMAGE") {
        runningMode = "VIDEO";
        await faceLandmarker.setOptions({ runningMode: runningMode });
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, startTimeMs);
    }
    if (results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, { color: "#FF3030" });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, { color: "#30FF30" });
        }
    }
    drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
    // Call this function again to keep predicting when the browser is ready.
    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
        return;
    }
    if(outputBlendshapeGraph) {
        //console.log(blendShapes[0]);
        let htmlMaker = "";
        var i = 0;
        blendShapes[0].categories.map((shape) => {
            htmlMaker += `
      <li class="blend-shapes-item">
        <span class="blend-shapes-label">${shape.displayName || shape.categoryName}[${i}]</span>
        <span class="blend-shapes-value" style="width: calc(${+shape.score * 100}% - 120px)">${(+shape.score).toFixed(4)}</span>
      </li>
    `;
            i++;
        });

        el.innerHTML = htmlMaker;
    }
    //グラフにBlendShapeの分だけDatasetを生成
        if(AxisData.length <= 0){
            blendShapes[0].categories.map((shape) => {
                AxisData.push({
                    label: `${shape.displayName || shape.categoryName}`,
                    data: [],
                    hidden: true,
                    borderColor: `rgba(${Math.ceil(Math.random() * 255)},${Math.ceil(Math.random() * 255)},${Math.ceil(Math.random() * 255)},1)`,
                    pointRadius: 0
                })
            });
            createChart(AxisData);
            //(AxisData);
        }

        if(outputBlendShapeValues){
            blendShapesValue = []
            blendShapes[0].categories.map((shape) => {
                blendShapesValue.push(shape.score);
            });
        }

}



//chartGenerator

function createChart(AxisData) {
    var ctx = document.getElementById('myChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: AxisData
        },
        options: {
            scales: {
                x: {
                    type: 'realtime',
                    realtime: {
                        duration: graphLength,
                        delay: graphDelay,
                        refresh: graphRefresh,
                        frameRate: graphFrame,
                        onRefresh: function (chart) {
                            if (webcamRunning) {
                                if (blendShapesValue !== []) {
                                    var i = 0;
                                    blendShapesValue.forEach(e =>{
                                        //軽量化のため非表示にしているグラフは更新しない
                                        if(chart.isDatasetVisible(i)) {
                                            chart.data.datasets[i].data.push(
                                                {
                                                    x: Date.now(),
                                                    y: blendShapesValue[i]

                                                }
                                            );
                                        }
                                        i++;
                                    })
                                }
                            }
                        }
                    }
                },
                y: {
                    min: 0,
                    max: 1
                }
            }
        }
    });
}

$("#sideCloseMenuButton").hide();
$("#OverflowMenu").hide()
$("#OverflowMenu").animate({'left': -$("#OverflowMenu").width()},0);
//menu表示
$("#menuButton").on("click",function(){
    if($("#OverflowMenu").hasClass(".menuOpens")){
        //console.log("閉じた")
        $("#OverflowMenu").animate({'left': - $("#OverflowMenu").width(), "display":"none"},100);
        $("#OverflowMenu").removeClass(".menuOpens");
    }else{
        $("#OverflowMenu").show()
        //console.log("開いた")
        $("#OverflowMenu").animate({'left':'0px'},100);
        $("#OverflowMenu").addClass(".menuOpens");
    }
    $("#sideOpenMenuButton").toggle();
    $("#sideCloseMenuButton").toggle();

});


const cameraDeviceIds = [/* { deviceId, label } */];
//カメラの一覧取得
function GetCameraID(){
    navigator.mediaDevices.enumerateDevices().then(function(mediaDevices) {
        $("#cameraSelector").children().remove();
        $("<option value=\"0\">カメラOFF</option>").appendTo("#cameraSelector");
        for (let len = mediaDevices.length, i = 0; i < len; i++) {
            const item = mediaDevices[i];
            // NOTE: カメラデバイスの場合、 kind プロパティには "videoinput" が入っている:
            if (item.kind === "videoinput") {

                const deviceId = item.deviceId;
                const label = item.label;
                if(deviceId === ""){
                    $("#cameraSelector").append(`<option value="${deviceId}">権限がありません。</option>`)
                    continue;
                }
                // NOTE: ここでデバイスID（とラベル）を適当な変数に保存しておく
                cameraDeviceIds.push({ deviceId, label });
                $("#cameraSelector").append(`<option value="${deviceId}">${label}</option>`)
            }
        }
    }).catch((e)=>{
        $("#cameraSelector").children().remove();
        $("#cameraSelector").append(`<option value="${deviceId}">権限がありません。</option>`)
    });
}
GetCameraID();

//カメラの選択項目の取得
var CameraSelected = 0;
$("#cameraSelector").change(function(){
    CameraSelected = $('option:selected').val();
    //console.log(CameraSelected === 0)
    if(CameraSelected <= 0){
        switchCam(false)
    }else{
        switchCam(true)
    }
});

//メニューの構築
$("#lowEnergyMode").on("click",function (){
    let el = $("#lowEnergyModeValue")
    if(el.prop("checked")){
        el.removeAttr("checked").prop("checked",false).change();
    }else{
        el.attr("checked",true).prop("checked",true).change();
    }
    lowEnergyModeChange()
});

/*低負荷モード*/
/*フレームレートを低下させます*/
function lowEnergyModeChange(){
    lowEnergyMode = $("#lowEnergyModeValue").prop("checked");
    if(lowEnergyMode){
        graphFrame = 15;
        graphLength = 4000;
        graphRefresh = 16;
        graphDelay = 16;
    }else{
        graphFrame = 60;
        graphLength = 4000;
        graphRefresh = 66;
        graphDelay = 66;
    }
    if(AxisData.length > 0){
        chart.destroy()
        createChart(AxisData)
    }
}
$("#lowEnergyModeValue").change(lowEnergyModeChange());

/*通知関係*/

function notice(title,detail,error){
    let notice = $("#notice");
    let history = $("#noticeHistory");
    if(error){

        let el = $("<div class='error'>").prependTo(notice).hide();
        $("<div>").append(title).appendTo(el);
        $("<div>").append(detail).appendTo(el);

        let elh = $("<li class='error'>").insertAfter(history)
        $("<div>").append(title).append("<div>"+detail+"</div>").appendTo(elh);
        let time = new Date();
        $("<div>").append(time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds()).appendTo(elh);


        el.slideDown(300);
        el.delay(10000).queue(function (){
            el.remove();
        })

        el.on("click",()=>{
           el.remove();
        });



    }else{
        let el = $("<div class='notice'>").prependTo(notice).hide();
        $("<div>").append(title).appendTo(el);
        $("<div>").append(detail).appendTo(el);

        let elh = $("<li class='notice'>").insertAfter(history)
        $("<div>").append(title).append("<div>"+detail+"</div>").appendTo(elh);
        let time = new Date();
        $("<div>").append(time.getHours() + ":" + time.getMinutes() + ":" + time.getSeconds()).appendTo(elh);


        el.slideDown(300);
        el.delay(10000).queue(function (e){
            el.remove();
        })

        el.on("click",()=>{
            $(el).remove();
        });
    }

}

$("#historyDelete").on("click",()=>{
    $("#noticeHistory").nextAll().remove();
})