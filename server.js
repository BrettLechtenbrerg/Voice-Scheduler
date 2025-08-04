const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 9000;

// Serve static files
app.use(express.static(path.join(__dirname, '.next/static')));
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Voice Scheduler - Manual Server</title>
        <style>
            body { font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 2rem; }
            .container { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .testing-mode { background: #fff3cd; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border: 1px solid #ffeaa7; }
            .record-btn { background: #4CAF50; color: white; border: none; border-radius: 50px; padding: 1rem 2rem; font-size: 1.1rem; cursor: pointer; }
            .stop-btn { background: #f44336; color: white; border: none; border-radius: 50px; padding: 1rem 2rem; font-size: 1.1rem; cursor: pointer; }
            .error { background: #ffebee; color: #c62828; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
            .result { background: #e8f5e8; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🎤 Voice Scheduler (Manual Server)</h1>
            <p>Speak your contact information to automatically create leads and send calendar links</p>
            
            <div class="testing-mode">
                <h4>🧪 Testing Mode</h4>
                <input type="password" id="apiKey" placeholder="OpenAI API Key (sk-proj-...)" style="width: 100%; padding: 0.75rem; margin: 0.5rem 0; border: 1px solid #ddd; border-radius: 4px;">
                <p id="apiStatus">❌ No API key - transcription will fail</p>
            </div>
            
            <div style="text-align: center; margin: 2rem 0;">
                <button id="recordBtn" class="record-btn">🎙️ Start Recording</button>
                <button id="stopBtn" class="stop-btn" style="display: none;">⏹️ Stop Recording</button>
                <div id="processing" style="display: none; color: #2196F3; font-size: 1.1rem;">🔄 Processing audio...</div>
            </div>
            
            <div id="error" class="error" style="display: none;"></div>
            <div id="transcription" class="result" style="display: none;"></div>
            <div id="contactData" class="result" style="display: none;"></div>
            
            <p><strong>Note:</strong> This is a manual server running on port 8000. The Next.js server on port 3000 appears to have networking issues on your system.</p>
        </div>
        
        <script>
            let mediaRecorder;
            let audioChunks = [];
            let apiKey = '';
            
            document.getElementById('apiKey').addEventListener('input', (e) => {
                apiKey = e.target.value;
                document.getElementById('apiStatus').textContent = 
                    apiKey ? '✅ API key entered - voice transcription enabled' : '❌ No API key - transcription will fail';
            });
            
            document.getElementById('recordBtn').addEventListener('click', startRecording);
            document.getElementById('stopBtn').addEventListener('click', stopRecording);
            
            async function startRecording() {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        await processAudio(audioBlob);
                        stream.getTracks().forEach(track => track.stop());
                    };
                    
                    mediaRecorder.start();
                    document.getElementById('recordBtn').style.display = 'none';
                    document.getElementById('stopBtn').style.display = 'inline-block';
                    hideElement('error');
                } catch (err) {
                    showError('Failed to access microphone. Please allow microphone access.');
                }
            }
            
            function stopRecording() {
                if (mediaRecorder) {
                    mediaRecorder.stop();
                    document.getElementById('recordBtn').style.display = 'inline-block';
                    document.getElementById('stopBtn').style.display = 'none';
                    document.getElementById('processing').style.display = 'block';
                }
            }
            
            async function processAudio(audioBlob) {
                try {
                    const formData = new FormData();
                    formData.append('audio', audioBlob, 'recording.webm');
                    if (apiKey) {
                        formData.append('apiKey', apiKey);
                    }
                    
                    // Try Next.js server first, fallback to mock response
                    let response;
                    try {
                        response = await fetch('http://localhost:3000/api/transcribe', {
                            method: 'POST',
                            body: formData,
                        });
                    } catch (e) {
                        // Fallback for demo
                        showError('Next.js server not reachable. This is a demo interface showing how the app works.');
                        showTranscription('Demo: My name is John Smith, phone number 555-123-4567, email john@company.com');
                        showContactData({
                            name: 'John Smith',
                            phone: '+15551234567',
                            email: 'john@company.com',
                            company: 'Demo Company'
                        });
                        document.getElementById('processing').style.display = 'none';
                        return;
                    }
                    
                    if (!response.ok) {
                        throw new Error('HTTP error! status: ' + response.status);
                    }
                    
                    const result = await response.json();
                    showTranscription(result.transcription);
                    showContactData(result.contactData);
                    
                } catch (err) {
                    showError('Failed to process audio: ' + err.message);
                } finally {
                    document.getElementById('processing').style.display = 'none';
                }
            }
            
            function showError(message) {
                const errorDiv = document.getElementById('error');
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            
            function hideElement(id) {
                document.getElementById(id).style.display = 'none';
            }
            
            function showTranscription(text) {
                const div = document.getElementById('transcription');
                div.innerHTML = '<h3>Transcription:</h3><p>' + text + '</p>';
                div.style.display = 'block';
            }
            
            function showContactData(data) {
                const div = document.getElementById('contactData');
                div.innerHTML = 
                    '<h3>Extracted Contact Info:</h3>' +
                    '<p><strong>Name:</strong> ' + (data.name || 'Not detected') + '</p>' +
                    '<p><strong>Phone:</strong> ' + (data.phone || 'Not detected') + '</p>' +
                    '<p><strong>Email:</strong> ' + (data.email || 'Not detected') + '</p>' +
                    (data.company ? '<p><strong>Company:</strong> ' + data.company + '</p>' : '');
                div.style.display = 'block';
            }
        </script>
    </body>
    </html>
  `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('Manual server running on http://localhost:' + PORT);
    
    // Try to open browser
    const opener = spawn('open', ['http://localhost:' + PORT]);
    opener.on('error', () => {
        console.log('Could not auto-open browser. Please manually navigate to http://localhost:' + PORT);
    });
});