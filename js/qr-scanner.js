// QR Scanner Module
const QrScanner = {
    videoElement: null,
    canvasElement: null,
    canvasContext: null,
    scanning: false,
    scanInterval: null,
    
    // Initialize scanner
    init: function(videoId, canvasId) {
        this.videoElement = document.getElementById(videoId);
        this.canvasElement = document.getElementById(canvasId);
        if (this.canvasElement) {
            this.canvasContext = this.canvasElement.getContext('2d');
        }
    },
    
    // Start camera
    startCamera: async function(facingMode = 'environment') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: facingMode } 
            });
            this.videoElement.srcObject = stream;
            await this.videoElement.play();
            return true;
        } catch (error) {
            console.error('Camera error:', error);
            throw new Error('Unable to access camera');
        }
    },
    
    // Stop camera
    stopCamera: function() {
        if (this.videoElement && this.videoElement.srcObject) {
            this.videoElement.srcObject.getTracks().forEach(track => track.stop());
        }
    },
    
    // Start scanning
    startScanning: function(onScanSuccess, onScanError, options = {}) {
        if (!this.videoElement || !this.canvasContext) {
            console.error('Scanner not initialized');
            return;
        }
        
        this.scanning = true;
        const scanFrequency = options.frequency || 500; // ms
        
        this.scanInterval = setInterval(() => {
            if (!this.scanning || this.videoElement.readyState < 2) return;
            
            try {
                // Draw video frame to canvas
                this.canvasElement.width = this.videoElement.videoWidth;
                this.canvasElement.height = this.videoElement.videoHeight;
                this.canvasContext.drawImage(
                    this.videoElement, 
                    0, 0, 
                    this.canvasElement.width, 
                    this.canvasElement.height
                );
                
                // Get image data for QR processing
                const imageData = this.canvasContext.getImageData(
                    0, 0, 
                    this.canvasElement.width, 
                    this.canvasElement.height
                );
                
                // Use jsQR to decode
                if (window.jsQR) {
                    const code = jsQR(imageData.data, 
                        this.canvasElement.width, 
                        this.canvasElement.height);
                    
                    if (code) {
                        this.stopScanning();
                        onScanSuccess(code.data);
                    }
                }
            } catch (error) {
                if (onScanError) onScanError(error);
            }
        }, scanFrequency);
    },
    
    // Stop scanning
    stopScanning: function() {
        this.scanning = false;
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
    },
    
    // Generate QR code
    generateQR: function(elementId, data, options = {}) {
        const size = options.size || 256;
        const colorDark = options.colorDark || '#1e3c72';
        const colorLight = options.colorLight || '#ffffff';
        
        const qrContainer = document.getElementById(elementId);
        if (!qrContainer) return;
        
        qrContainer.innerHTML = '';
        
        new QRCode(qrContainer, {
            text: typeof data === 'string' ? data : JSON.stringify(data),
            width: size,
            height: size,
            colorDark: colorDark,
            colorLight: colorLight,
            correctLevel: QRCode.CorrectLevel.H
        });
    },
    
    // Validate QR data
    validateQRData: function(data, expectedType = 'attendance') {
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            
            // Check if it has required fields
            if (!parsed.type || parsed.type !== expectedType) {
                return { valid: false, error: 'Invalid QR code type' };
            }
            
            if (!parsed.sessionId) {
                return { valid: false, error: 'Missing session ID' };
            }
            
            if (!parsed.token) {
                return { valid: false, error: 'Missing security token' };
            }
            
            // Check timestamp (optional)
            if (parsed.timestamp) {
                const age = Date.now() - parsed.timestamp;
                if (age > 300000) { // 5 minutes
                    return { valid: false, error: 'QR code expired' };
                }
            }
            
            return { valid: true, data: parsed };
        } catch (error) {
            return { valid: false, error: 'Invalid QR format' };
        }
    },
    
    // Create attendance QR data
    createAttendanceQR: function(sessionId) {
        return {
            type: 'attendance',
            sessionId: sessionId,
            token: this.generateToken(),
            timestamp: Date.now()
        };
    },
    
    // Generate random token
    generateToken: function() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    },
    
    // Clean up
    destroy: function() {
        this.stopScanning();
        this.stopCamera();
    }
};

// Make it globally available
window.QrScanner = QrScanner;