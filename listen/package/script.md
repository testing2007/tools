# English Blind Listener 部署脚本

## 服务器信息
- **服务器地址**: 101.35.11.122
- **部署目录**: /lisener

---

## 1. 本地打包

```bash
cd d:\workspace\tools\listen
npm run build
```

打包后文件位于 `dist/` 目录。

---

## 2. 上传到服务器

### 方法 A: 使用 SCP (推荐)

```bash
# Windows PowerShell
scp -r ./dist/* root@101.35.11.122:/ldtrade/listen/

# 或指定端口
scp -P 22 -r ./dist/* root@101.35.11.122:/ldtrade/listen/
```

### 方法 B: 使用 SFTP 工具

1. 使用 WinSCP / FileZilla 连接服务器
2. 将 `dist/` 目录下所有文件上传到服务器 `/ldtrade/listen/` 目录

---

## 3. 服务器端配置 (Nginx)

确保 Nginx 配置正确：

```nginx
server {
    listen 80;
    server_name 101.35.11.122;

    location /listen/ {
        alias /ldtrade/listen/;
        index index.html;
    }
}
```

重载 Nginx：
```bash
sudo nginx -t && sudo nginx -s reload
```

---

## 4. 访问测试

浏览器打开: http://101.35.11.122/listen/

---

## 注意事项

1. **确保目录存在**: 服务器上需先创建 `/listen/` 目录
   ```bash
   sudo mkdir -p /listen
   sudo chmod 755 /listen
   ```

2. **PDF Worker 文件**: 确保 `pdf.worker.min.mjs` 文件已正确上传

3. **清除浏览器缓存**: 部署后如有问题，先清除浏览器缓存再测试
