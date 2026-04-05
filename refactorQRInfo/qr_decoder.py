#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
二维码识别工具
用于从图片中识别二维码并提取其中的信息

依赖安装：
pip install pyzbar pillow opencv-python
"""

import sys
from pathlib import Path

try:
    from pyzbar.pyzbar import decode, ZBarSymbol
    from PIL import Image, ImageEnhance, ImageFilter
    import cv2
    import numpy as np
except ImportError as e:
    print(f"缺少依赖: {e}")
    print("请运行: pip install pyzbar pillow opencv-python")
    print("Windows 用户可能还需要安装 Visual C++ Redistributable")
    sys.exit(1)


def preprocess_image_pil(image: Image.Image) -> list[Image.Image]:
    """
    使用 PIL 对图片进行多种预处理，返回多个处理版本
    """
    versions = [image]
    
    # 1. 转换为灰度图
    gray = image.convert("L")
    versions.append(gray)
    
    # 2. 增强对比度
    enhancer = ImageEnhance.Contrast(gray)
    high_contrast = enhancer.enhance(2.0)
    versions.append(high_contrast)
    
    # 3. 二值化（简单阈值）
    threshold = 128
    binary = gray.point(lambda x: 255 if x > threshold else 0, '1')
    versions.append(binary.convert("L"))
    
    # 4. 锐化
    sharpened = gray.filter(ImageFilter.SHARPEN)
    versions.append(sharpened)
    
    # 5. 放大 2 倍（对小图有帮助）
    if image.width < 500 or image.height < 500:
        scaled = image.resize((image.width * 2, image.height * 2), Image.Resampling.LANCZOS)
        versions.append(scaled)
    
    return versions


def preprocess_image_cv(img: np.ndarray) -> list[np.ndarray]:
    """
    使用 OpenCV 对图片进行多种预处理，返回多个处理版本
    """
    versions = [img]
    
    # 1. 灰度图
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    versions.append(cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR))
    
    # 2. 自适应阈值二值化
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
    )
    versions.append(cv2.cvtColor(adaptive, cv2.COLOR_GRAY2BGR))
    
    # 3. OTSU 二值化
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    versions.append(cv2.cvtColor(otsu, cv2.COLOR_GRAY2BGR))
    
    # 4. 高斯模糊后再二值化（去噪）
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, blur_binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    versions.append(cv2.cvtColor(blur_binary, cv2.COLOR_GRAY2BGR))
    
    # 5. 形态学操作（闭运算修复断裂）
    kernel = np.ones((3, 3), np.uint8)
    morphed = cv2.morphologyEx(otsu, cv2.MORPH_CLOSE, kernel)
    versions.append(cv2.cvtColor(morphed, cv2.COLOR_GRAY2BGR))
    
    # 6. 放大处理
    h, w = img.shape[:2]
    if w < 500 or h < 500:
        scaled = cv2.resize(img, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        versions.append(scaled)
    
    return versions


def decode_qr_from_image(image_path: str) -> list[dict]:
    """
    从图片中识别所有二维码（带预处理增强）
    
    Args:
        image_path: 图片文件路径
        
    Returns:
        包含所有识别到的二维码信息的列表
    """
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"图片文件不存在: {image_path}")
    
    # 打开图片
    image = Image.open(image_path)
    
    # 获取多个预处理版本
    image_versions = preprocess_image_pil(image)
    
    for idx, img_version in enumerate(image_versions):
        # 解码二维码
        decoded_objects = decode(img_version)
        
        if decoded_objects:
            results = []
            for obj in decoded_objects:
                result = {
                    "类型": obj.type,
                    "数据": obj.data.decode("utf-8", errors="replace"),
                    "位置": {
                        "左": obj.rect.left,
                        "上": obj.rect.top,
                        "宽": obj.rect.width,
                        "高": obj.rect.height
                    },
                    "多边形顶点": [(p.x, p.y) for p in obj.polygon],
                    "预处理方法": f"PIL 方法 {idx}"
                }
                results.append(result)
            return results
    
    return []


def decode_qr_with_opencv(image_path: str) -> list[dict]:
    """
    使用 OpenCV 的内置检测器识别二维码（备选方案）
    
    Args:
        image_path: 图片文件路径
        
    Returns:
        包含所有识别到的二维码信息的列表
    """
    try:
        import cv2
    except ImportError:
        print("OpenCV 未安装，请运行: pip install opencv-python")
        return []
    
    # 读取图片
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"无法读取图片: {image_path}")
    
    # 创建二维码检测器
    detector = cv2.QRCodeDetector()
    
    # 获取多个预处理版本
    image_versions = preprocess_image_cv(img)
    
    for idx, img_version in enumerate(image_versions):
        # 检测并解码
        data, vertices, _ = detector.detectAndDecode(img_version)
        
        if data:
            return [{
                "类型": "QRCODE",
                "数据": data,
                "顶点": vertices.tolist() if vertices is not None else None,
                "预处理方法": f"OpenCV 方法 {idx}"
            }]
    
    return []


def main():
    """命令行入口"""
    if len(sys.argv) < 2:
        print("用法: python qr_decoder.py <图片路径>")
        print("示例: python qr_decoder.py qrcode.png")
        return
    
    image_path = sys.argv[1]
    
    print(f"正在识别: {image_path}")
    print("-" * 40)
    
    try:
        # 优先使用 pyzbar
        results = decode_qr_from_image(image_path)
        
        if not results:
            print("pyzbar 未识别到二维码，尝试 OpenCV...")
            results = decode_qr_with_opencv(image_path)
        
        if results:
            print(f"[成功] 共识别到 {len(results)} 个码\n")
            for i, result in enumerate(results, 1):
                print(f"【第 {i} 个】")
                print(f"  类型: {result['类型']}")
                print(f"  数据: {result['数据']}")
                if '位置' in result:
                    pos = result['位置']
                    print(f"  位置: ({pos['左']}, {pos['上']}) - {pos['宽']}x{pos['高']}")
                if '预处理方法' in result:
                    print(f"  识别方法: {result['预处理方法']}")
                print()
        else:
            print("[失败] 未识别到任何二维码")
            print("提示: 确保图片清晰、二维码完整且未变形")
            
    except Exception as e:
        print(f"[错误] 识别失败: {e}")


if __name__ == "__main__":
    main()
