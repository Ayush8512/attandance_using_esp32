import { api } from '../api.js';
import { showToast } from '../components/toast.js';

export default {
    render(container) {
        container.innerHTML = `
            <div class="max-w-3xl mx-auto">
                <h2 class="text-3xl font-bold text-white mb-6">Register New Student</h2>
                
                <div class="bg-cardbg rounded-xl border border-gray-700 p-6 shadow-lg">
                    <form id="register-form" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <!-- Left Column -->
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                                    <input type="text" id="name" required class="w-full px-4 py-2 rounded-lg" placeholder="John Doe">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">Roll Number</label>
                                    <input type="text" id="roll_no" required class="w-full px-4 py-2 rounded-lg" placeholder="CS-2023-001">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-400 mb-1">BLE UUID</label>
                                    <div class="flex gap-2">
                                        <input type="text" id="ble_id" required class="flex-1 px-4 py-2 rounded-lg" placeholder="device-mac-or-uuid">
                                        <button type="button" id="btn-generate-uuid" class="bg-accent hover:bg-highlight text-white px-3 rounded-lg transition-colors" title="Generate Random UUID">
                                            <i class="fas fa-random"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Right Column: Face Photo -->
                            <div class="space-y-4 flex flex-col">
                                <label class="block text-sm font-medium text-gray-400 mb-1">Face Photo</label>
                                
                                <div class="flex-1 border-2 border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center p-4 bg-gray-800 bg-opacity-30 relative overflow-hidden group">
                                    <img id="photo-preview" class="absolute inset-0 w-full h-full object-cover hidden" alt="Preview">
                                    <div id="photo-placeholder" class="text-center">
                                        <i class="fas fa-camera text-4xl text-gray-500 mb-2"></i>
                                        <p class="text-sm text-gray-400">Click to upload or take a photo</p>
                                    </div>
                                    <input type="file" id="photo-upload" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10">
                                </div>
                                
                                <div class="flex justify-between items-center mt-2">
                                    <span id="file-name" class="text-xs text-gray-500 truncate max-w-[200px]">No file selected</span>
                                    <button type="button" id="btn-camera" class="text-sm text-highlight hover:text-white transition-colors">
                                        <i class="fas fa-video mr-1"></i> Use Webcam
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Webcam Container -->
                        <div id="webcam-container" class="hidden flex-col items-center border border-gray-600 rounded-lg p-4 bg-gray-900">
                            <video id="webcam-video" autoplay playsinline class="w-full max-w-sm rounded-lg mb-4 bg-black"></video>
                            <button type="button" id="btn-capture" class="bg-highlight hover:bg-red-600 text-white px-6 py-2 rounded-full font-medium transition-colors">
                                <i class="fas fa-camera mr-2"></i> Capture Photo
                            </button>
                            <canvas id="webcam-canvas" class="hidden"></canvas>
                        </div>

                        <div class="pt-4 border-t border-gray-700 flex justify-end gap-4">
                            <button type="reset" class="px-6 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors">Clear</button>
                            <button type="submit" class="px-6 py-2 rounded-lg bg-highlight hover:bg-red-600 text-white font-medium transition-colors flex items-center">
                                <i class="fas fa-save mr-2"></i> Register Student
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        const form = document.getElementById('register-form');
        const photoUpload = document.getElementById('photo-upload');
        const photoPreview = document.getElementById('photo-preview');
        const photoPlaceholder = document.getElementById('photo-placeholder');
        const fileName = document.getElementById('file-name');
        const btnGenUuid = document.getElementById('btn-generate-uuid');
        
        let selectedFile = null;

        btnGenUuid.addEventListener('click', () => {
            const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            document.getElementById('ble_id').value = uuid;
        });

        photoUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                selectedFile = e.target.files[0];
                fileName.textContent = selectedFile.name;
                
                const reader = new FileReader();
                reader.onload = (e) => {
                    photoPreview.src = e.target.result;
                    photoPreview.classList.remove('hidden');
                    photoPlaceholder.classList.add('hidden');
                };
                reader.readAsDataURL(selectedFile);
                stopWebcam();
            }
        });

        const btnCamera = document.getElementById('btn-camera');
        const webcamContainer = document.getElementById('webcam-container');
        const video = document.getElementById('webcam-video');
        const canvas = document.getElementById('webcam-canvas');
        const btnCapture = document.getElementById('btn-capture');
        let stream = null;

        const stopWebcam = () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
                stream = null;
            }
            webcamContainer.classList.add('hidden');
        };

        btnCamera.addEventListener('click', async () => {
            if (webcamContainer.classList.contains('hidden')) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
                    video.srcObject = stream;
                    webcamContainer.classList.remove('hidden');
                    webcamContainer.classList.add('flex');
                } catch (err) {
                    showToast("Error accessing camera: " + err.message, "error");
                }
            } else {
                stopWebcam();
            }
        });

        btnCapture.addEventListener('click', () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0);
            
            canvas.toBlob((blob) => {
                selectedFile = new File([blob], "capture.jpg", { type: "image/jpeg" });
                fileName.textContent = "Camera Capture";
                
                photoPreview.src = URL.createObjectURL(blob);
                photoPreview.classList.remove('hidden');
                photoPlaceholder.classList.add('hidden');
                
                stopWebcam();
            }, 'image/jpeg');
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!selectedFile) {
                showToast("Please upload or capture a face photo.", "error");
                return;
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Registering...';
            submitBtn.disabled = true;

            const formData = new FormData();
            formData.append('name', document.getElementById('name').value);
            formData.append('roll_no', document.getElementById('roll_no').value);
            formData.append('ble_uuid', document.getElementById('ble_id').value);
            formData.append('photo', selectedFile);

            try {
                await api.registerStudent(formData);
                showToast("Student registered successfully!", "success");
                setTimeout(() => window.location.hash = '#students', 1000);
            } catch (error) {
                showToast(error.message, "error");
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
};
