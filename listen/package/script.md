# English Blind Listener 部署脚本

## 服务器信息
- **服务器地址**: 101.35.11.122
- **前端目录**: /ldtrade/tools/listen
- **后端目录**: /ldtrade/tools/listen-api
- **访问地址**: http://101.35.11.122/tools/listen/

---

## 1. 本地打包

```bash
cd d:\workspace\tools\listen
npm run build
```

---

## 2. 上传前端文件

```bash
# 密码 K~4@
scp -r ./dist/* root@101.35.11.122:/ldtrade/tools/listen/
```

---

## 3. 上传后端文件

```bash
# 密码 K~4@
scp -r ./backend/* root@101.35.11.122:/ldtrade/tools/listen-api/
```

---

## 4. 服务器端配置

### 4.1 创建目录
```bash
mkdir -p /ldtrade/tools/listen
mkdir -p /ldtrade/tools/listen-api/uploads
```

### 4.2 安装后端依赖
```bash
cd /ldtrade/tools/listen-api
pip3 install -r requirements.txt
```

### 4.3 修改数据库密码
编辑 `/ldtrade/tools/listen-api/database.py`，修改 MySQL 密码：
```python
DB_CONFIG = {
    'password': '你的实际密码',
    ...
}
```

### 4.4 启动后端服务
```bash
cd /ldtrade/tools/listen-api
nohup python3 main.py > app.log 2>&1 &
```

### 4.5 Nginx 配置
```nginx
# 前端静态文件
location /tools/listen/ {
    alias /ldtrade/tools/listen/;
    index index.html;
    try_files $uri $uri/ /tools/listen/index.html;
    
    # HTML 不缓存
    location ~* \.html$ {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}

# 后端 API
location /tools/listen-api/ {
    proxy_pass http://127.0.0.1:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 500M;  # 支持大文件上传
}
```

```bash
nginx -t && nginx -s reload
```

---

## 5. 访问测试

- 前端: http://101.35.11.122/tools/listen/
- API: http://101.35.11.122/tools/listen-api/

---

## 常用命令

### 查看后端日志
```bash
tail -f /ldtrade/tools/listen-api/listen.log
```

### 重启后端
```bash
pkill -f "python3 main.py"
cd /ldtrade/tools/listen-api
nohup python3 main.py > listen.log 2>&1 &
```

---

## Windows 本地部署

### 1. 安装依赖
```powershell
cd d:\workspace\tools\listen\backend
pip install -r requirements.txt
```

### 2. 配置数据库密码
编辑 `database.py`，修改 MySQL 密码：
```python
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'root',
    'password': '你的密码',
    'database': 'listen_db',
    'charset': 'utf8mb4'
}
```

### 3. 启动服务
**方式一：双击运行**
```
直接双击 start.bat
```

**方式二：命令行**
```powershell
cd d:\workspace\tools\listen\backend
python main.py
```

### 4. Vite 开发模式
前端开发时，Vite 会自动代理 API 请求：
```powershell
cd d:\workspace\tools\listen
npm run dev
```

访问 http://localhost:5174/tools/listen/

### Windows 访问地址
- 前端: http://localhost:5174/tools/listen/
- API: http://localhost:8001/

