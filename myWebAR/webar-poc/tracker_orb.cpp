#include <emscripten.h>
#include <emscripten/bind.h>
#include <opencv2/core.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/features2d.hpp>
#include <vector>
#include <array>
#include <algorithm>
#include <cmath>
#include <random>

struct ARPose {
    std::array<float, 16> transformMatrix;
    bool isTracking;
    int matchesCount;
    int inliersCount;
};

class ARTracker {
private:
    uint8_t* _pixelBuffer = nullptr;
    int _width, _height;

    cv::Mat _cameraMatrix;
    cv::Mat _cameraMatrixInv;
    cv::Ptr<cv::ORB> _orb;
    cv::Ptr<cv::BFMatcher> _matcher;

    cv::Mat _targetDescriptors;
    std::vector<cv::KeyPoint> _targetKeypoints;
    std::vector<float> _targetKeypointCoords;
    int _targetWidth = 0, _targetHeight = 0;

    float _physicalWidth  = 0.10f;
    float _physicalHeight = 0.15f;
    float _cylinderRadius = 0.035f;

    float _fx = 0.f, _fy = 0.f, _cx = 0.f, _cy = 0.f;
    float _hammingThreshold = 60.f;
    float _ratioThreshold   = 0.80f;

    // ─────────────────────────────────────────────────────────────────────────
    // Rodrigues 旋转公式辅助函数
    // ─────────────────────────────────────────────────────────────────────────

    // 旋转向量 (angle-axis) → 旋转矩阵
    cv::Mat _rodrigues(const cv::Mat& rvec) const {
        double theta = cv::norm(rvec);
        if (theta < 1e-10) return cv::Mat::eye(3, 3, CV_64F);
        double rx = rvec.at<double>(0) / theta;
        double ry = rvec.at<double>(1) / theta;
        double rz = rvec.at<double>(2) / theta;
        double c = std::cos(theta), s = std::sin(theta), mc = 1.0 - c;
        return (cv::Mat_<double>(3, 3) <<
            c + rx*rx*mc,     rx*ry*mc - rz*s, rx*rz*mc + ry*s,
            ry*rx*mc + rz*s,  c + ry*ry*mc,    ry*rz*mc - rx*s,
            rz*rx*mc - ry*s,  rz*ry*mc + rx*s, c + rz*rz*mc);
    }

    // 旋转矩阵 → 旋转向量
    cv::Mat _toRodrigues(const cv::Mat& R) const {
        double trace = R.at<double>(0,0) + R.at<double>(1,1) + R.at<double>(2,2);
        double costheta = std::max(-1.0, std::min(1.0, (trace - 1.0) / 2.0));
        double theta = std::acos(costheta);
        cv::Mat rvec = cv::Mat::zeros(3, 1, CV_64F);
        if (theta > 1e-8) {
            double s2 = 2.0 * std::sin(theta);
            rvec.at<double>(0) = theta * (R.at<double>(2,1) - R.at<double>(1,2)) / s2;
            rvec.at<double>(1) = theta * (R.at<double>(0,2) - R.at<double>(2,0)) / s2;
            rvec.at<double>(2) = theta * (R.at<double>(1,0) - R.at<double>(0,1)) / s2;
        }
        return rvec;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gauss-Newton 迭代精化 (等效于 solvePnP ITERATIVE 模式)
    //
    // 最小化内点集合的重投影误差 Σ ||p_i - proj(R,t,P_i)||^2
    // 参数化：pose = [rvec(3), tvec(3)]，共 6 自由度
    //
    // Jacobian 推导（左扰动模型，Rodrigues 指数映射）：
    //   P_c = R*P_w + t,  u = fx*Xc/Zc + cx,  v = fy*Yc/Zc + cy
    //   ∂u/∂r = [-fx·Xc·Yc/Zc²,  fx·(1+Xc²/Zc²),  -fx·Yc/Zc]
    //   ∂v/∂r = [-fy·(1+Yc²/Zc²), fy·Xc·Yc/Zc²,    fy·Xc/Zc]
    //   ∂u/∂t = [fx/Zc, 0, -fx·Xc/Zc²]
    //   ∂v/∂t = [0, fy/Zc, -fy·Yc/Zc²]
    // ─────────────────────────────────────────────────────────────────────────
    void _refineGaussNewton(const std::vector<cv::Point3f>& src3D,
                            const std::vector<cv::Point2f>& dst2D,
                            const std::vector<int>& inliers,
                            cv::Mat& R, cv::Mat& t) const {
        int n = (int)inliers.size();
        if (n < 6 || !cv::checkRange(R, true) || !cv::checkRange(t, true)) return;

        cv::Mat rvec = _toRodrigues(R);

        for (int iter = 0; iter < 20; iter++) {
            cv::Mat J = cv::Mat::zeros(2 * n, 6, CV_64F);
            cv::Mat e = cv::Mat::zeros(2 * n, 1, CV_64F);

            bool valid = true;
            for (int k = 0; k < n; k++) {
                int idx = inliers[k];
                cv::Mat Pw = (cv::Mat_<double>(3, 1) <<
                    src3D[idx].x, src3D[idx].y, src3D[idx].z);
                cv::Mat Pc = R * Pw + t;
                double Xc = Pc.at<double>(0), Yc = Pc.at<double>(1), Zc = Pc.at<double>(2);
                if (Zc < 0.01) { valid = false; break; }

                double iz  = 1.0 / Zc;
                double iz2 = iz * iz;

                // 残差 e = p_measured - p_projected
                e.at<double>(2*k)   = dst2D[idx].x - (_fx * Xc * iz + _cx);
                e.at<double>(2*k+1) = dst2D[idx].y - (_fy * Yc * iz + _cy);

                // ∂[u,v]/∂rvec (旋转 Jacobian)
                J.at<double>(2*k,   0) = -_fx * Xc * Yc * iz2;
                J.at<double>(2*k,   1) =  _fx * (1.0 + Xc * Xc * iz2);
                J.at<double>(2*k,   2) = -_fx * Yc * iz;
                J.at<double>(2*k+1, 0) = -_fy * (1.0 + Yc * Yc * iz2);
                J.at<double>(2*k+1, 1) =  _fy * Xc * Yc * iz2;
                J.at<double>(2*k+1, 2) =  _fy * Xc * iz;

                // ∂[u,v]/∂tvec (平移 Jacobian)
                J.at<double>(2*k,   3) =  _fx * iz;
                J.at<double>(2*k,   4) =  0.0;
                J.at<double>(2*k,   5) = -_fx * Xc * iz2;
                J.at<double>(2*k+1, 3) =  0.0;
                J.at<double>(2*k+1, 4) =  _fy * iz;
                J.at<double>(2*k+1, 5) = -_fy * Yc * iz2;
            }
            if (!valid) break;

            // 正规方程 (J^T J + λI) δ = J^T e (LM 阻尼，提升数值稳定性)
            cv::Mat JtJ = J.t() * J;
            for (int i = 0; i < 6; i++) JtJ.at<double>(i, i) *= 1.01;

            cv::Mat delta;
            if (!cv::solve(JtJ, J.t() * e, delta, cv::DECOMP_SVD)) break;
            if (!cv::checkRange(delta, true)) break;

            // 更新姿态参数
            rvec += delta.rowRange(0, 3);
            t    += delta.rowRange(3, 6);
            R = _rodrigues(rvec);

            // 收敛检查
            if (cv::norm(delta) < 1e-7) break;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gold Standard 归一化 DLT 求解器 (n ≥ 6 对应关系)
    // ─────────────────────────────────────────────────────────────────────────

    cv::Mat _normT3D(const std::vector<cv::Point3f>& pts) const {
        int n = (int)pts.size();
        double cx = 0, cy = 0, cz = 0;
        for (const auto& p : pts) { cx += p.x; cy += p.y; cz += p.z; }
        cx /= n; cy /= n; cz /= n;
        double d = 0;
        for (const auto& p : pts) {
            double dx = p.x-cx, dy = p.y-cy, dz = p.z-cz;
            d += std::sqrt(dx*dx + dy*dy + dz*dz);
        }
        d /= n;
        double s = (d > 1e-9) ? std::sqrt(3.0) / d : 1.0;
        cv::Mat T = cv::Mat::eye(4, 4, CV_64F);
        T.at<double>(0,0) = s; T.at<double>(0,3) = -s*cx;
        T.at<double>(1,1) = s; T.at<double>(1,3) = -s*cy;
        T.at<double>(2,2) = s; T.at<double>(2,3) = -s*cz;
        return T;
    }

    cv::Mat _normT2D(const std::vector<cv::Point2f>& pts) const {
        int n = (int)pts.size();
        double cu = 0, cv_c = 0;
        for (const auto& p : pts) { cu += p.x; cv_c += p.y; }
        cu /= n; cv_c /= n;
        double d = 0;
        for (const auto& p : pts) {
            double du = p.x-cu, dv = p.y-cv_c;
            d += std::sqrt(du*du + dv*dv);
        }
        d /= n;
        double s = (d > 1e-9) ? std::sqrt(2.0) / d : 1.0;
        cv::Mat T = cv::Mat::eye(3, 3, CV_64F);
        T.at<double>(0,0) = s; T.at<double>(0,2) = -s*cu;
        T.at<double>(1,1) = s; T.at<double>(1,2) = -s*cv_c;
        return T;
    }

    cv::Mat _solveDLT(const std::vector<cv::Point3f>& src3,
                      const std::vector<cv::Point2f>& src2) const {
        int n = (int)src3.size();
        if (n < 6) return cv::Mat();
        for (int i = 0; i < n; i++) {
            if (!std::isfinite(src3[i].x) || !std::isfinite(src3[i].y) || !std::isfinite(src3[i].z) ||
                !std::isfinite(src2[i].x) || !std::isfinite(src2[i].y)) return cv::Mat();
        }

        cv::Mat T3 = _normT3D(src3), T2 = _normT2D(src2);
        double s3  = T3.at<double>(0,0);
        double t3x = T3.at<double>(0,3), t3y = T3.at<double>(1,3), t3z = T3.at<double>(2,3);
        double s2  = T2.at<double>(0,0);
        double t2u = T2.at<double>(0,2), t2v = T2.at<double>(1,2);

        cv::Mat A = cv::Mat::zeros(2*n, 12, CV_64F);
        for (int i = 0; i < n; i++) {
            double X = s3*src3[i].x + t3x, Y = s3*src3[i].y + t3y, Z = s3*src3[i].z + t3z;
            double U = s2*src2[i].x + t2u, V = s2*src2[i].y + t2v;
            double* r0 = A.ptr<double>(2*i);
            r0[0]=-X; r0[1]=-Y; r0[2]=-Z; r0[3]=-1.0;
            r0[8]=X*U; r0[9]=Y*U; r0[10]=Z*U; r0[11]=U;
            double* r1 = A.ptr<double>(2*i+1);
            r1[4]=-X; r1[5]=-Y; r1[6]=-Z; r1[7]=-1.0;
            r1[8]=X*V; r1[9]=Y*V; r1[10]=Z*V; r1[11]=V;
        }
        if (!cv::checkRange(A, true)) return cv::Mat();

        cv::Mat w, u_mat, vt;
        cv::SVD::compute(A, w, u_mat, vt);
        if (!cv::checkRange(vt, true) || vt.rows < 12) return cv::Mat();

        cv::Mat P_norm = vt.row(11).reshape(1, 3);
        cv::Mat P = T2.inv() * P_norm * T3;

        double p34 = P.at<double>(2, 3);
        if (std::abs(p34) > 1e-8) P = P / p34;
        if (!cv::checkRange(P, true)) return cv::Mat();
        return P;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RANSAC + 归一化 DLT + Gauss-Newton 精化 完整管线
    // ─────────────────────────────────────────────────────────────────────────

    // 从 DLT G 矩阵提取初始 R, t
    bool _extractRt(const cv::Mat& G, cv::Mat& R, cv::Mat& t) const {
        if (G.empty()) return false;
        cv::Mat g1 = G.col(0), g2 = G.col(1), g3 = G.col(2), g4 = G.col(3);
        double n1 = cv::norm(g1), n2 = cv::norm(g2), n3 = cv::norm(g3);
        if (n1 < 1e-8 || n2 < 1e-8 || n3 < 1e-8) return false;

        double scale = 3.0 / (n1 + n2 + n3);
        R.create(3, 3, CV_64F);
        cv::Mat c0 = g1 * scale, c1 = g2 * scale, c2 = g3 * scale;
        c0.copyTo(R.col(0));
        c1.copyTo(R.col(1));
        c2.copyTo(R.col(2));
        t = g4 * scale;

        // 投影到 SO(3)
        cv::Mat w, u, vt;
        cv::SVD::compute(R, w, u, vt);
        R = u * vt;
        if (cv::determinant(R) < 0) { u.col(2) = -u.col(2); R = u * vt; }

        return cv::checkRange(R, true) && cv::checkRange(t, true);
    }

    bool _ransacAndRefine(const std::vector<cv::Point3f>& src,
                          const std::vector<cv::Point2f>& dst,
                          const std::vector<cv::Point2f>& dst_norm,
                          std::vector<int>& bestInliers,
                          cv::Mat& outR, cv::Mat& outT,
                          double threshold = 8.0) {
        int n = (int)src.size();
        bestInliers.clear();
        if (n < 6) return false;

        int maxIter = 200;
        int bestCount = 0;
        cv::Mat bestG;

        std::mt19937 gen(std::random_device{}());
        std::uniform_int_distribution<> dis(0, n - 1);

        for (int iter = 0; iter < maxIter; ++iter) {
            // 随机采样 6 个点
            std::vector<int> idx;
            idx.reserve(6);
            for (int att = 0; (int)idx.size() < 6 && att < 60; att++) {
                int r = dis(gen);
                if (std::find(idx.begin(), idx.end(), r) == idx.end()) idx.push_back(r);
            }
            if ((int)idx.size() < 6) continue;

            std::vector<cv::Point3f> ss(6); std::vector<cv::Point2f> sd(6);
            for (int i = 0; i < 6; i++) { ss[i] = src[idx[i]]; sd[i] = dst_norm[idx[i]]; }

            cv::Mat G = _solveDLT(ss, sd);
            if (G.empty()) continue;

            // 统计内点
            std::vector<int> cur;
            for (int i = 0; i < n; i++) {
                cv::Mat pt = (cv::Mat_<double>(4,1) << src[i].x, src[i].y, src[i].z, 1.0);
                cv::Mat proj = G * pt;
                double ww = proj.at<double>(2, 0);
                if (ww <= 0.01) continue;
                double pu = proj.at<double>(0,0)/ww * _fx + _cx;
                double pv = proj.at<double>(1,0)/ww * _fy + _cy;
                double err = std::sqrt((pu-dst[i].x)*(pu-dst[i].x) + (pv-dst[i].y)*(pv-dst[i].y));
                if (err < threshold) cur.push_back(i);
            }
            if ((int)cur.size() > bestCount) { bestCount = (int)cur.size(); bestInliers = cur; bestG = G; }
        }

        if (bestCount < 6) return false;

        // 用所有内点过约束精化 DLT
        {
            std::vector<cv::Point3f> is; std::vector<cv::Point2f> id;
            for (int i : bestInliers) { is.push_back(src[i]); id.push_back(dst_norm[i]); }
            cv::Mat rG = _solveDLT(is, id);
            if (!rG.empty()) bestG = rG;
        }

        // 提取初始 R, t
        if (!_extractRt(bestG, outR, outT)) return false;

        // ★ Gauss-Newton 迭代精化（等效 solvePnP ITERATIVE）
        _refineGaussNewton(src, dst, bestInliers, outR, outT);

        return cv::checkRange(outR, true) && cv::checkRange(outT, true);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 构建 Three.js 列主序 4×4 矩阵（OpenCV → Three.js 坐标系转换）
    // OpenCV: X右 Y下 Z前 → Three.js: X右 Y上 Z向观察者
    // ─────────────────────────────────────────────────────────────────────────
    bool _buildPose(const cv::Mat& R, const cv::Mat& t, ARPose& pose) const {
        if (!cv::checkRange(R, true) || !cv::checkRange(t, true)) return false;
        double tz = t.at<double>(2, 0);
        if (tz <= 0.03 || tz >= 3.0) return false;

        double r[3][3];
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                r[i][j] = R.at<double>(i, j);

        double tx = t.at<double>(0, 0), ty = t.at<double>(1, 0);
        if (!std::isfinite(tx) || !std::isfinite(ty) || !std::isfinite(tz)) return false;

        // 翻转 Y/Z 轴，从 OpenCV 相机坐标系转换到 Three.js 世界坐标系
        pose.transformMatrix[0]  = (float) r[0][0]; pose.transformMatrix[1]  = (float)-r[1][0];
        pose.transformMatrix[2]  = (float)-r[2][0]; pose.transformMatrix[3]  = 0.f;
        pose.transformMatrix[4]  = (float) r[0][1]; pose.transformMatrix[5]  = (float)-r[1][1];
        pose.transformMatrix[6]  = (float)-r[2][1]; pose.transformMatrix[7]  = 0.f;
        pose.transformMatrix[8]  = (float) r[0][2]; pose.transformMatrix[9]  = (float)-r[1][2];
        pose.transformMatrix[10] = (float)-r[2][2]; pose.transformMatrix[11] = 0.f;
        pose.transformMatrix[12] = (float) tx;      pose.transformMatrix[13] = (float)-ty;
        pose.transformMatrix[14] = (float)-tz;      pose.transformMatrix[15] = 1.f;
        pose.isTracking = true;
        return true;
    }

public:
    ARTracker(int width, int height, float fx, float fy, float cx, float cy)
        : _width(width), _height(height), _fx(fx), _fy(fy), _cx(cx), _cy(cy) {
        _pixelBuffer = new uint8_t[width * height * 4];
        _cameraMatrix = (cv::Mat_<double>(3,3) << fx, 0, cx, 0, fy, cy, 0, 0, 1);
        _cameraMatrixInv = _cameraMatrix.inv();
        if (!cv::checkRange(_cameraMatrixInv, true)) _cameraMatrixInv = cv::Mat::eye(3, 3, CV_64F);

        _orb = cv::ORB::create(2000, 1.3f, 10, 31, 0, 2, cv::ORB::FAST_SCORE, 31, 20);
        _matcher = cv::BFMatcher::create(cv::NORM_HAMMING, false);
    }

    ~ARTracker() { delete[] _pixelBuffer; }

    intptr_t getBufferPointer() { return reinterpret_cast<intptr_t>(_pixelBuffer); }

    void setCameraFOV(float fovDeg, int fw, int fh) {
        if (fovDeg <= 0.f || fovDeg >= 180.f) return;
        _fx = (fw / 2.0f) / std::tan(fovDeg * (float)M_PI / 360.0f);
        _fy = _fx; _cx = fw / 2.0f; _cy = fh / 2.0f;
        _cameraMatrix = (cv::Mat_<double>(3,3) << _fx, 0, _cx, 0, _fy, _cy, 0, 0, 1);
        cv::Mat inv = _cameraMatrix.inv();
        _cameraMatrixInv = cv::checkRange(inv, true) ? inv : cv::Mat::eye(3, 3, CV_64F);
    }

    bool initTarget(intptr_t bufPtr, int w, int h, float pw, float ph) {
        _targetWidth = w; _targetHeight = h; _physicalWidth = pw; _physicalHeight = ph;
        uint8_t* raw = reinterpret_cast<uint8_t*>(bufPtr);
        cv::Mat rgba(h, w, CV_8UC4, raw);
        cv::Mat gray; cv::cvtColor(rgba, gray, cv::COLOR_RGBA2GRAY);
        _targetKeypoints.clear();
        _orb->detectAndCompute(gray, cv::noArray(), _targetKeypoints, _targetDescriptors);
        return (int)_targetKeypoints.size() >= 15;
    }

    ARPose update() {
        ARPose pose;
        pose.isTracking = false; pose.matchesCount = 0; pose.inliersCount = 0;
        pose.transformMatrix.fill(0.f);

        if (_targetKeypoints.empty() || _targetDescriptors.empty()) return pose;

        cv::Mat frameRGBA(_height, _width, CV_8UC4, _pixelBuffer);
        cv::Mat frameGray; cv::cvtColor(frameRGBA, frameGray, cv::COLOR_RGBA2GRAY);

        std::vector<cv::KeyPoint> frameKP; cv::Mat frameDesc;
        _orb->detectAndCompute(frameGray, cv::noArray(), frameKP, frameDesc);
        if (frameDesc.empty() || frameDesc.rows < 10) return pose;
        if (!cv::checkRange(_targetDescriptors, true) || !cv::checkRange(frameDesc, true)) return pose;

        std::vector<std::vector<cv::DMatch>> knnMatches;
        _matcher->knnMatch(_targetDescriptors, frameDesc, knnMatches, 2);

        std::vector<bool> usedTrain(frameKP.size(), false);
        std::vector<cv::Point3f> srcPts3D;
        std::vector<cv::Point2f> dstPts, dstPtsNorm;

        for (const auto& mg : knnMatches) {
            if (mg.size() < 2) continue;
            const auto& m1 = mg[0], &m2 = mg[1];
            if (m1.distance >= _hammingThreshold) continue;
            if (m1.distance >= _ratioThreshold * m2.distance) continue;
            if (usedTrain[m1.trainIdx]) continue;

            cv::Point2f tPt = _targetKeypoints[m1.queryIdx].pt;
            cv::Point2f fPt = frameKP[m1.trainIdx].pt;
            if (!std::isfinite(tPt.x) || !std::isfinite(fPt.x)) continue;

            float xp = (tPt.x / _targetWidth  - 0.5f) * _physicalWidth;
            float yp = (0.5f - tPt.y / _targetHeight) * _physicalHeight;
            if (!std::isfinite(xp) || !std::isfinite(yp)) continue;

            float X, Y, Z;
            if (_cylinderRadius > 0.f) {
                float theta = xp / _cylinderRadius;
                X = _cylinderRadius * std::sin(theta);
                Y = yp;
                Z = _cylinderRadius * std::cos(theta) - _cylinderRadius;
            } else { X = xp; Y = yp; Z = 0.f; }

            usedTrain[m1.trainIdx] = true;
            srcPts3D.push_back({X, Y, Z});
            dstPts.push_back(fPt);
            dstPtsNorm.push_back({(fPt.x - _cx) / _fx, (fPt.y - _cy) / _fy});
        }

        pose.matchesCount = (int)srcPts3D.size();
        if (pose.matchesCount < 10) return pose;

        std::vector<int> inliers;
        cv::Mat R, t;
        if (!_ransacAndRefine(srcPts3D, dstPts, dstPtsNorm, inliers, R, t, 8.0)) return pose;

        pose.inliersCount = (int)inliers.size();
        double ratio = (double)inliers.size() / srcPts3D.size();
        if ((int)inliers.size() >= 8 && ratio >= 0.20) {
            _buildPose(R, t, pose);
        }
        return pose;
    }

    void setCylinderRadius(float r)  { _cylinderRadius   = r; }
    void setHammingThreshold(float t){ _hammingThreshold = t; }
    void setRatioThreshold(float t)  { _ratioThreshold   = t; }
    int  getTargetKeypointCount()    { return (int)_targetKeypoints.size(); }

    intptr_t getTargetKeypointsPointer() {
        _targetKeypointCoords.clear();
        _targetKeypointCoords.reserve(_targetKeypoints.size() * 4);
        for (const auto& kp : _targetKeypoints) {
            _targetKeypointCoords.push_back(kp.pt.x);
            _targetKeypointCoords.push_back(kp.pt.y);
            _targetKeypointCoords.push_back(kp.size);
            _targetKeypointCoords.push_back(kp.angle);
        }
        return reinterpret_cast<intptr_t>(_targetKeypointCoords.data());
    }
};

EMSCRIPTEN_BINDINGS(orb_tracker_module) {
    emscripten::value_array<std::array<float, 16>>("Float16Array_Custom")
        .element(emscripten::index<0>()) .element(emscripten::index<1>())
        .element(emscripten::index<2>()) .element(emscripten::index<3>())
        .element(emscripten::index<4>()) .element(emscripten::index<5>())
        .element(emscripten::index<6>()) .element(emscripten::index<7>())
        .element(emscripten::index<8>()) .element(emscripten::index<9>())
        .element(emscripten::index<10>()).element(emscripten::index<11>())
        .element(emscripten::index<12>()).element(emscripten::index<13>())
        .element(emscripten::index<14>()).element(emscripten::index<15>());

    emscripten::value_object<ARPose>("ARPose")
        .field("isTracking",      &ARPose::isTracking)
        .field("transformMatrix", &ARPose::transformMatrix)
        .field("matchesCount",    &ARPose::matchesCount)
        .field("inliersCount",    &ARPose::inliersCount);

    emscripten::class_<ARTracker>("ARTracker")
        .constructor<int, int, float, float, float, float>()
        .function("getBufferPointer",         &ARTracker::getBufferPointer)
        .function("initTarget",               &ARTracker::initTarget)
        .function("update",                   &ARTracker::update)
        .function("setCylinderRadius",        &ARTracker::setCylinderRadius)
        .function("setHammingThreshold",      &ARTracker::setHammingThreshold)
        .function("setRatioThreshold",        &ARTracker::setRatioThreshold)
        .function("setCameraFOV",             &ARTracker::setCameraFOV)
        .function("getTargetKeypointCount",   &ARTracker::getTargetKeypointCount)
        .function("getTargetKeypointsPointer",&ARTracker::getTargetKeypointsPointer);
}
