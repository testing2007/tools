// app.js
document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btn-start');
    const btnRestart = document.getElementById('btn-restart');
    
    const viewMixing = document.getElementById('view-mixing');
    const viewResult = document.getElementById('view-result');
    
    const liquid = document.getElementById('liquid');
    const indicator = document.getElementById('tracker-indicator');
    const statusText = document.getElementById('status-text');
    const siriWave = document.getElementById('siri-wave');

    // Phrases that simulate real-time analysis
    const phrases = [
        "聆听你的语句...",
        "分析隐性压力与疲态...",
        "正在提取情绪基酒...",
        "调和冷暖色调中...",
        "寻找你的心底回甘...",
        "特调完成"
    ];

    let mixingInterval;
    let moveIndicator;

    btnStart.addEventListener('click', () => {
        // Change button state
        btnStart.style.opacity = '0.6';
        btnStart.style.pointerEvents = 'none';
        btnStart.style.transform = 'scale(0.98)';
        btnStart.textContent = '调制进行中...';
        
        // Start Animations
        liquid.classList.add('mixing');
        siriWave.classList.add('active');
        
        let step = 0;
        let pos = 50; // Initial indicator position

        // Simulate indicator wandering based on "mood processing"
        moveIndicator = setInterval(() => {
            // Random walk, tending towards the right (positive/mild)
            let delta = (Math.random() * 15 - 5); 
            pos += delta;
            
            // Bounds checking
            if (pos > 85) pos = 85;
            if (pos < 15) pos = 15;
            
            indicator.style.left = pos + '%';
        }, 600);

        // Sequence text phrases
        mixingInterval = setInterval(() => {
            statusText.style.opacity = '0';
            
            setTimeout(() => {
                if (step < phrases.length) {
                    statusText.textContent = phrases[step];
                    statusText.style.opacity = '1';
                    step++;
                }
                
                // End of mixing sequence
                if (step === phrases.length) {
                    clearInterval(mixingInterval);
                    clearInterval(moveIndicator);
                    indicator.style.left = '75%'; // Final position for "Midnight Cacao"
                    
                    setTimeout(() => {
                        showResultView();
                    }, 1200);
                }
            }, 400); // Wait for fade out
        }, 1800); // Inter-phrase timing
    });

    // Reset back to Mixing View
    btnRestart.addEventListener('click', () => {
        viewResult.classList.remove('active');
        viewResult.classList.add('hidden');
        
        setTimeout(() => {
            viewMixing.classList.remove('hidden');
            viewMixing.classList.add('active');
            
            // Reset state
            btnStart.style.opacity = '1';
            btnStart.style.pointerEvents = 'auto';
            btnStart.style.transform = 'scale(1)';
            btnStart.textContent = '开始调制特调情绪饮品';
            
            liquid.classList.remove('mixing');
            siriWave.classList.remove('active');
            indicator.style.left = '50%';
            
            statusText.style.opacity = '0';
            setTimeout(() => {
                statusText.textContent = '"感知情绪状态..."';
                statusText.style.opacity = '1';
            }, 400);

        }, 800);
    });

    function showResultView() {
        viewMixing.classList.remove('active');
        viewMixing.classList.add('hidden');
        
        setTimeout(() => {
            viewResult.classList.remove('hidden');
            viewResult.classList.add('active');
            
            // Force redraw animations if needed by removing and adding class, 
            // but CSS keyframes should handle it smoothly based on class toggling.
        }, 800);
    }
});
