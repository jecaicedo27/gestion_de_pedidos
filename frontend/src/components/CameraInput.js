import React, { useState, useRef, useEffect } from 'react';
import { Camera, Video, Square, X, Image as ImageIcon, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const CameraInput = ({
    label,
    onFileSelect,
    accept = "image/*",
    required = false,
    id
}) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [fileName, setFileName] = useState('');

    // Cleanup on unmount
    useEffect(() => {
        return () => stopCamera();
    }, []);

    // Attach stream to video element when camera is turned on
    useEffect(() => {
        if (isCameraOn && streamRef.current && videoRef.current) {
            const video = videoRef.current;
            video.srcObject = streamRef.current;

            video.play()
                .then(() => {
                    // Video started playing
                })
                .catch(err => {
                    console.error("Error playing video:", err);
                    toast.error("Error al iniciar video");
                });
        }
    }, [isCameraOn]);

    const startCamera = async () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            // Configuración estándar
            const constraints = {
                video: { facingMode: { ideal: 'environment' } },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            setIsStreaming(false);
            setIsCameraOn(true); // This will render the video element and trigger the useEffect

        } catch (err) {
            console.error('Error accessing camera:', err);
            toast.error('No se pudo acceder a la cámara. Por favor usa la opción de subir archivo.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        setIsCameraOn(false);
        setIsStreaming(false);
    };

    const handleCanPlay = () => {
        setIsStreaming(true);
    };

    const capturePhoto = async () => {
        const video = videoRef.current;
        if (!video) return;

        if (!isStreaming) {
            toast.error('La cámara se está iniciando, espera un momento...');
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (!blob) {
                toast.error('Error al capturar la imagen');
                return;
            }

            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            handleFileSelection(file);
            stopCamera();
        }, 'image/jpeg', 1.0);
    };

    const handleFileInput = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelection(file);
        }
    };

    const handleFileSelection = (file) => {
        // Create preview
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setFileName(file.name);

        // Notify parent
        onFileSelect(file);
    };

    const clearSelection = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setFileName('');
        onFileSelect(null);
        stopCamera();
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            {!previewUrl && !isCameraOn && (
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={startCamera}
                        className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <Camera className="w-4 h-4 mr-2" />
                        Usar Cámara
                    </button>
                    <div className="relative flex-1">
                        <input
                            type="file"
                            id={id}
                            accept={accept}
                            onChange={handleFileInput}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button
                            type="button"
                            className="w-full h-full flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Subir Archivo
                        </button>
                    </div>
                </div>
            )}

            {isCameraOn && (
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                    {!isStreaming && (
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                        </div>
                    )}
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        onCanPlay={handleCanPlay}
                        className={`w-full h-full object-contain ${!isStreaming ? 'opacity-0' : 'opacity-100'}`}
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4 z-20">
                        <button
                            type="button"
                            onClick={stopCamera}
                            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none"
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <button
                            type="button"
                            onClick={capturePhoto}
                            disabled={!isStreaming}
                            className={`p-2 rounded-full focus:outline-none ${!isStreaming ? 'bg-gray-400 cursor-not-allowed' : 'bg-white text-black hover:bg-gray-200'}`}
                        >
                            <div className={`w-6 h-6 rounded-full border-2 border-black ${!isStreaming ? 'bg-gray-400' : 'bg-white'}`}></div>
                        </button>
                    </div>
                </div>
            )}

            {previewUrl && (
                <div className="relative rounded-lg border border-gray-200 p-2 bg-gray-50">
                    <div className="flex items-center space-x-3">
                        <img
                            src={previewUrl}
                            alt="Preview"
                            className="h-16 w-16 object-cover rounded-md"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {fileName}
                            </p>
                            <p className="text-xs text-gray-500">
                                Listo para subir
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="p-1 text-gray-400 hover:text-red-500 focus:outline-none"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CameraInput;
