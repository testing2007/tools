# English Blind Listener 部署指南

## 服务器信息
| 项目 | 值 |
|------|-----|
| **服务器地址** | 101.35.11.122 |
| **前端目录** | /ldtrade/tools/listen |
| **后端目录** | /ldtrade/tools/listen-api |
| **访问地址** | http://101.35.11.122/tools/listen/ |

---

# 🪟 Windows 环境

## 1. 环境准备

### 1.1 安装依赖
```powershell
cd d:\workspace\tools\listen\backend
pip install -r requirements.txt
```

### 1.2 配置数据库
编辑 `database.py`，确认 MySQL 密码：
```python
WINDOWS_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Kuwo1234',  # 修改为你的密码
    'database': 'listen_db',
    'charset': 'utf8mb4'
}
```

### 1.3 Whisper 模型
模型缓存路径：`%USERPROFILE%\.cache\whisper\base.pt`

**自动下载**：首次运行 `start.bat` 会自动检查并下载模型。

**手动下载**（如自动失败）：
```powershell
mkdir %USERPROFILE%\.cache\whisper
curl -L -o %USERPROFILE%\.cache\whisper\base.pt https://huggingface.co/openai/whisper-base/resolve/main/pytorch_model.bin
```

## 2. 启动服务

**方式一：双击运行**
```
直接双击 start.bat
```

**方式二：命令行**
```powershell
cd d:\workspace\tools\listen\backend
python main.py
```

## 3. 前端开发模式
```powershell
cd d:\workspace\tools\listen
npm run dev
```

## Windows 访问地址
- 前端: http://localhost:5174/tools/listen/
- API: http://localhost:8001/

---

# 🐧 Linux (CentOS) 环境

## 1. 环境准备

### 1.1 创建目录
```bash
mkdir -p /ldtrade/tools/listen
mkdir -p /ldtrade/tools/listen-api/uploads
mkdir -p ~/.cache/whisper
```

### 1.2 安装依赖
```bash
cd /ldtrade/tools/listen-api
pip3 install -r requirements.txt
```

### 1.3 配置数据库
编辑 `/ldtrade/tools/listen-api/database.py`，确认 MySQL 密码：
```python
LINUX_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': 'Kuwo1234@',  # 修改为你的密码
    'database': 'listen_db',
    'charset': 'utf8mb4'
}
```

### 1.4 Whisper 模型
模型缓存路径：`~/.cache/whisper/base.pt`

**从 Windows 传输**（推荐）：
```bash
# 在 Windows 上执行
scp C:\Users\weizh\.cache\whisper\base.pt root@101.35.11.122:/root/.cache/whisper/
```

**服务器直接下载**：
```bash
wget -O ~/.cache/whisper/base.pt https://huggingface.co/openai/whisper-base/resolve/main/pytorch_model.bin
```

## 2. 启动服务

### 后台运行
```bash
cd /ldtrade/tools/listen-api
nohup python3 main.py > listen.log 2>&1 &
```

### 查看日志
```bash
tail -f /ldtrade/tools/listen-api/listen.log
```

### 重启服务
```bash
pkill -f "python3 main.py"
cd /ldtrade/tools/listen-api
nohup python3 main.py > listen.log 2>&1 &
```

## 3. Nginx 配置
```nginx
# 前端静态文件
location /tools/listen/ {
    alias /ldtrade/tools/listen/;
    index index.html;
    try_files $uri $uri/ /tools/listen/index.html;
    
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# 后端 API
location /tools/listen-api/ {
    proxy_pass http://127.0.0.1:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 500M;
}
```

```bash
nginx -t && nginx -s reload
```

---

# 📦 部署脚本

## 1. 本地打包
```bash
cd d:\workspace\tools\listen
npm run build
```

## 2. 上传前端
```bash
scp -r ./dist/* root@101.35.11.122:/ldtrade/tools/listen/
```

## 3. 上传后端
```bash
scp -r ./backend/* root@101.35.11.122:/ldtrade/tools/listen-api/
```

## 4. 上传 Whisper 模型
```bash
scp C:\Users\weizh\.cache\whisper\base.pt root@101.35.11.122:/root/.cache/whisper/
```

---

# 🔍 访问测试

| 环境 | 前端 | API |
|------|------|-----|
| Windows | http://localhost:5174/tools/listen/ | http://localhost:8001/ |
| 服务器 | http://101.35.11.122/tools/listen/ | http://101.35.11.122/tools/listen-api/ |
