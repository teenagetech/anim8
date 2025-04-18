// DOM Elements
const svgUpload = document.getElementById('svg-upload');
const uploadBtn = document.getElementById('upload-btn');
const svgContainer = document.getElementById('svg-container');
const animationType = document.getElementById('animation-type');
const durationInput = document.getElementById('duration');
const delayInput = document.getElementById('delay');
const easingSelect = document.getElementById('easing');
const loopCheckbox = document.getElementById('loop');
const useOriginalStyles = document.getElementById('use-original-styles');
const strokeWidthInput = document.getElementById('stroke-width');
const strokeColorInput = document.getElementById('stroke-color');
const styleControls = document.querySelectorAll('.style-control');
const applySettingsBtn = document.getElementById('apply-settings-btn');
const fpsInput = document.getElementById('fps');
const formatSelect = document.getElementById('format');
const qualityInput = document.getElementById('quality');
const qualityValue = document.getElementById('quality-value');
const exportBtn = document.getElementById('export-btn');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const exportModal = document.getElementById('export-modal');
const closeBtn = document.querySelector('.close-btn');
const progressBar = document.querySelector('.progress-bar');
const exportStatus = document.getElementById('export-status');
const uploadPrompt = document.querySelector('.upload-prompt');

// State variables
let originalSvgContent = null;
let svgContent = null;
let animation = null;
let isPlaying = false;
let recorder = null;
let recordedChunks = [];
let exportedFrames = [];
let ffmpegLoaded = false;
let ffmpeg = null;
let originalStyles = new Map(); // Store original SVG element styles
let userModifiedStyles = {
    stroke: false,
    strokeWidth: false
};

// Initialize the application
function init() {
    setupEventListeners();
    disableControls();
    
    // Initially set style controls based on the useOriginalStyles checkbox
    toggleStyleControls();
    
    // Check if FFmpeg is available
    if (typeof FFmpeg !== 'undefined') {
        preloadFFmpeg();
    }
}

// Preload FFmpeg in the background
async function preloadFFmpeg() {
    try {
        const { createFFmpeg } = FFmpeg;
        ffmpeg = createFFmpeg({ 
            log: true,
            progress: ({ ratio }) => {
                if (exportModal.classList.contains('active')) {
                    progressBar.style.width = `${50 + ratio * 50}%`;
                }
            }
        });
        
        await ffmpeg.load();
        ffmpegLoaded = true;
        console.log('FFmpeg loaded successfully');
    } catch (error) {
        console.error('Error loading FFmpeg:', error);
    }
}

// Set up event listeners
function setupEventListeners() {
    uploadBtn.addEventListener('click', handleSvgUpload);
    applySettingsBtn.addEventListener('click', applyAnimationSettings);
    playBtn.addEventListener('click', playAnimation);
    pauseBtn.addEventListener('click', pauseAnimation);
    stopBtn.addEventListener('click', stopAnimation);
    exportBtn.addEventListener('click', startExport);
    closeBtn.addEventListener('click', closeModal);
    
    // Update SVG properties in real-time
    strokeWidthInput.addEventListener('input', updateStrokeWidth);
    strokeColorInput.addEventListener('input', updateStrokeColor);
    
    // Update quality value display
    qualityInput.addEventListener('input', updateQualityValue);
    
    // Toggle original styles
    useOriginalStyles.addEventListener('change', toggleStyleControls);
}

// Toggle style controls based on useOriginalStyles checkbox
function toggleStyleControls() {
    const useOriginal = useOriginalStyles.checked;
    
    styleControls.forEach(control => {
        if (useOriginal) {
            control.classList.add('disabled');
        } else {
            control.classList.remove('disabled');
        }
    });
    
    // Reapply SVG styling based on the toggle state
    if (svgContent) {
        applyStylesToSvg();
    }
}

// Apply appropriate styles to SVG based on settings
function applyStylesToSvg() {
    if (!svgContent) return;
    
    const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
    const useOriginal = useOriginalStyles.checked;
    
    pathElements.forEach(path => {
        if (useOriginal) {
            // Restore original styles
            const origStyle = originalStyles.get(path.id);
            if (origStyle) {
                path.setAttribute('stroke', origStyle.stroke);
                path.setAttribute('stroke-width', origStyle.strokeWidth);
                path.setAttribute('fill', origStyle.fill);
            }
        } else {
            // Apply custom styles
            path.setAttribute('stroke', strokeColorInput.value);
            path.setAttribute('stroke-width', strokeWidthInput.value);
        }
    });
    
    // Mark both style properties as user-modified if using custom styles
    userModifiedStyles.stroke = !useOriginal;
    userModifiedStyles.strokeWidth = !useOriginal;
}

// Update quality value display
function updateQualityValue() {
    if (qualityValue) {
        qualityValue.textContent = qualityInput.value;
    }
}

// Handle SVG upload
function handleSvgUpload() {
    const file = svgUpload.files[0];
    if (!file) {
        alert('Please select an SVG file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const svgText = e.target.result;
        
        // Validate SVG 
        if (!svgText.includes('<svg') || !svgText.includes('</svg>')) {
            alert('Invalid SVG file');
            return;
        }
        
        originalSvgContent = svgText;
        svgContainer.innerHTML = svgText;
        svgContainer.classList.add('has-svg');
        svgContent = svgContainer.querySelector('svg');
        
        // Make the SVG responsive
        if (!svgContent.getAttribute('viewBox')) {
            const width = svgContent.getAttribute('width') || 100;
            const height = svgContent.getAttribute('height') || 100;
            svgContent.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        
        svgContent.setAttribute('width', '100%');
        svgContent.setAttribute('height', '100%');
        
        // Reset user modification flags
        userModifiedStyles = {
            stroke: false, 
            strokeWidth: false
        };
        
        // Extract embedded styles from the SVG
        extractEmbeddedStyles();
        
        // Extract default values from the SVG to update UI controls
        extractSvgDefaultStyles();
        
        // Prepare SVG for animation
        prepareSvgForAnimation();
        enableControls();
    };
    
    reader.readAsText(file);
}

// Extract embedded styles from the SVG (from <style>, <defs>, etc.)
function extractEmbeddedStyles() {
    if (!svgContent) return;
    
    // Look for embedded style elements
    const embeddedStyles = svgContent.querySelectorAll('style');
    if (embeddedStyles.length > 0) {
        // Create a style element in the document head to hold these styles
        const docStyle = document.createElement('style');
        docStyle.id = 'svg-embedded-styles';
        
        // Combine all embedded styles
        let combinedStyles = '';
        embeddedStyles.forEach(style => {
            combinedStyles += style.textContent;
        });
        
        // Add namespace for SVG elements to ensure styles apply correctly
        const processedStyles = combinedStyles.replace(/([.#][\w-]+\s*{)/g, 'svg $1');
        
        docStyle.textContent = processedStyles;
        
        // Remove any previously added styles
        const existingStyle = document.getElementById('svg-embedded-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        // Add the styles to the document
        document.head.appendChild(docStyle);
    }
    
    // Process CSS classes in the SVG
    processSvgClasses();
}

// Process CSS classes in SVG elements
function processSvgClasses() {
    if (!svgContent) return;
    
    // Find all elements with class attributes
    const elementsWithClasses = svgContent.querySelectorAll('[class]');
    
    // Process each element to ensure classes are properly applied
    elementsWithClasses.forEach(element => {
        const classes = element.getAttribute('class');
        // Re-apply classes to ensure they trigger style recalculation
        element.setAttribute('class', classes);
    });
}

// Extract default style values from SVG to update UI controls
function extractSvgDefaultStyles() {
    if (!svgContent) return;
    
    // Clear the previous original styles
    originalStyles.clear();
    
    // Get all paths and strokes
    const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
    
    if (pathElements.length > 0) {
        // Extract the styles from each element and store them
        pathElements.forEach((path, index) => {
            // Get computed styles
            const computedStyle = window.getComputedStyle(path);
            const svgStyles = {
                stroke: path.getAttribute('stroke') || computedStyle.stroke || '#000000',
                strokeWidth: path.getAttribute('stroke-width') || computedStyle.strokeWidth || 1,
                fill: path.getAttribute('fill') || computedStyle.fill || 'none'
            };
            
            // Store original styles by element ID
            if (!path.id) {
                path.id = `path-${index}`;
            }
            originalStyles.set(path.id, svgStyles);
        });
        
        // Update UI to match the first element's style
        const firstElement = pathElements[0];
        const firstStyle = originalStyles.get(firstElement.id);
        
        if (firstStyle) {
            // Only update if we haven't already modified these via UI
            if (!userModifiedStyles.stroke) {
                let strokeColor = firstStyle.stroke;
                // Convert RGB to hex if needed
                if (strokeColor.startsWith('rgb')) {
                    strokeColor = rgbToHex(strokeColor);
                }
                strokeColorInput.value = strokeColor;
            }
            
            if (!userModifiedStyles.strokeWidth) {
                strokeWidthInput.value = parseFloat(firstStyle.strokeWidth) || 1;
            }
        }
    }
}

// Helper to convert RGB color to hex
function rgbToHex(rgb) {
    // Handle rgb() format
    if (rgb.startsWith('rgb')) {
        const rgbValues = rgb.match(/\d+/g);
        if (rgbValues && rgbValues.length >= 3) {
            return '#' + ((1 << 24) + (parseInt(rgbValues[0]) << 16) + 
                          (parseInt(rgbValues[1]) << 8) + parseInt(rgbValues[2]))
                          .toString(16).slice(1);
        }
    }
    return rgb;
}

// Prepare SVG for animation
function prepareSvgForAnimation() {
    // Reset any previous animations
    if (animation) {
        animation.kill();
    }
    
    // Get all paths and strokes
    const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
    
    if (pathElements.length === 0) {
        alert('No animatable elements found in the SVG');
        return;
    }
    
    pathElements.forEach((path, index) => {
        // Ensure each element has an ID
        if (!path.id) {
            path.id = `path-${index}`;
        }
        
        // Get the original style or use current UI values as fallback
        const elementStyle = originalStyles.get(path.id) || {
            stroke: strokeColorInput.value,
            strokeWidth: strokeWidthInput.value,
            fill: 'none'
        };
        
        // Apply the appropriate style based on the toggle
        const useOriginal = useOriginalStyles.checked;
        
        // Apply the stroke color and width based on settings
        const strokeColor = useOriginal ? elementStyle.stroke : strokeColorInput.value;
        const strokeWidth = useOriginal ? elementStyle.strokeWidth : strokeWidthInput.value;
        
        // Set initial state for animation
        gsap.set(path, { 
            strokeDasharray: getPathLength(path),
            strokeDashoffset: getPathLength(path),
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            fill: elementStyle.fill
        });
    });
}

// Apply animation settings
function applyAnimationSettings() {
    if (!svgContent) {
        alert('Please upload an SVG first');
        return;
    }
    
    // Reset any previous animations
    if (animation) {
        animation.kill();
    }
    
    // Apply current style settings before animating
    applyStylesToSvg();
    
    const duration = parseFloat(durationInput.value);
    const delay = parseFloat(delayInput.value);
    const easing = easingSelect.value;
    const loop = loopCheckbox.checked;
    const animType = animationType.value;
    
    const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
    
    if (pathElements.length === 0) {
        alert('No animatable elements found in the SVG');
        return;
    }
    
    // Create timeline
    animation = gsap.timeline({
        paused: true,
        defaults: { ease: easing },
        onComplete: () => {
            if (loop) {
                animation.restart();
            }
        }
    });
    
    if (animType === 'path') {
        // Animate all paths at once
        animation.to(pathElements, {
            strokeDashoffset: 0,
            duration: duration,
            delay: delay,
            stagger: 0
        });
    } else {
        // Animate stroke by stroke with staggered timing
        animation.to(pathElements, {
            strokeDashoffset: 0,
            duration: duration / pathElements.length,
            delay: delay,
            stagger: duration / pathElements.length
        });
    }
    
    // Auto-play the animation
    playAnimation();
}

// Play the animation
function playAnimation() {
    if (!animation) {
        applyAnimationSettings();
        return;
    }
    
    animation.play();
    isPlaying = true;
}

// Pause the animation
function pauseAnimation() {
    if (animation && isPlaying) {
        animation.pause();
        isPlaying = false;
    }
}

// Stop the animation
function stopAnimation() {
    if (animation) {
        animation.pause(0);
        isPlaying = false;
    }
}

// Update stroke width in real-time
function updateStrokeWidth() {
    if (!svgContent) return;
    
    // If using original styles, switch to custom styles
    if (useOriginalStyles.checked) {
        useOriginalStyles.checked = false;
        toggleStyleControls();
    } else {
        userModifiedStyles.strokeWidth = true;
        const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
        const width = strokeWidthInput.value;
        
        pathElements.forEach(path => {
            path.setAttribute('stroke-width', width);
        });
    }
}

// Update stroke color in real-time
function updateStrokeColor() {
    if (!svgContent) return;
    
    // If using original styles, switch to custom styles
    if (useOriginalStyles.checked) {
        useOriginalStyles.checked = false;
        toggleStyleControls();
    } else {
        userModifiedStyles.stroke = true;
        const pathElements = svgContent.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
        const color = strokeColorInput.value;
        
        pathElements.forEach(path => {
            path.setAttribute('stroke', color);
        });
    }
}

// Utility function to get path length
function getPathLength(path) {
    if (path.getTotalLength) {
        return path.getTotalLength();
    } else {
        // Fallback for elements without getTotalLength
        const bbox = path.getBBox();
        return (bbox.width + bbox.height) * 2;
    }
}

// Start export process
function startExport() {
    if (!svgContent) {
        alert('Please upload an SVG first');
        return;
    }
    
    // Show export modal
    exportModal.classList.add('active');
    progressBar.style.width = '0%';
    exportStatus.textContent = 'Preparing export...';
    
    // Get export settings
    const fps = parseInt(fpsInput.value);
    const format = formatSelect.value;
    const quality = parseInt(qualityInput.value);
    
    // Reset recorded chunks
    recordedChunks = [];
    exportedFrames = [];
    
    // Start capturing frames
    captureFrames(fps, format, quality);
}

// Capture frames for export
function captureFrames(fps, format, quality) {
    const duration = parseFloat(durationInput.value);
    const totalFrames = Math.ceil(duration * fps);
    
    // Reset and restart animation
    stopAnimation();
    
    exportStatus.textContent = 'Capturing frames...';
    
    // Capture each frame
    let frameCount = 0;
    
    function captureNextFrame() {
        if (frameCount <= totalFrames) {
            // Update progress
            const progress = (frameCount / totalFrames) * 50; // First 50% for capture
            progressBar.style.width = `${progress}%`;
            
            // Set animation to specific point in time
            const progress01 = frameCount / totalFrames;
            animation.progress(progress01);
            
            // Capture the current state as an image
            captureFrame().then(frame => {
                exportedFrames.push(frame);
                frameCount++;
                
                // Capture next frame (async to prevent UI blocking)
                setTimeout(captureNextFrame, 0);
            }).catch(error => {
                console.error('Error capturing frame:', error);
                exportStatus.textContent = 'Error capturing frames. Please try again.';
            });
        } else {
            // All frames captured, start encoding
            exportStatus.textContent = 'Encoding video...';
            encodeVideo(fps, format, quality);
        }
    }
    
    // Start capturing frames
    captureNextFrame();
}

// Capture a single frame as an image
function captureFrame() {
    return new Promise((resolve, reject) => {
        try {
            // Create a proper SVG document with all styles preserved
            const svgDoc = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
            
            // Clone the original SVG and all its content
            const svgClone = svgContent.cloneNode(true);
            
            // Copy all attributes from the original SVG to the clone
            Array.from(svgContent.attributes).forEach(attr => {
                svgClone.setAttribute(attr.name, attr.value);
            });
            
            // Ensure viewBox is set
            if (!svgClone.getAttribute('viewBox') && (svgClone.getAttribute('width') && svgClone.getAttribute('height'))) {
                const width = svgClone.getAttribute('width');
                const height = svgClone.getAttribute('height');
                svgClone.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
            
            // Extract all styles from the document
            let styleText = '';
            
            // Get all style elements and external stylesheets
            const styleElements = document.querySelectorAll('style');
            styleElements.forEach(style => {
                styleText += style.textContent;
            });
            
            // Add any CSS rules that might affect the SVG
            Array.from(document.styleSheets).forEach(sheet => {
                try {
                    // Only process same-origin stylesheets
                    if (sheet.cssRules) {
                        Array.from(sheet.cssRules).forEach(rule => {
                            styleText += rule.cssText;
                        });
                    }
                } catch (e) {
                    console.warn('Cannot access stylesheet rules (likely CORS issue):', e);
                }
            });
            
            // Create a style element and append it to the SVG
            if (styleText) {
                const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
                styleElement.textContent = styleText;
                svgClone.insertBefore(styleElement, svgClone.firstChild);
            }
            
            // Process <defs> elements that might contain styles/gradients/etc
            const defsElements = svgContent.querySelectorAll('defs');
            if (defsElements.length > 0) {
                // If the clone doesn't have a defs element, create one
                let defs = svgClone.querySelector('defs');
                if (!defs) {
                    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
                    svgClone.insertBefore(defs, svgClone.firstChild);
                }
                
                // Copy all defs content from the original
                defsElements.forEach(originalDefs => {
                    const defsClone = originalDefs.cloneNode(true);
                    Array.from(defsClone.children).forEach(child => {
                        defs.appendChild(child);
                    });
                });
            }
            
            // If we're using original styles, make sure inline styles are applied properly
            if (useOriginalStyles.checked) {
                const pathElements = svgClone.querySelectorAll('path, line, rect, circle, ellipse, polygon, polyline');
                pathElements.forEach(path => {
                    const id = path.id;
                    const originalStyle = originalStyles.get(id);
                    if (originalStyle) {
                        if (originalStyle.stroke) path.setAttribute('stroke', originalStyle.stroke);
                        if (originalStyle.strokeWidth) path.setAttribute('stroke-width', originalStyle.strokeWidth);
                        if (originalStyle.fill) path.setAttribute('fill', originalStyle.fill);
                    }
                });
            }
            
            // Create a complete SVG document with XML declaration
            const serializer = new XMLSerializer();
            const svgData = serializer.serializeToString(svgClone);
            
            // Ensure proper XML structure with all necessary namespaces
            const completeSVGDoc = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">${svgData}</svg>`;
            
            const svgBlob = new Blob([completeSVGDoc], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);
            
            // Create image from SVG
            const image = new Image();
            
            image.onload = function() {
                // Create canvas to draw the image
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // Set canvas size to match SVG
                canvas.width = image.width || 800;
                canvas.height = image.height || 600;
                
                // Draw with transparent background
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                
                // Get frame data
                canvas.toBlob(blob => {
                    URL.revokeObjectURL(blobURL);
                    resolve(blob);
                }, 'image/png');
            };
            
            image.onerror = function(err) {
                console.error('Image load error:', err);
                URL.revokeObjectURL(blobURL);
                reject(new Error('Failed to load SVG as image'));
            };
            
            image.src = blobURL;
        } catch (error) {
            console.error('Error in captureFrame:', error);
            reject(error);
        }
    });
}

// Encode frames into a video
function encodeVideo(fps, format, quality) {
    progressBar.style.width = '50%';
    exportStatus.textContent = 'Processing frames...';
    
    // Create a zip file for the frames if not using ffmpeg
    if (!ffmpegLoaded || !ffmpeg) {
        saveFramesToZip(fps, format, quality);
        return;
    }
    
    // Use ffmpeg.wasm for video encoding
    exportStatus.textContent = 'Preparing FFmpeg...';
    
    const { fetchFile } = FFmpeg;
    
    (async () => {
        try {
            exportStatus.textContent = 'Encoding frames...';
            
            // Write frames to memory
            for (let i = 0; i < exportedFrames.length; i++) {
                const blob = exportedFrames[i];
                const arrayBuffer = await blob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Write to virtual file system with padded index (001, 002, etc.)
                const paddedIndex = String(i).padStart(6, '0');
                ffmpeg.FS('writeFile', `frame_${paddedIndex}.png`, uint8Array);
                
                // Update progress for writing frames
                const writeProgress = 50 + (i / exportedFrames.length) * 20;
                progressBar.style.width = `${writeProgress}%`;
            }
            
            // Create output file based on format
            let outputFileName;
            let ffmpegCommand;
            
            switch (format) {
                case 'webm':
                    outputFileName = 'output.webm';
                    ffmpegCommand = [
                        '-framerate', `${fps}`,
                        '-i', 'frame_%06d.png',
                        '-c:v', 'libvpx-vp9',
                        '-pix_fmt', 'yuva420p',
                        '-metadata:s:v:0', 'alpha_mode=1',
                        '-auto-alt-ref', '0',
                        '-crf', `${Math.round(30 - (quality * 2))}`,
                        '-b:v', '0',
                        outputFileName
                    ];
                    break;
                case 'mp4':
                    outputFileName = 'output.mp4';
                    ffmpegCommand = [
                        '-framerate', `${fps}`,
                        '-i', 'frame_%06d.png',
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-crf', `${Math.round(23 - quality)}`,
                        outputFileName
                    ];
                    break;
                case 'gif':
                    outputFileName = 'output.gif';
                    ffmpegCommand = [
                        '-framerate', `${fps}`,
                        '-i', 'frame_%06d.png',
                        '-vf', 'split[s0][s1];[s0]palettegen=reserve_transparent=1[p];[s1][p]paletteuse',
                        outputFileName
                    ];
                    break;
                default:
                    outputFileName = 'output.webm';
                    ffmpegCommand = [
                        '-framerate', `${fps}`,
                        '-i', 'frame_%06d.png',
                        '-c:v', 'libvpx-vp9',
                        '-pix_fmt', 'yuva420p',
                        '-metadata:s:v:0', 'alpha_mode=1',
                        '-auto-alt-ref', '0',
                        '-crf', `${Math.round(30 - (quality * 2))}`,
                        '-b:v', '0',
                        outputFileName
                    ];
            }
            
            progressBar.style.width = '70%';
            exportStatus.textContent = 'Generating video...';
            
            // Run ffmpeg command
            await ffmpeg.run(...ffmpegCommand);
            
            progressBar.style.width = '90%';
            exportStatus.textContent = 'Finalizing...';
            
            // Read the output file
            const data = ffmpeg.FS('readFile', outputFileName);
            
            // Create and download the output file
            const blob = new Blob([data.buffer], { type: getOutputMimeType(format) });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `svg-animation.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Clean up
            URL.revokeObjectURL(url);
            
            // Clean up files in the virtual filesystem to free memory
            try {
                for (let i = 0; i < exportedFrames.length; i++) {
                    const paddedIndex = String(i).padStart(6, '0');
                    ffmpeg.FS('unlink', `frame_${paddedIndex}.png`);
                }
                ffmpeg.FS('unlink', outputFileName);
            } catch (e) {
                console.error('Error cleaning up files:', e);
            }
            
            // Complete the export process
            progressBar.style.width = '100%';
            exportStatus.textContent = 'Export complete!';
            
        } catch (error) {
            console.error('Error during encoding:', error);
            exportStatus.textContent = 'Error during encoding. Falling back to frames export.';
            saveFramesToZip(fps, format, quality);
        }
    })();
}

// Fallback: Save frames to a ZIP file
function saveFramesToZip(fps, format, quality) {
    // Since we can't rely on ffmpeg or we encountered an error,
    // we'll provide the individual frames for the user to process externally
    
    exportStatus.textContent = 'Creating downloadable frames...';
    
    // Use JSZip if available
    if (window.JSZip) {
        const zip = new JSZip();
        
        // Add metadata file with animation info
        const metadata = {
            fps: fps,
            format: format,
            quality: quality,
            duration: parseFloat(durationInput.value),
            frameCount: exportedFrames.length
        };
        
        zip.file("metadata.json", JSON.stringify(metadata, null, 2));
        
        // Add each frame to the zip
        exportedFrames.forEach((blob, index) => {
            const paddedIndex = String(index).padStart(6, '0');
            zip.file(`frame_${paddedIndex}.png`, blob);
            
            // Update progress
            const zipProgress = 50 + (index / exportedFrames.length) * 40;
            progressBar.style.width = `${zipProgress}%`;
        });
        
        // Generate and download the zip
        zip.generateAsync({type: "blob"}).then(function(content) {
            const url = URL.createObjectURL(content);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'svg-animation-frames.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            // Complete the export process
            progressBar.style.width = '100%';
            exportStatus.textContent = 'Frames exported successfully!';
        }).catch(function(error) {
            console.error('Error generating zip:', error);
            exportStatus.textContent = 'Error generating zip. Downloading sample frame.';
            downloadSampleFrame();
        });
    } else {
        // If JSZip is not available, just download the first frame as a sample
        downloadSampleFrame();
    }
}

// Download a sample frame when other methods fail
function downloadSampleFrame() {
    if (exportedFrames.length === 0) {
        exportStatus.textContent = 'No frames to export. Please try again.';
        return;
    }
    
    const frameBlob = exportedFrames[0];
    const url = URL.createObjectURL(frameBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `svg-animation-sample.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    progressBar.style.width = '100%';
    exportStatus.textContent = 'Sample frame exported. Full animation unavailable.';
}

// Get MIME type for the output based on format
function getOutputMimeType(format) {
    switch (format) {
        case 'webm': return 'video/webm';
        case 'mp4': return 'video/mp4';
        case 'gif': return 'image/gif';
        default: return 'video/webm';
    }
}

// Close the export modal
function closeModal() {
    exportModal.classList.remove('active');
}

// Enable controls after SVG upload
function enableControls() {
    document.querySelectorAll('.animation-settings button, .animation-settings input, .animation-settings select').forEach(element => {
        element.removeAttribute('disabled');
    });
    
    document.querySelectorAll('.export-settings button, .export-settings input, .export-settings select').forEach(element => {
        element.removeAttribute('disabled');
    });
    
    document.querySelectorAll('#animation-controls button').forEach(element => {
        element.removeAttribute('disabled');
    });
    
    // Hide upload prompt
    if (uploadPrompt) {
        uploadPrompt.style.display = 'none';
    }
}

// Disable controls when no SVG is loaded
function disableControls() {
    document.querySelectorAll('.animation-settings button, .animation-settings input, .animation-settings select').forEach(element => {
        element.setAttribute('disabled', 'disabled');
    });
    
    document.querySelectorAll('.export-settings button, .export-settings input, .export-settings select').forEach(element => {
        element.setAttribute('disabled', 'disabled');
    });
    
    document.querySelectorAll('#animation-controls button').forEach(element => {
        element.setAttribute('disabled', 'disabled');
    });
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', init); 