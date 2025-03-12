from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import json
from typing import Dict
import hashlib
import pandas as pd
import uuid
import asyncio
app = FastAPI()
templates = Jinja2Templates(directory="templates")

# グローバル変数
clients = set()
monitors = set()
user_data_df = pd.DataFrame(columns=["client_id", "name","ip"])
client_data_store = {}  # 各クライアントの最新データを保存する辞書

@app.websocket("/ws-monitor")
async def monitor_websocket_endpoint(websocket: WebSocket):
    # モニタークライアントを追加し、受信された情報を転送
    await websocket.accept()
    monitors.add(websocket)
    try:
        print(f"新規モニター登録: {websocket.client.host}")
        while True:
            await asyncio.sleep(1)  # 1秒間隔で送信
            if client_data_store:  # クライアントデータが存在する場合のみ送信
                all_client_data = json.dumps(client_data_store)  # 全クライアントの最新データをJSONとして送信
                await websocket.send_text(all_client_data)
    except WebSocketDisconnect:
        print(f"モニター切断: {websocket.client.host}")
        monitors.remove(websocket)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global client_data_store

    # WebSocket接続を受け入れる
    await websocket.accept()

    try:
        while True:
            raw_data = await websocket.receive_text()
            #print(f"受信データ: {raw_data}")

            # JSONとして解析し、クライアントデータを保存
            try:
                data = json.loads(raw_data)
                client_id = data.get("client_id")  # クライアントID
                client_values = data.get("data")  # データ（タイトルと値）

                if client_id and isinstance(client_values, dict):
                    # クライアントのデータを更新/登録
                    client_data_store[client_id] = client_values
                    # print(f"更新されたデータ: {client_id} -> {client_values}")
                else:
                    print("無効なデータ形式、スキップします")

            except json.JSONDecodeError:
                print("JSON形式が無効です。データをスキップ")
                continue

    except WebSocketDisconnect:
        # WebSocket切断時の処理
        print(f"クライアント {getattr(websocket.client, 'host', '不明')} が切断しました")
        # clients内にWebSocketが存在する場合のみ削除
        if websocket in clients:
            clients.remove(websocket)
        # クライアントのデータを削除
        client_host = getattr(websocket.client, "host", None)
        if client_host in client_data_store:
            del client_data_store[client_host]

        print(f"クライアントデータ（{client_host}）の削除を完了しました")




@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/monitor")
async def monitor(request: Request):
    return templates.TemplateResponse("monitor.html", {"request": request})


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)