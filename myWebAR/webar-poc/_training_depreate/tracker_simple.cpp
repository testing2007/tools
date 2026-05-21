#include <emscripten.h>
#include <emscripten/bind.h>
#include <array>
#include <cmath>
#include <algorithm>

// 返回给 JS 的姿态数据结构
struct ARPose {
    bool isTracking;
    std::array<float, 16> transformMatrix; // 替换原生的 float transformMatrix[16];
};

class ARTracker {
private:
    uint8_t* _pixelBuffer = nullptr;
    int _width;
    int _height;
    float _angle = 0.0f; // 用于模拟旋转

public:
    ARTracker(int width, int height) : _width(width), _height(height) {
        // 分配 RGBA 缓冲区 (宽 * 高 * 4字节)
        _pixelBuffer = new uint8_t[width * height * 4];
    }

    ~ARTracker() {
        if (_pixelBuffer) {
            delete[] _pixelBuffer;
        }
    }

    // 暴露缓冲区指针给 JavaScript
    intptr_t getBufferPointer() {
        return reinterpret_cast<intptr_t>(_pixelBuffer);
    }

    // 核心更新函数
    ARPose update() {
        ARPose pose;
        pose.isTracking = true;

        // 1. 验证零拷贝：对缓冲区的第一个像素进行“反色”处理
        // 如果我们在 JS 里写入了图像，C++ 实时反色，画面左上角会出现异样，以此证明内存共享成功
        _pixelBuffer[0] = 255 - _pixelBuffer[0]; // R
        _pixelBuffer[1] = 255 - _pixelBuffer[1]; // G
        _pixelBuffer[2] = 255 - _pixelBuffer[2]; // B

        // 2. 模拟空间计算：生成一个绕 Y 轴旋转的 4x4 变换矩阵（WebGL 列主序）
        _angle += 0.02f; // 每帧递增旋转角度
        float cosA = std::cos(_angle);
        float sinA = std::sin(_angle);

        // 初始化单位阵
        // std::fill_n(pose.transformMatrix, 16, 0.0f);
        pose.transformMatrix.fill(0.0f);
        
        // 绕 Y 轴旋转矩阵
        pose.transformMatrix[0] = cosA;
        pose.transformMatrix[2] = -sinA;
        pose.transformMatrix[5] = 1.0f;  // Y 轴保持
        pose.transformMatrix[8] = sinA;
        pose.transformMatrix[10] = cosA;
        pose.transformMatrix[15] = 1.0f; // 齐次坐标

        // 沿 Z 轴向屏幕内平移 0.5 米，方便我们在 3D 空间中观测到它
        pose.transformMatrix[14] = -0.5f; 

        return pose;
    }
};

// 绑定类到 WebAssembly 导出
EMSCRIPTEN_BINDINGS(my_tracker_module) {
    // 1. 必须先绑定这个 16 位的数组类型，给它一个 JS 这边的名字，比如 "Float16Array_Custom"
    emscripten::value_array<std::array<float, 16>>("Float16Array_Custom")
        .element(emscripten::index<0>())
        .element(emscripten::index<1>())
        .element(emscripten::index<2>())
        .element(emscripten::index<3>())
        .element(emscripten::index<4>())
        .element(emscripten::index<5>())
        .element(emscripten::index<6>())
        .element(emscripten::index<7>())
        .element(emscripten::index<8>())
        .element(emscripten::index<9>())
        .element(emscripten::index<10>())
        .element(emscripten::index<11>())
        .element(emscripten::index<12>())
        .element(emscripten::index<13>())
        .element(emscripten::index<14>())
        .element(emscripten::index<15>());

    emscripten::value_object<ARPose>("ARPose")
        .field("isTracking", &ARPose::isTracking)
        .field("transformMatrix", &ARPose::transformMatrix); // ✅ 正确的 std::array 绑定方式
        // .field("transformMatrix", emscripten::internal::TypeID<float[16]>()); // 绑定原生数组

    emscripten::class_<ARTracker>("ARTracker")
        .constructor<int, int>()
        .function("getBufferPointer", &ARTracker::getBufferPointer)
        .function("update", &ARTracker::update);
}