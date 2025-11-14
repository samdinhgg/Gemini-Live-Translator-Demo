import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TranslatedText } from './types';
import { translateTextInImage } from './services/geminiService';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CameraIcon } from './components/CameraIcon';
import { NoCameraIcon } from './components/NoCameraIcon';
import { GalleryIcon } from './components/GalleryIcon';
import { GearIcon } from './components/GearIcon';
import { CloseIcon } from './components/CloseIcon';
import { LanguageModal } from './components/LanguageModal';
import { LANGUAGES } from './languages';

const App: React.FC = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing camera...");
  const [translatedItems, setTranslatedItems] = useState<TranslatedText[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

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
  
  const isStaticView = !!uploadedImage || !!capturedImage;
  const staticImageSource = uploadedImage || capturedImage;

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

    if (staticImageSource && image && image.naturalWidth) {
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
  }, [staticImageSource, stream]);

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
    if (isStaticView) {
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
      }
    };
    
    getCameraStream();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStaticView]);

  useEffect(() => {
      if (isStaticView || isLoading) return;

      if (stream) {
          setStatusMessage("Point at text and press the shutter button.");
      } else if (error) {
          setStatusMessage("Camera access denied.");
      } else {
          setStatusMessage("Initializing camera...");
      }
  }, [isStaticView, stream, error, isLoading]);
  
  const translateStaticImage = useCallback(async (base64Image: string) => {
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
    isCapturingRef.current = false;
  }, [sourceLang, targetLang]);
  
  useEffect(() => {
    if (staticImageSource) {
        translateStaticImage(staticImageSource);
    }
  }, [staticImageSource, translateStaticImage]);

  const handleCaptureAndTranslate = useCallback(async () => {
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
      setCapturedImage(base64Image);
    } else {
        setIsLoading(false);
        isCapturingRef.current = false;
        setStatusMessage("Failed to capture frame.");
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64Image = e.target?.result as string;
        if (base64Image) {
            setCapturedImage(null); // Clear any captured image
            setUploadedImage(base64Image);
        }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleGalleryClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleReturnToLiveView = () => {
    setUploadedImage(null);
    setCapturedImage(null);
    setTranslatedItems([]);
    setRenderDimensions(null);
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
        
        <header className="absolute top-8 left-0 right-0 z-40 flex justify-center items-center gap-2 px-4">
            <button onClick={() => handleOpenModal('source')} className="bg-black/50 text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-black/75 transition-colors">
                {getLangName(sourceLang)}
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            <button onClick={() => handleOpenModal('target')} className="bg-black/50 text-white text-sm font-medium py-2 px-4 rounded-full hover:bg-black/75 transition-colors">
                {getLangName(targetLang)}
            </button>
        </header>
        
        <main ref={mediaContainerRef} className="flex-grow relative w-full h-full bg-gray-800 mt-12 flex justify-center items-center overflow-hidden">
          {staticImageSource ? (
            <img
              ref={imageRef}
              src={staticImageSource}
              className="max-w-full max-h-full object-contain"
              onLoad={updateRenderDimensions}
              alt="Content for translation"
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
                      style={{ left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, overflow: 'hidden', boxSizing: 'border-box' }}
                  >
                      <p className="text-center font-semibold" style={{ fontSize: `clamp(8px, ${fontSize}px, 80px)`, lineHeight: 1 }}>
                          {item.translatedText}
                      </p>
                  </div>
              );
          })}
          
          <canvas ref={canvasRef} className="hidden"></canvas>

          {statusMessage && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-max max-w-xs p-4 flex justify-center items-center text-white z-20 pointer-events-none">
                <div className="bg-black/60 rounded-full px-4 py-2 flex items-center shadow-lg">
                    {isLoading && <LoadingSpinner />}
                    <p className={`ml-2 text-center text-sm font-medium ${isLoading ? 'animate-pulse' : ''}`}>{statusMessage}</p>
                </div>
            </div>
          )}
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/bmp,image/gif"
          />

          <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-around items-center p-4 h-28 bg-gradient-to-t from-black/80 to-transparent">
            <button onClick={handleGalleryClick} aria-label="Upload an image from your gallery" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <GalleryIcon />
            </button>

            <button
                onClick={isStaticView ? handleReturnToLiveView : handleCaptureAndTranslate}
                className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg ring-4 ring-black/30 transition-all duration-300 ease-in-out transform hover:scale-105"
                aria-label={isStaticView ? 'Return to live camera' : 'Capture and translate'}
            >
                {isStaticView ? <CloseIcon className="h-8 w-8 text-black" /> : <CameraIcon className="h-8 w-8 text-black" strokeWidth={2} />}
            </button>
            
             <button onClick={() => alert('Settings will be implemented in a future update.')} aria-label="Settings" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <GearIcon />
            </button>
          </div>
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