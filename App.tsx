import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TranslatedText } from './types';
import { translateTextInImage } from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CameraIcon } from './components/CameraIcon';
import { NoCameraIcon } from './components/NoCameraIcon';
import { GalleryIcon } from './components/GalleryIcon';
import { LanguageModal } from './components/LanguageModal';
import { LANGUAGES } from './languages';

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing camera...");
  const [translatedItems, setTranslatedItems] = useState<TranslatedText[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const [sourceLang, setSourceLang] = useState<string>('en');
  const [targetLang, setTargetLang] = useState<string>('vi');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [languageSelectionMode, setLanguageSelectionMode] = useState<'source' | 'target' | null>(null);

  const [renderDimensions, setRenderDimensions] = useState<{
    x: number; y: number; width: number; height: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaContainerRef = useRef<HTMLElement>(null);
  const isCapturingRef = useRef<boolean>(false);

  const updateRenderDimensions = useCallback(() => {
    const container = mediaContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    let sourceWidth = 0;
    let sourceHeight = 0;
    let isContain = false;

    const video = videoRef.current;
    const image = imageRef.current;

    if (uploadedImage && image && image.naturalWidth) {
        sourceWidth = image.naturalWidth;
        sourceHeight = image.naturalHeight;
        isContain = true;
    } else if (stream && video && video.videoWidth) {
        sourceWidth = video.videoWidth;
        sourceHeight = video.videoHeight;
        isContain = false; // object-cover for video
    }

    if (!sourceWidth || !sourceHeight) {
        setRenderDimensions(null);
        return;
    }

    const sourceAspectRatio = sourceWidth / sourceHeight;
    const containerAspectRatio = containerWidth / containerHeight;

    let renderWidth, renderHeight;

    if (isContain) { // Simulates 'object-contain'
        if (sourceAspectRatio > containerAspectRatio) {
            renderWidth = containerWidth;
            renderHeight = containerWidth / sourceAspectRatio;
        } else {
            renderHeight = containerHeight;
            renderWidth = containerHeight * sourceAspectRatio;
        }
    } else { // Simulates 'object-cover'
        if (sourceAspectRatio > containerAspectRatio) {
            renderHeight = containerHeight;
            renderWidth = containerHeight * sourceAspectRatio;
        } else {
            renderWidth = containerWidth;
            renderHeight = containerWidth / sourceAspectRatio;
        }
    }

    const x = (containerWidth - renderWidth) / 2;
    const y = (containerHeight - renderHeight) / 2;
    
    setRenderDimensions({ x, y, width: renderWidth, height: renderHeight });
  }, [uploadedImage, stream]);

  useEffect(() => {
    const container = mediaContainerRef.current;
    if (!container) return;
    const resizeObserver = new ResizeObserver(() => {
        updateRenderDimensions();
    });
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [updateRenderDimensions]);


  useEffect(() => {
    if (uploadedImage) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      return;
    }

    const getCameraStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setError(null);
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Camera access denied. Please enable camera permissions in your browser settings.");
        setStatusMessage("Camera access denied.");
      }
    };
    
    getCameraStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImage]);
  
  const captureFrameAndTranslate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturingRef.current) {
      return;
    }

    const video = videoRef.current;
    if (video.readyState < 2) {
      return;
    }

    isCapturingRef.current = true;
    setIsLoading(true);
    setTranslatedItems([]);
    setStatusMessage("Capturing view...");

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg');

      try {
        setStatusMessage("Translating text...");
        const result = await translateTextInImage(base64Image, sourceLang, targetLang);
        if (result && result.length > 0) {
          setTranslatedItems(result);
          setStatusMessage("");
        } else {
          setStatusMessage("No text found. Hold steady.");
        }
      } catch (apiError) {
        console.error("Gemini API error:", apiError);
        setStatusMessage("Translation failed. Please try again.");
      }
    }

    setIsLoading(false);
    isCapturingRef.current = false;
  }, [sourceLang, targetLang]);

  const translateUploadedImage = useCallback(async (base64Image: string) => {
    setIsLoading(true);
    setTranslatedItems([]);
    setStatusMessage("Analyzing image...");

    try {
        setStatusMessage("Translating text...");
        const result = await translateTextInImage(base64Image, sourceLang, targetLang);
        if (result && result.length > 0) {
            setTranslatedItems(result);
            setStatusMessage("");
        } else {
            setStatusMessage("No text found in image.");
        }
    } catch (apiError) {
        console.error("Gemini API error:", apiError);
        setStatusMessage("Translation failed. Please try again.");
    }

    setIsLoading(false);
  }, [sourceLang, targetLang]);
  
  useEffect(() => {
    if (uploadedImage) {
        translateUploadedImage(uploadedImage);
    }
  }, [uploadedImage, translateUploadedImage]);

  useEffect(() => {
    if (!stream || uploadedImage) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    const startCaptureLoop = () => {
        intervalId = setInterval(() => {
            captureFrameAndTranslate();
        }, 4000);
    };

    if (videoRef.current) {
        videoRef.current.onplaying = () => {
            setStatusMessage("Hold camera still to translate...");
            startCaptureLoop();
        };
    }

    return () => {
        clearInterval(intervalId);
    };
  }, [stream, captureFrameAndTranslate, uploadedImage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Image = e.target?.result as string;
        if (base64Image) {
            setUploadedImage(base64Image);
        }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleCloseUploadedImage = () => {
    setUploadedImage(null);
    setTranslatedItems([]);
    setRenderDimensions(null);
    setStatusMessage("Initializing camera...");
  };

  const getLangName = useCallback((code: string) => {
    return LANGUAGES.find(lang => lang.code === code)?.name || code;
  }, []);

  const handleOpenModal = (mode: 'source' | 'target') => {
    setLanguageSelectionMode(mode);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setLanguageSelectionMode(null);
  };
  
  const handleSelectLanguage = (langCode: string) => {
    if (languageSelectionMode === 'source') {
      setSourceLang(langCode);
    } else if (languageSelectionMode === 'target') {
      setTargetLang(langCode);
    }
    handleCloseModal();
  };

  return (
    <div className="bg-gray-900 flex justify-center items-center min-h-screen font-sans">
      <div className="w-full max-w-md h-[80vh] md:h-[90vh] bg-black rounded-3xl shadow-2xl overflow-hidden relative flex flex-col border-4 border-gray-700">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-gray-700 rounded-b-xl z-50 flex items-center justify-center">
            <div className="w-8 h-2 bg-gray-800 rounded-full"></div>
        </div>
        
        <div className="absolute top-8 left-0 right-0 z-40 flex justify-center items-center gap-2 px-4">
            <button onClick={() => handleOpenModal('source')} className="bg-black/50 text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-black/75 transition-colors">
                {getLangName(sourceLang)}
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <button onClick={() => handleOpenModal('target')} className="bg-black/50 text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-black/75 transition-colors">
                {getLangName(targetLang)}
            </button>
        </div>
        
        <main ref={mediaContainerRef} className="flex-grow relative w-full h-full bg-gray-800 mt-12 flex justify-center items-center overflow-hidden">
          {uploadedImage ? (
            <img
              ref={imageRef}
              src={uploadedImage}
              className="max-w-full max-h-full object-contain"
              onLoad={updateRenderDimensions}
              alt="Uploaded content"
            />
          ) : stream ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
              onLoadedMetadata={updateRenderDimensions}
            />
          ) : (
             <div className="w-full h-full flex flex-col justify-center items-center text-gray-400">
                {error ? <NoCameraIcon /> : <CameraIcon strokeWidth={1} />}
                <p className="mt-4 text-center px-4">{error || "Requesting camera access..."}</p>
             </div>
          )}

          {renderDimensions && translatedItems.map((item, index) => {
              const { bounds } = item;
              const left = renderDimensions.x + (bounds.x / 100 * renderDimensions.width);
              const top = renderDimensions.y + (bounds.y / 100 * renderDimensions.height);
              const width = bounds.width / 100 * renderDimensions.width;
              const height = bounds.height / 100 * renderDimensions.height;
              
              const fontSize = height * 0.75;

              return (
                  <div
                      key={index}
                      className="absolute bg-black bg-opacity-75 text-white p-1 rounded-sm flex items-center justify-center transition-all duration-300 ease-in-out"
                      style={{
                          left: `${left}px`,
                          top: `${top}px`,
                          width: `${width}px`,
                          height: `${height}px`,
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                      }}
                  >
                      <p
                          className="text-center font-semibold"
                          style={{
                              fontSize: `clamp(8px, ${fontSize}px, 80px)`,
                              lineHeight: 1,
                          }}
                      >
                          {item.translatedText}
                      </p>
                  </div>
              );
          })}
          
          <canvas ref={canvasRef} className="hidden"></canvas>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center text-white z-20">
            {isLoading && <LoadingSpinner />}
            {statusMessage && <p className="ml-2 text-center text-sm font-medium animate-pulse">{statusMessage}</p>}
          </div>

          {/* Hidden file input, controlled by the FAB */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
          />

          {/* Floating Action Button */}
          {uploadedImage ? (
              <button
                  onClick={handleCloseUploadedImage}
                  className="absolute bottom-6 right-6 z-30 w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg hover:bg-cyan-600 transition-all duration-300 ease-in-out transform hover:scale-105"
                  aria-label="Return to live camera"
              >
                  <CameraIcon className="h-8 w-8 text-white" strokeWidth={1.5} />
              </button>
          ) : (
              <button
                  onClick={handleGalleryClick}
                  className="absolute bottom-6 right-6 z-30 w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all duration-300 ease-in-out transform hover:scale-105"
                  aria-label="Upload an image from your gallery"
              >
                  <GalleryIcon />
              </button>
          )}
        </main>

        <LanguageModal 
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onSelectLanguage={handleSelectLanguage}
            languages={LANGUAGES}
            title={`Select ${languageSelectionMode === 'source' ? 'Source' : 'Target'} Language`}
        />
      </div>
    </div>
  );
};

export default App;