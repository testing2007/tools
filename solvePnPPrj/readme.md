1. 我需要利用 opencv　版本 solvePnP　算法精准捕捉王老吉罐310ml，识别 assets/wanglaoji/mark.jpg 特征信息后；

2. 在其外表播放 assets/wanglaoji/attach.mp4, bottle.glb 是关于王老吉的建模，里面包含 bottleMesh, labelMesh, labelMesh是有平面UV， 内容就是assets/wanglaoji/mark.jpg ;

3. assets/wanglaoji/bottle.glb 的坐标系满足右手规则，大拇指方向X正方向， 手伸向y正方向，四指弯曲方向z正方向， 这个也许对于 openvc, three.js 也许不一样，可能需要注意坐标转换，lableMesh和bottleMesh都是以几何圆心为原点，同时也是世界原点，labelMesh包裹了bottleMesh， 我想得是，是不是labelMesh被是标记后，一旦需要贴视频就会更精准一点， 这一点我不是很确定；

4. libs/opencv.js 已准备。

#### 来实现这个项目

这需要创建一个完整的 HTML 页面，包含摄像头输入、OpenCV 特征匹配、solvePnP 姿态估计、Three.js 3D 渲染和视频纹理贴图。

需要先确认几点：

1. 摄像头标定参数：是否有真实的摄像机内参矩阵（焦距、主点坐标）？还是用估算值（基于图像宽高）？
   摄像头标定参数 这个没有， 我也不知道如何标定；
2. mark.jpg 的物理尺寸：标签在现实中的宽高是多少厘米？（solvePnP 的 3D 点坐标需要）
   mark.jpg 宽207mm, 高105mm；
3. bottle.glb 的朝向：建模时罐子正面（标签面）朝向哪个轴的正方向？
   bottle.glb 大概逆时针水平旋转45度是 “王老吉” 文字正面；
