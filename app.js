// DOM elements
const fileDropArea = document.getElementById('fileDropArea');
const fileInput = document.getElementById('fileInput');
const animationPreview = document.getElementById('animationPreview');
const previewBtn = document.getElementById('previewBtn');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');

// Animation controls
const animationType = document.getElementById('animationType');
const duration = document.getElementById('duration');
const delay = document.getElementById('delay');
const easing = document.getElementById('easing');
const repeat = document.getElementById('repeat');

// Export controls
const widthInput = document.getElementById('width');
const heightInput = document.getElementById('height');
const fpsInput = document.getElementById('fps');
const backgroundColor = document.getElementById('backgroundColor');
const transparentBg = document.getElementById('transparentBg');

// Global variables
let svgElement = null;
let originalSvgContent = null;
let svgDoc = null;
let svgPaths = null;
let svgStrokes = null;
let svgSize = { width: 0, height: 0 };
let animationInterval = null;
let animating = false;
let ffmpeg = null;

// Initialize FFmpeg
async function initFFmpeg() {
    try {
        // Check if SharedArrayBuffer is available
        if (typeof SharedArrayBuffer === 'undefined') {
            console.warn('SharedArrayBuffer is not available - video export will not work');
            const warningDiv = document.createElement('div');
            warningDiv.className = 'warning-banner';
            warningDiv.textContent = 'Video export requires secure context (HTTPS or localhost with proper headers). Use the provided server.js to run the application.';
            document.body.insertBefore(warningDiv, document.body.firstChild);
            
            // Disable export button
            exportBtn.disabled = true;
            exportBtn.title = 'Export is not available - SharedArrayBuffer not supported';
            return;
        }
        
        ffmpeg = createFFmpeg({ log: true });
        await ffmpeg.load();
        console.log('FFmpeg loaded');
    } catch (error) {
        console.error('Error loading FFmpeg:', error);
        alert('Failed to load video export functionality: ' + error.message + '\n\nPlease run this application using the included server.js for full functionality.');
        
        // Disable export button on error
        exportBtn.disabled = true;
        exportBtn.title = 'Export is not available - FFmpeg failed to load';
    }
}

// Initialize the application
async function init() {
    setupEventListeners();
    await initFFmpeg();
}

// Set up event listeners
function setupEventListeners() {
    // File drop area events
    fileDropArea.addEventListener('click', () => fileInput.click());
    fileDropArea.addEventListener('dragover', handleDragOver);
    fileDropArea.addEventListener('dragleave', handleDragLeave);
    fileDropArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    // Button events
    previewBtn.addEventListener('click', previewAnimation);
    exportBtn.addEventListener('click', exportAnimation);
    resetBtn.addEventListener('click', resetAnimation);
    
    // Animation type change
    animationType.addEventListener('change', updateControlsVisibility);
    
    // Background color toggle
    transparentBg.addEventListener('change', () => {
        backgroundColor.disabled = transparentBg.checked;
    });
}

// Handle drag over event
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.add('dragover');
}

// Handle drag leave event
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.remove('dragover');
}

// Handle file drop event
function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    fileDropArea.classList.remove('dragover');
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
}

// Handle file select event
function handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

// Process the uploaded SVG file
function handleFile(file) {
    if (file.type !== 'image/svg+xml') {
        alert('Please upload an SVG file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        originalSvgContent = e.target.result;
        loadSVG(originalSvgContent);
    };
    reader.readAsText(file);
}

// Load SVG into the preview area
function loadSVG(svgContent) {
    // Clear previous content
    animationPreview.innerHTML = '';
    
    // Parse SVG
    const parser = new DOMParser();
    svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
    svgElement = svgDoc.documentElement;
    
    // Get SVG size
    svgSize.width = parseFloat(svgElement.getAttribute('width') || 100);
    svgSize.height = parseFloat(svgElement.getAttribute('height') || 100);
    
    // Set dimensions in export options
    widthInput.value = Math.round(svgSize.width);
    heightInput.value = Math.round(svgSize.height);
    
    // Find all paths and elements with strokes
    svgPaths = Array.from(svgElement.querySelectorAll('path'));
    svgStrokes = Array.from(svgElement.querySelectorAll('[stroke]')).filter(el => el.getAttribute('stroke') !== 'none');
    
    // Clone SVG and add to preview
    const svgClone = svgElement.cloneNode(true);
    animationPreview.appendChild(svgClone);
    
    // Adjust SVG to fit preview
    fitSVGToContainer(svgClone);
    
    // Enable export button only if ffmpeg is loaded and paths or strokes exist
    const hasContent = svgPaths.length > 0 || svgStrokes.length > 0;
    const isFFmpegReady = ffmpeg && (ffmpeg.isLoaded ? ffmpeg.isLoaded() : false);
    exportBtn.disabled = !(hasContent && isFFmpegReady);
    
    // Update controls based on SVG content
    updateControlsVisibility();
}

// Fit SVG to container maintaining aspect ratio
function fitSVGToContainer(svgElement) {
    const containerWidth = animationPreview.clientWidth;
    const containerHeight = animationPreview.clientHeight;
    
    const scaleX = containerWidth / svgSize.width;
    const scaleY = containerHeight / svgSize.height;
    const scale = Math.min(scaleX, scaleY) * 0.8; // 80% of container
    
    const newWidth = svgSize.width * scale;
    const newHeight = svgSize.height * scale;
    
    svgElement.setAttribute('width', newWidth);
    svgElement.setAttribute('height', newHeight);
    svgElement.style.margin = 'auto';
}

// Update controls visibility based on animation type
function updateControlsVisibility() {
    const isPathAnimation = animationType.value === 'path';
    
    // Additional controls specific to path or stroke animation can be added here
    // This is a placeholder for future expansion
}

// Preview the animation
function previewAnimation() {
    if (animating) {
        stopAnimation();
        return;
    }
    
    if (!svgElement) {
        alert('Please upload an SVG file first.');
        return;
    }
    
    // Clone the original SVG for animation
    animationPreview.innerHTML = '';
    const svgClone = createSVGFromContent(originalSvgContent);
    animationPreview.appendChild(svgClone);
    fitSVGToContainer(svgClone);
    
    // Start animation
    const isPathAnimation = animationType.value === 'path';
    const durationValue = parseFloat(duration.value) * 1000; // Convert to ms
    const delayValue = parseFloat(delay.value) * 1000; // Convert to ms
    const easingValue = easing.value;
    const repeatValue = parseInt(repeat.value);
    
    animating = true;
    previewBtn.textContent = 'Stop Preview';
    
    if (isPathAnimation) {
        animatePaths(svgClone, durationValue, delayValue, easingValue, repeatValue);
    } else {
        animateStrokes(svgClone, durationValue, delayValue, easingValue, repeatValue);
    }
}

// Stop the animation
function stopAnimation() {
    animating = false;
    previewBtn.textContent = 'Preview Animation';
    
    // Clean up any ongoing animations
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
    
    // Reset to original state
    if (originalSvgContent) {
        animationPreview.innerHTML = '';
        const svgClone = createSVGFromContent(originalSvgContent);
        animationPreview.appendChild(svgClone);
        fitSVGToContainer(svgClone);
    }
}

// Reset everything
function resetAnimation() {
    stopAnimation();
    animationPreview.innerHTML = '';
    svgElement = null;
    originalSvgContent = null;
    svgDoc = null;
    svgPaths = null;
    svgStrokes = null;
    exportBtn.disabled = true;
    
    // Reset form values
    duration.value = 2;
    delay.value = 0;
    easing.value = 'linear';
    repeat.value = 0;
    widthInput.value = 800;
    heightInput.value = 600;
    fpsInput.value = 24;
    backgroundColor.value = '#ffffff';
    transparentBg.checked = true;
    backgroundColor.disabled = true;
}

// Create an SVG element from content string
function createSVGFromContent(content) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'image/svg+xml');
    return doc.documentElement;
}

// Animate SVG paths
function animatePaths(svg, duration, delay, easingType, repeatCount) {
    const paths = Array.from(svg.querySelectorAll('path'));
    if (paths.length === 0) {
        alert('No paths found in the SVG.');
        stopAnimation();
        return;
    }
    
    paths.forEach(path => {
        // Save original length for animation
        if (!path.getTotalLength) {
            console.warn('SVG path does not support getTotalLength method.');
            return;
        }
        
        const pathLength = path.getTotalLength();
        
        // Set up initial state
        path.style.strokeDasharray = pathLength;
        path.style.strokeDashoffset = pathLength;
        path.style.opacity = 1;
        
        // Animate
        const startTime = performance.now() + delay;
        let iteration = 0;
        
        function animate(timestamp) {
            if (!animating) return;
            
            if (timestamp < startTime) {
                requestAnimationFrame(animate);
                return;
            }
            
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            let easedProgress;
            
            // Apply easing
            switch (easingType) {
                case 'easeIn':
                    easedProgress = progress * progress;
                    break;
                case 'easeOut':
                    easedProgress = 1 - Math.pow(1 - progress, 2);
                    break;
                case 'easeInOut':
                    easedProgress = progress < 0.5 
                        ? 2 * progress * progress 
                        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                    break;
                default: // linear
                    easedProgress = progress;
            }
            
            // Apply the animation
            path.style.strokeDashoffset = pathLength * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (repeatCount === 0 || iteration < repeatCount - 1) {
                // Repeat if needed
                iteration++;
                path.style.strokeDashoffset = pathLength; // Reset
                setTimeout(() => requestAnimationFrame(animate), 0);
            } else if (iteration >= repeatCount - 1 && repeatCount !== 0) {
                // End of animation
                path.style.strokeDashoffset = 0;
                if (paths.indexOf(path) === paths.length - 1) {
                    stopAnimation();
                }
            }
        }
        
        requestAnimationFrame(animate);
    });
}

// Animate SVG strokes
function animateStrokes(svg, duration, delay, easingType, repeatCount) {
    const elements = Array.from(svg.querySelectorAll('[stroke]'))
        .filter(el => el.getAttribute('stroke') !== 'none');
    
    if (elements.length === 0) {
        alert('No stroked elements found in the SVG.');
        stopAnimation();
        return;
    }
    
    elements.forEach(element => {
        // Get the total length for line animation (works on any stroked element)
        let pathLength = 0;
        
        if (element.getTotalLength) {
            // For path elements and some SVG elements
            pathLength = element.getTotalLength();
        } else {
            // For other elements like rect, circle, etc.
            // Create a temporary path to get the perimeter/length
            try {
                // Create a path that follows the shape outline
                const bbox = element.getBBox();
                if (element.tagName.toLowerCase() === 'rect') {
                    const tempPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    const x = parseFloat(element.getAttribute('x') || 0);
                    const y = parseFloat(element.getAttribute('y') || 0);
                    const width = parseFloat(element.getAttribute('width'));
                    const height = parseFloat(element.getAttribute('height'));
                    tempPath.setAttribute('d', `M${x},${y} L${x+width},${y} L${x+width},${y+height} L${x},${y+height} Z`);
                    svg.appendChild(tempPath);
                    pathLength = tempPath.getTotalLength();
                    svg.removeChild(tempPath);
                } else if (element.tagName.toLowerCase() === 'circle') {
                    const r = parseFloat(element.getAttribute('r'));
                    pathLength = 2 * Math.PI * r;
                } else if (element.tagName.toLowerCase() === 'line') {
                    const x1 = parseFloat(element.getAttribute('x1') || 0);
                    const y1 = parseFloat(element.getAttribute('y1') || 0);
                    const x2 = parseFloat(element.getAttribute('x2') || 0);
                    const y2 = parseFloat(element.getAttribute('y2') || 0);
                    pathLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                } else {
                    // For other elements, get approximate length from bounding box perimeter
                    pathLength = 2 * (bbox.width + bbox.height);
                }
            } catch (e) {
                console.warn('Could not calculate length for element', element, e);
                // Default to a reasonable value
                pathLength = 100;
            }
        }
        
        // Set up initial state for line drawing animation
        element.style.strokeDasharray = pathLength;
        element.style.strokeDashoffset = pathLength;
        element.style.opacity = 1;
        
        // Keep track of original stroke width
        const originalStrokeWidth = element.getAttribute('stroke-width') || 1;
        element.style.strokeWidth = originalStrokeWidth;
        
        // Animate
        const startTime = performance.now() + delay;
        let iteration = 0;
        
        function animate(timestamp) {
            if (!animating) return;
            
            if (timestamp < startTime) {
                requestAnimationFrame(animate);
                return;
            }
            
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            let easedProgress;
            
            // Apply easing
            switch (easingType) {
                case 'easeIn':
                    easedProgress = progress * progress;
                    break;
                case 'easeOut':
                    easedProgress = 1 - Math.pow(1 - progress, 2);
                    break;
                case 'easeInOut':
                    easedProgress = progress < 0.5 
                        ? 2 * progress * progress 
                        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                    break;
                default: // linear
                    easedProgress = progress;
            }
            
            // Apply the animation (draw the line from start to end)
            element.style.strokeDashoffset = pathLength * (1 - easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (repeatCount === 0 || iteration < repeatCount - 1) {
                // Repeat if needed
                iteration++;
                element.style.strokeDashoffset = pathLength; // Reset
                setTimeout(() => requestAnimationFrame(animate), 0);
            } else if (iteration >= repeatCount - 1 && repeatCount !== 0) {
                // End of animation
                element.style.strokeDashoffset = 0;
                if (elements.indexOf(element) === elements.length - 1) {
                    stopAnimation();
                }
            }
        }
        
        requestAnimationFrame(animate);
    });
}

// Export animation as a video
async function exportAnimation() {
    if (!ffmpeg) {
        alert('Video export functionality is not available. Please run this application using the included server.js for full functionality.');
        return;
    }
    
    if (!ffmpeg.isLoaded || !ffmpeg.isLoaded()) {
        alert('Video export functionality is not ready. Please run this application using the included server.js for full functionality.');
        return;
    }
    
    if (!originalSvgContent) {
        alert('Please upload an SVG file first.');
        return;
    }
    
    // Disable buttons during export
    previewBtn.disabled = true;
    exportBtn.disabled = true;
    resetBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    
    // Get export settings
    const outputWidth = parseInt(widthInput.value) || 800;
    const outputHeight = parseInt(heightInput.value) || 600;
    const fps = parseInt(fpsInput.value) || 24;
    const isTransparent = transparentBg.checked;
    const bgColor = backgroundColor.value;
    
    // Animation settings
    const isPathAnimation = animationType.value === 'path';
    const durationValue = parseFloat(duration.value); // in seconds
    const delayValue = parseFloat(delay.value); // in seconds
    const easingValue = easing.value;
    
    try {
        // Create frames for the animation
        const totalFrames = Math.ceil(durationValue * fps);
        const svg = createSVGFromContent(originalSvgContent);
        
        // Set up video export
        const framePromises = [];
        
        for (let i = 0; i < totalFrames; i++) {
            const progress = i / (totalFrames - 1);
            const frame = await createAnimationFrame(svg, progress, isPathAnimation, easingValue, outputWidth, outputHeight, isTransparent, bgColor);
            framePromises.push(frame);
        }
        
        const frames = await Promise.all(framePromises);
        
        // Generate video using FFmpeg
        await generateVideo(frames, outputWidth, outputHeight, fps, isTransparent);
        
        // Reset UI
        exportBtn.textContent = 'Export Video';
        previewBtn.disabled = false;
        exportBtn.disabled = false;
        resetBtn.disabled = false;
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export video: ' + error.message);
        exportBtn.textContent = 'Export Video';
        previewBtn.disabled = false;
        exportBtn.disabled = false;
        resetBtn.disabled = false;
    }
}

// Create a single animation frame
async function createAnimationFrame(svg, progress, isPathAnimation, easingValue, width, height, isTransparent, bgColor) {
    // Clone SVG for this frame
    const frameSvg = svg.cloneNode(true);
    
    // Apply easing
    let easedProgress;
    switch (easingValue) {
        case 'easeIn':
            easedProgress = progress * progress;
            break;
        case 'easeOut':
            easedProgress = 1 - Math.pow(1 - progress, 2);
            break;
        case 'easeInOut':
            easedProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            break;
        default: // linear
            easedProgress = progress;
    }
    
    // Apply animation to the frame
    if (isPathAnimation) {
        const paths = Array.from(frameSvg.querySelectorAll('path'));
        paths.forEach(path => {
            if (!path.getTotalLength) return;
            const pathLength = path.getTotalLength();
            path.style.strokeDasharray = pathLength;
            path.style.strokeDashoffset = pathLength * (1 - easedProgress);
        });
    } else {
        // Now we're using the same technique for stroked elements as for paths
        const elements = Array.from(frameSvg.querySelectorAll('[stroke]'))
            .filter(el => el.getAttribute('stroke') !== 'none');
        
        elements.forEach(element => {
            let pathLength = 0;
            
            if (element.getTotalLength) {
                // For path elements and some SVG elements
                pathLength = element.getTotalLength();
            } else {
                // For other elements, estimate length
                try {
                    const bbox = element.getBBox();
                    if (element.tagName.toLowerCase() === 'rect') {
                        const x = parseFloat(element.getAttribute('x') || 0);
                        const y = parseFloat(element.getAttribute('y') || 0);
                        const w = parseFloat(element.getAttribute('width'));
                        const h = parseFloat(element.getAttribute('height'));
                        pathLength = 2 * (w + h);
                    } else if (element.tagName.toLowerCase() === 'circle') {
                        const r = parseFloat(element.getAttribute('r'));
                        pathLength = 2 * Math.PI * r;
                    } else if (element.tagName.toLowerCase() === 'line') {
                        const x1 = parseFloat(element.getAttribute('x1') || 0);
                        const y1 = parseFloat(element.getAttribute('y1') || 0);
                        const x2 = parseFloat(element.getAttribute('x2') || 0);
                        const y2 = parseFloat(element.getAttribute('y2') || 0);
                        pathLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    } else {
                        // Fallback to perimeter
                        pathLength = 2 * (bbox.width + bbox.height);
                    }
                } catch (e) {
                    pathLength = 100; // Default value
                }
            }
            
            element.style.strokeDasharray = pathLength;
            element.style.strokeDashoffset = pathLength * (1 - easedProgress);
        });
    }
    
    // Set SVG attributes for rendering
    frameSvg.setAttribute('width', width);
    frameSvg.setAttribute('height', height);
    frameSvg.setAttribute('viewBox', `0 0 ${svgSize.width} ${svgSize.height}`);
    
    // Convert SVG to data URL
    const svgData = new XMLSerializer().serializeToString(frameSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    
    // Create image from SVG
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // Create canvas with the correct dimensions
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Fill background if not transparent
            if (!isTransparent) {
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, width, height);
            }
            
            // Draw SVG
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get frame data as PNG
            const frameData = canvas.toDataURL('image/png').split(',')[1];
            URL.revokeObjectURL(url);
            resolve(frameData);
        };
        
        img.onerror = reject;
        img.src = url;
    });
}

// Generate video from frames
async function generateVideo(frames, width, height, fps, isTransparent) {
    // Write frames to FFmpeg
    for (let i = 0; i < frames.length; i++) {
        const frameData = frames[i];
        const frameName = `frame_${i.toString().padStart(5, '0')}.png`;
        ffmpeg.FS('writeFile', frameName, Uint8Array.from(atob(frameData), c => c.charCodeAt(0)));
    }
    
    // Run FFmpeg to create video
    const outputFilename = 'output.webm';
    const pixelFormat = isTransparent ? 'yuva420p' : 'yuv420p';
    
    await ffmpeg.run(
        '-framerate', `${fps}`,
        '-pattern_type', 'glob',
        '-i', 'frame_*.png',
        '-c:v', 'libvpx-vp9',
        '-pix_fmt', pixelFormat,
        '-auto-alt-ref', '0',
        outputFilename
    );
    
    // Read the output file
    const data = ffmpeg.FS('readFile', outputFilename);
    
    // Create a blob and download link
    const blob = new Blob([data.buffer], { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'svg_animation.webm';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Clean up FFmpeg files
        for (let i = 0; i < frames.length; i++) {
            const frameName = `frame_${i.toString().padStart(5, '0')}.png`;
            ffmpeg.FS('unlink', frameName);
        }
        ffmpeg.FS('unlink', outputFilename);
    }, 100);
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error || e.message);
    alert('An error occurred: ' + (e.error?.message || e.message));
});

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init); 