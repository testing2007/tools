import requests
import base64
import socket
import re
import json
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

# 更新的稳定 GitHub 免费节点订阅地址（2024-2025 活跃维护）
# "https://raw.githubusercontent.com/mahdibland/V2RayAggregator/master/sub/sub_merge_base64.txt",
# "https://raw.githubusercontent.com/Leon406/SubCrawler/master/sub/share/vless",
# "https://raw.githubusercontent.com/Leon406/SubCrawler/master/sub/share/v2",
SOURCES = [
    # 高活跃度源
    "https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub",
    "https://raw.githubusercontent.com/mfuu/v2ray/master/v2ray",
    "https://raw.githubusercontent.com/aiboboxx/v2rayfree/main/v2",
    "https://raw.githubusercontent.com/ermaozi/get_subscribe/main/subscribe/v2ray.txt",
    "https://raw.githubusercontent.com/freefq/free/master/v2",
    "https://raw.githubusercontent.com/peasoft/NoMoreWalls/master/list.txt",
    # 备用源
    "https://raw.githubusercontent.com/vfarid/v2ray-share/main/all_nodes.txt",
]

def decode_base64(data):
    """尝试解码 Base64 内容"""
    try:
        # 补齐 padding
        padding = 4 - len(data) % 4
        if padding != 4:
            data += '=' * padding
        decoded = base64.b64decode(data).decode('utf-8', errors='ignore')
        return decoded
    except:
        return data

def parse_node_address(node):
    """从节点配置中提取服务器地址和端口"""
    try:
        if node.startswith('vmess://'):
            # vmess 节点
            config = node[8:]
            decoded = decode_base64(config)
            data = json.loads(decoded)
            return data.get('add'), int(data.get('port', 0))
        elif node.startswith('ss://'):
            # ss 节点
            match = re.search(r'@([^:]+):(\d+)', node)
            if match:
                return match.group(1), int(match.group(2))
        elif node.startswith('trojan://'):
            # trojan 节点
            match = re.search(r'@([^:]+):(\d+)', node)
            if match:
                return match.group(1), int(match.group(2))
        elif node.startswith('vless://'):
            # vless 节点
            match = re.search(r'@([^:]+):(\d+)', node)
            if match:
                return match.group(1), int(match.group(2))
    except Exception as e:
        pass
    return None, None

def test_node_connectivity(node, timeout=3):
    """测试节点是否可连接"""
    host, port = parse_node_address(node)
    if not host or not port:
        return False, node, "无法解析"
    
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        if result == 0:
            return True, node, f"{host}:{port}"
        else:
            return False, node, f"{host}:{port} 连接失败"
    except socket.gaierror:
        return False, node, f"{host} DNS解析失败"
    except Exception as e:
        return False, node, str(e)

def fetch_and_merge(test_connectivity=True):
    all_nodes = []
    print("=" * 50)
    print("[INFO] 正在获取节点，请稍候...")
    print("=" * 50)
    
    for url in SOURCES:
        try:
            response = requests.get(url, timeout=15)
            if response.status_code == 200:
                content = response.text.strip()
                
                # 尝试解码 Base64
                if not any(content.startswith(p) for p in ['vmess://', 'ss://', 'trojan://', 'vless://']):
                    content = decode_base64(content)
                
                # 提取有效节点
                lines = content.splitlines()
                valid_nodes = [l.strip() for l in lines if l.strip().startswith(('vmess://', 'ss://', 'trojan://', 'vless://'))]
                all_nodes.extend(valid_nodes)
                print(f"[OK] 获取 {len(valid_nodes):3d} 个节点 | {url[:50]}...")
        except Exception as e:
            print(f"[FAIL] 获取失败 | {url[:50]}... | {str(e)[:30]}")
    
    # 去重处理
    unique_nodes = list(set(all_nodes))
    print(f"\n共收集到 {len(unique_nodes)} 个唯一节点")
    
    if test_connectivity and unique_nodes:
        print("\n" + "=" * 50)
        print("[INFO] 正在测试节点连通性（这可能需要几分钟）...")
        print("=" * 50)
        
        working_nodes = []
        failed_count = 0
        
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(test_node_connectivity, node): node for node in unique_nodes}
            
            for i, future in enumerate(as_completed(futures)):
                is_working, node, info = future.result()
                if is_working:
                    working_nodes.append(node)
                    print(f"[{i+1}/{len(unique_nodes)}] [OK] 可用: {info}")
                else:
                    failed_count += 1
                    # 只显示部分失败信息
                    if failed_count <= 5:
                        print(f"[{i+1}/{len(unique_nodes)}] [X] 不可用: {info}")
                    elif failed_count == 6:
                        print("... 隐藏更多失败节点 ...")
        
        print(f"\n测试完成: {len(working_nodes)} 个可用 / {len(unique_nodes)} 个总计")
        unique_nodes = working_nodes
    
    # 保存结果
    if unique_nodes:
        # 保存原始格式
        with open("my_v2ray_nodes.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(unique_nodes))
        
        # 保存 Base64 编码格式（方便导入）
        encoded_content = base64.b64encode("\n".join(unique_nodes).encode()).decode()
        with open("my_v2ray_nodes_base64.txt", "w", encoding="utf-8") as f:
            f.write(encoded_content)
        
        print("\n" + "=" * 50)
        print(f"[DONE] 任务完成! 共保存 {len(unique_nodes)} 个可用节点。")
        print("=" * 50)
        print("文件已保存:")
        print("  - my_v2ray_nodes.txt (原始格式)")
        print("  - my_v2ray_nodes_base64.txt (Base64，可直接粘贴到V2RayN)")
    else:
        print("\n[WARN] 未找到可用节点，请稍后重试。")

if __name__ == "__main__":
    import sys
    # 使用 --no-test 参数可跳过连通性测试
    test = "--no-test" not in sys.argv
    fetch_and_merge(test_connectivity=test)