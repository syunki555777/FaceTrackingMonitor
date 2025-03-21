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

//送信する値のデータを記録
//測定値を送信するレート(秒)
var send_rate = 1;
var sending = false;
var sending_param = [];
var last_write = new Date();
var write_delay = 33;

const protocol = window.location.protocol === "https:" ? "wss" : "ws";
const host = window.location.host;

/*推論開始前のサーバー接続処理*/
    // WebSocket接続の確立
    const socket = new WebSocket(`${protocol}://${host}/ws`);
    let sendDataInstance;

    socket.onopen = () => {

        // 現在のクライアントID（UUID）を取得または生成
        let userID = getCookie("user_id");
        if (!userID) {
            userID = generateUUID();
            setCookie("user_id", userID, 365); // 有効期限365日
            console.log("新しいUUIDを生成しクッキーに保存:", userID);
        } else {
            console.log("既存のUUIDをクッキーから取得:", userID);
        }

        notice("接続しました。","ユーザー："+ userID,false)
        console.log("WebSocket 接続成功");

        // SendDataクラスのインスタンス作成
        sendDataInstance = new SendData(socket, userID);
    };

    // WebSocket接続のクラス
    class SendData {
        constructor(socket, clientID) {
            this.socket = socket;
            this.clientID = clientID;
            this.samples = []; // JSON形式の'data samples'を保持
        }

        // データを追加するメソッド
        addSample(data) {
            const subTimestamp = new Date().toISOString(); // マイクロタイムスタンプ
            this.samples.push({
                sub_timestamp: subTimestamp, // サブタイムスタンプ
                data: data                   // データ配列
            });
        }

        // WebSocketを通じてJSONデータを送信
        send() {
            if(this.samples.length === 0){
                return;
            }
            if (this.socket.readyState === WebSocket.OPEN && this.clientID) {
                const payload = JSON.stringify({
                    user_id: this.clientID,  // ユーザーID
                    timestamp: new Date().toISOString(), // 全体のタイムスタンプ
                    samples: this.samples   // サンプルデータ
                });

                this.socket.send(payload);   // WebSocketでデータを送信
                //console.log("送信データ:", payload);

                // 送信後、サンプルをリセット
                this.samples = [];
            } else {
                console.warn("WebSocket接続が閉じています。送信できません。");
            }
        }
    }
// WebSocket接続の確立

    socket.onerror = error => {
        console.error("WebSocket エラー:", error);
        notice("サーバー通信","サーバーに到達できませんでした。",true);
    };

    // UUIDの生成（簡易版）
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // クッキー操作関数
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value}; expires=${d.toUTCString()}; path=/`;
    }

    // データ送信のサンプル
    async function sampleSendData() {
        let blinkCount = 0;

        // データ取得・送信を250msごとに実行
        setInterval(() => {
            // SendDataインスタンスにデータ記録
            const sampleData = [
                { name: "blink_rate", value: randomValue, unit: "%" },
            ];
            sendDataInstance.addSample(sampleData);

            // 1秒ごとにまとめてデータ送信
            if (sendDataInstance.samples.length >= 4) {
                sendDataInstance.send(); // 4つのサンプルが揃ったら送信
            }
        }, 250);
    }

//送信レートに合わせて定期的に実行
let sender = null;

function SendStart(){
    if(sendDataInstance) {
        sending = true;
        if (sender === null) {
            sender = setInterval(function () {
                if (sending === true) {
                    sendDataInstance.send();
                }
            }, 1000 * send_rate);
        }
    }else{
        sending = false;
        console.error("データの送信に失敗しました。インスタンスが空です。" + sendDataInstance);
    }
}

function StopSending(){
    sending = false;
    if(sender !== null){
        clearInterval(sender);
        sender = null;
    }
}


//関数群//
// 頭部傾きを計算する関数
function calculateHeadTiltAngle(landmarks) {
    // ランドマークの存在確認
    if (!landmarks || landmarks.length === 0) {
        console.warn("ランドマークデータが存在しません。");
        return { yaw: 0, pitch: 0, roll: 0 }; // デフォルト値を返す
    }

    // ランドマークを手動で指定
    const leftEyeInner = landmarks[359]; // 左目内側
    const rightEyeInner = landmarks[259]; // 右目内側
    const noseTip = landmarks[1]; // 鼻先

    // ランドマークの妥当性確認
    if (!leftEyeInner || !rightEyeInner || !noseTip) {
        console.error("必要なランドマークが不足しています。");
        return { yaw: 0, pitch: 0, roll: 0 }; // デフォルト値を返す
    }

    // *** Yaw（左右の傾き）の計算 ***
    // 左目内側と右目内側のポジションの差から計算
    const deltaX = rightEyeInner.x - leftEyeInner.x;
    const deltaY = rightEyeInner.y - leftEyeInner.y;
    const yaw = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    // *** Roll（回転）の計算 ***
    // 水平線と両目の傾きを比較
    const eyeMidpointX = (leftEyeInner.x + rightEyeInner.x) / 2; // 両目の中心点（X）
    const eyeMidpointY = (leftEyeInner.y + rightEyeInner.y) / 2; // 両目の中心点（Y）

    // 「両目の中心線」が水平線とどの程度回転しているか
    const roll = Math.atan2(leftEyeInner.y - rightEyeInner.y, leftEyeInner.x - rightEyeInner.x) * (180 / Math.PI);

    // *** Pitch（上下の傾き）の計算 ***
    // 鼻先と「両目の平均」の上下位置の差を使う
    const noseToEyesAverageY = (noseTip.y + leftEyeInner.y + rightEyeInner.y) / 3;
    const deltaYPitch = noseToEyesAverageY - noseTip.y;
    const pitch = Math.atan2(deltaYPitch, deltaX) * (180 / Math.PI);

    return { yaw, pitch, roll };
}

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

        //カメラが使用できた場合処理
        //データの送信を開始する。
        SendStart();



    }).catch((e)=>{
        if(e.name === "NotAllowedError"){

            notice("権限がありません。","カメラの権限が拒否されています。設定から許可してください。",true)
            StopSending();
        }else{

            notice("利用できません。","カメラにアクセスできませんでした。",true)
            notice(e.title,e.message,true)
            StopSending();
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
        SendStart();
    }).catch((e)=>{
        if(e.name === "NotAllowedError"){

            notice("権限がありません。","カメラの権限が拒否されています。設定から許可してください。",true)
            StopSending();
        }else{

            notice("利用できません。","カメラにアクセスできませんでした。",true)
            StopSending();
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
        await faceLandmarker.setOptions({runningMode: runningMode});
    }
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        results = faceLandmarker.detectForVideo(video, startTimeMs);
    }
    let headTiltAngles = { yaw: 0, pitch: 0, roll: 0 };
    if (results.faceLandmarks) {
        for (const landmarks of results.faceLandmarks) {
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                color: "#C0C0C070",
                lineWidth: 1
            });
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {color: "#FF3030"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {color: "#FF3030"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {color: "#30FF30"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {color: "#30FF30"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {color: "#E0E0E0"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {color: "#E0E0E0"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS, {color: "#FF3030"});
            drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS, {color: "#30FF30"});

            //頭部動揺の計算
            // 頭部傾き角度を計算
            headTiltAngles = calculateHeadTiltAngle(landmarks);
            // 必要に応じてページ内に反映
            document.getElementById("head_tilt_yaw").innerText = `Yaw (左右): ${headTiltAngles.yaw.toFixed(2)}°`;
            document.getElementById("head_tilt_pitch").innerText = `Pitch (上下): ${headTiltAngles.pitch.toFixed(2)}°`;
            document.getElementById("head_tilt_roll").innerText = `Roll (回転): ${headTiltAngles.roll.toFixed(2)}°`;
        }

        if(results.faceBlendshapes.length > 0){
            //データの書き込みレートを超えないように制御
            const now = new Date();

            //console.log(now - last_write)

            console.log(results.faceBlendshapes[0].categories)

            if(now - last_write > write_delay){
                //データをペイロードに入れる
                if(sendDataInstance && sending){
                        //console.log("ペイロードに値が挿入されました。" + results.faceBlendshapes[0].categories[9].score)
                        const sendData = [
                        { name: "eye_blink_left", value: results.faceBlendshapes[0].categories[9].score, unit: "%" },
                        { name: "eye_blink_right", value: results.faceBlendshapes[0].categories[10].score, unit: "%" },

                    ];
                        sendDataInstance.addSample(sendData);
                }
                last_write = now;
            }

            drawBlendShapes(videoBlendShapes, results.faceBlendshapes);
        }
        // Call this function again to keep predicting when the browser is ready.
        if (webcamRunning === true) {
            window.requestAnimationFrame(predictWebcam);
        }
    }
}

function drawBlendShapes(el, blendShapes) {
    if (!blendShapes.length) {
        return;
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


//最後に実行
    socket.onclose = () => {
        notice("Webソケット通信","WEBソケット通信が切断されました。",true)

    };
