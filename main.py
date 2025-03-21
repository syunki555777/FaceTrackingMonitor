from fastapi import FastAPI, WebSocket, Request, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import uvicorn
import os
import json
from typing import Dict, List
import pandas as pd
import uuid
import asyncio
from fastapi.staticfiles import StaticFiles
import argparse

app = FastAPI()

# /client/static 以下に静的ファイルを配置して提供する
STATIC_DIR = os.path.join(os.path.dirname(__file__), "client")
app.mount("/client", StaticFiles(directory="client", html=True), name="client")

# clientディレクトリ内のテンプレートを扱う
monitor_template = Jinja2Templates(directory="monitor")

# グローバル変数
clients = set()
monitors = set()
user_data_df = pd.DataFrame(columns=["client_id", "name", "ip"])
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
                # モニタリングデータをすべて送信
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

    user_id = ""

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                # JSONのデコード
                data = json.loads(raw_data)

                # `user_id`, `timestamp`, `samples`を取得
                user_id = data.get("user_id")
                timestamp = data.get("timestamp")
                samples = data.get("samples")

                # 構造が正しいか検証
                if user_id and timestamp and isinstance(samples, list):
                    # ユーザーのデータが存在しない場合、新規作成
                    if user_id not in client_data_store:
                        client_data_store[user_id] = {
                            "user_id": user_id,
                            "data": []
                        }

                    # `samples`のデータを追加
                    client_data_store[user_id]["data"].extend(samples)

                    # データの容量を200件に制限
                    if len(client_data_store[user_id]["data"]) > 200:
                        # 古いデータを削除（先頭から余分な数だけ取り除く）
                        client_data_store[user_id]["data"] = client_data_store[user_id]["data"][-200:]

                    print(f"更新されたデータ: {user_id} -> {samples}")
                    print(f"現在のデータ件数（{user_id}）: {len(client_data_store[user_id]['data'])}")
                else:
                    print("無効なデータ形式: 必要なキーが揃っていません")

            except json.JSONDecodeError:
                print("JSON形式が無効です。データをスキップ:", raw_data)
    except WebSocketDisconnect:
        # WebSocket切断時の処理
        print(f"クライアント {user_id or '不明'} が切断しました")
        # クライアントのデータ削除（`user_id` ベースで処理）
        if user_id and user_id in client_data_store:
            del client_data_store[user_id]
            print(f"クライアントデータ（{user_id}）の削除を完了しました")



@app.get("/monitor")
async def monitor(request: Request):
    return monitor_template.TemplateResponse("monitor.html", {"request": request})


import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the FastAPI server.")
    parser.add_argument("-host", type=str, default="127.0.0.1", help="Host IP to bind the FastAPI server to.")
    parser.add_argument("-port", type=int, default=8000, help="Port number to run the FastAPI server on.")
    args = parser.parse_args()

    uvicorn.run(app, host=args.host, port=args.port)
