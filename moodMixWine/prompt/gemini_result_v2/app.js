/* app.js v2 - Based on Dynamic Prompts */
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const btnStart = document.getElementById('btn-start');
    const emotionInput = document.getElementById('emotion-input');
    
    // States
    const inputState = document.getElementById('input-state');
    const analysisState = document.getElementById('analysis-state');
    const viewMixing = document.getElementById('view-mixing');
    const viewResult = document.getElementById('view-result');
    
    const liquid = document.getElementById('liquid');
    const trackerBar = document.getElementById('tracker-bar');
    const statusText = document.getElementById('status-text');
    const btnRestart = document.getElementById('btn-restart');

    const phrases = [
        "接收心语：正在拆解文本情绪特征...",
        "感知意图：你的神经在此刻带有「紧绷感」...",
        "调和基调：注入深色调基酒沉淀思绪...",
        "萃取风味：提取迷迭香以抚平潜意识锋芒...",
        "AI 酿制进行中，融合冷暖意象...",
        "空间解构完毕，特调完成。"
    ];

    btnStart.addEventListener('click', () => {
        const text = emotionInput.value.trim();
        if(!text) {
            // Validation shake/color feedback
            emotionInput.style.borderColor = '#ef4444';
            setTimeout(() => emotionInput.style.borderColor = 'rgba(255,255,255,0.08)', 800);
            return;
        }

        // Transition from Input -> Analysis
        inputState.classList.remove('active');
        inputState.classList.add('hidden');
        
        setTimeout(() => {
            analysisState.classList.remove('hidden');
            analysisState.classList.add('active');
            startAnalysis();
        }, 400); // UI Pro Max recommended timing
    });

    let analysisInterval;
    let progressInterval;

    function startAnalysis() {
        // Trigger generic liquid mix
        liquid.classList.add('mixing');
        
        let step = 0;
        let progress = 30; // start at 30 logic
        
        // Dynamic progress visualization mapped to "EFI & EII" feeling from prompt
        progressInterval = setInterval(() => {
            // non-linear progression mirroring complexity computation
            const increment = Math.random() * 8 - 2; 
            progress += increment;
            
            if (progress > 95) progress = 95;
            if (progress < 10) progress = 10;
            
            trackerBar.style.width = progress + '%';
        }, 400);

        // Sequence semantic text logic
        analysisInterval = setInterval(() => {
            statusText.style.opacity = '0';
            
            setTimeout(() => {
                if (step < phrases.length) {
                    statusText.textContent = phrases[step];
                    statusText.style.opacity = '1';
                    
                    if (step === phrases.length - 1) {
                        // Finale setup
                        trackerBar.style.width = '100%';
                        trackerBar.style.backgroundColor = '#ec4899'; // Shift to active
                        clearInterval(progressInterval);
                        clearInterval(analysisInterval);
                        
                        setTimeout(() => showResult(), 1600);
                    }
                    step++;
                }
            }, 300); // text fade transition
        }, 2000); // 2 sec between phrases
    }

    function showResult() {
        viewMixing.classList.remove('active');
        viewMixing.classList.add('hidden');
        
        setTimeout(() => {
            viewResult.classList.remove('hidden');
            viewResult.classList.add('active');
        }, 400);
    }

    btnRestart.addEventListener('click', () => {
        // Reset full flow
        viewResult.classList.remove('active');
        viewResult.classList.add('hidden');
        
        setTimeout(() => {
            viewMixing.classList.remove('hidden');
            viewMixing.classList.add('active');
            
            analysisState.classList.remove('active');
            analysisState.classList.add('hidden');
            
            setTimeout(() => {
                inputState.classList.remove('hidden');
                inputState.classList.add('active');
                
                // Reset state parameters
                emotionInput.value = '';
                liquid.classList.remove('mixing');
                trackerBar.style.width = '50%';
                trackerBar.style.backgroundColor = '#fff';
                statusText.textContent = '提取情绪关键词中...';
            }, 400);
            
        }, 400);
    });
});
