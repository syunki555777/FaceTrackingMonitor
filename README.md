# FaceTrackingMonitor

## 概要
`FaceTrackingMonitor` は、Mediapipeを用いた測定値の監視とリアルタイムでのデータ可視化を目的とした、教育者や研究者向けのツールです。

このシステムでは以下の機能を提供します：
- ユーザーデバイスのカメラを利用した瞬き検出を含むリアルタイムデータ収集。
- 測定したデータのWebSocketを用いたサーバーへの送信。
- サーバーで収集した複数クライアントのデータを、リアルタイムでモニタリングするダッシュボード表示。

## 機能
### クライアントデータ送信（`index.html`）
- クライアントはカメラを利用し、Mediapipeなどのアルゴリズムでデータを解析します。
- 測定データ（例: 瞬き回数やランダム値など）をWebSocketを介してサーバーに送信します。

### モニタリング画面（`monitor.html`）
- 複数クライアントから送信されたデータをリアルタイムで取得・表示します。
- 各クライアントごとの測定値を、時系列グラフとして視覚的に確認可能です（`Chart.js`を使用）。

### サーバー（`main.py`）
- WebSocket通信を使用してクライアントデータを受信し、管理します。
- `FastAPI`を使用したWebサーバーで、クライアント側のデータ送信やモニタリング画面の応答を実現します。

## 使用技術
- **フロントエンド**  
  - HTML5, JavaScript  
  - [Chart.js](https://www.chartjs.org/)（リアルタイムグラフ描画）  
- **バックエンド**  
  - [FastAPI](https://fastapi.tiangolo.com/)（Webバックエンド）  
  - WebSocket APIを利用したリアルタイム通信
- **その他**  
  - `Mediapipe`（クライアントでの瞬き検出等に利用可能）

## ファイル構造
```
.
├── main.py                # サーバーサイドロジック
├── templates/             # HTMLテンプレートを格納するディレクトリ
│   ├── [index.html](templates/index.html)         # クライアントデータ送信用ページ
│   ├── [monitor.html](templates/monitor.html)     # データモニタリング用ページ
├── static/                # 静的ファイル（CSSやJavaScript）格納用ディレクトリ
│   ├── css/
│   │   ├── [styles.css](static/css/styles.css)     # 共通のスタイルシート
│   └── js/
│       ├── [index.js](static/js/index.js)         # クライアント処理用スクリプト
│       ├── [monitor.js](static/js/monitor.js)     # モニタリング画面処理用スクリプト
├── [README.md](README.md)              # 本ファイル
├── [requirements.txt](requirements.txt)       # 必要なPythonパッケージのリスト
└── [LICENSE](LICENSE)                # ライセンス情報
```
### ファイル詳細
- **`main.py`（バックエンド）**  
  - `/ws`: クライアントがデータを送信するためのWebSocketエンドポイント。  
  - `/ws-monitor`: モニタリング画面用のWebSocketエンドポイント。  
  - `/`: クライアント側の`index.html`をレンダリング。
  - `/monitor`: モニタリング側の`monitor.html`をレンダリング。

- **`index.html`（クライアントページ）**  
  - カメラデバイスを利用した瞬き検出やダミーデータを作成し、サーバーに送信します。
  - UUIDベースで各クライアントを識別します。

- **`monitor.html`（モニタリングページ）**  
  - サーバーから送られてくる複数クライアントのデータをリアルタイムに受信し、グラフ化します。

## インストールと動作環境

### 動作環境
- Python 3.8以上  
- フロントエンド：モダンブラウザ（JavaScriptサポート必須）

### セットアップ手順
1. **必要な依存パッケージのインストール**  
   以下のコマンドで `FastAPI` や `uvicorn` 等の依存パッケージをインストールします。
   ```bash
   pip install websockets fastapi uvicorn pandas jinja2
   ```

2. **サーバーの起動**  
   `main.py` サーバーを起動します。
   ```bash
   python main.py
   ```
   起動後、ローカルホスト（例: `http://127.0.0.1:8000`）にアクセスして動作を確認してください。

3. **クライアントアクセス**  
   - `http://localhost:8000/` にアクセスして、クライアント側の画面を確認します。
   - `http://localhost:8000/monitor` にアクセスして、モニタリング画面を開きます。

## 開発者情報
初版作成者: 鈴木 舜基

## ライセンス

このプロジェクトはMITライセンスの下で提供されています。詳細は[`LICENSE`](./LICENSE)ファイルをご確認ください。

### サードパーティライブラリのライセンス

- Mediapipe: Apache License 2.0
- jQuery: MIT License
- Chart.js: MIT License

詳細は[`THIRD-PARTY-NOTICES`](./THIRD-PARTY-NOTICES)ファイルをご確認ください。