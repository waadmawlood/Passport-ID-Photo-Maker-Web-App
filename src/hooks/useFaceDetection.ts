import { useState, useCallback } from 'react';
import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export function useFaceDetection() {
  const [isDetecting, setIsDetecting] = useState(false);

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return;

    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
      modelsLoaded = true;
    } catch (error) {
      console.error('Error loading face detection models:', error);
      throw error;
    }
  }, []);

  const detectFace = useCallback(
    async (
      imageUrl: string
    ): Promise<{ x: number; y: number; width: number; height: number } | null> => {
      setIsDetecting(true);

      try {
        await loadModels();

        const img = await faceapi.fetchImage(imageUrl);
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (!detection) {
          return null;
        }

        const { box } = detection.detection;
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      } catch (error) {
        console.error('Face detection error:', error);
        return null;
      } finally {
        setIsDetecting(false);
      }
    },
    [loadModels]
  );

  const getFaceLandmarks = useCallback(
    async (imageUrl: string) => {
      setIsDetecting(true);

      try {
        await loadModels();

        const img = await faceapi.fetchImage(imageUrl);
        const detection = await faceapi
          .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (!detection) {
          return null;
        }

        return {
          box: detection.detection.box,
          landmarks: detection.landmarks,
          leftEye: detection.landmarks.getLeftEye(),
          rightEye: detection.landmarks.getRightEye(),
          nose: detection.landmarks.getNose(),
          mouth: detection.landmarks.getMouth(),
        };
      } catch (error) {
        console.error('Face landmarks error:', error);
        return null;
      } finally {
        setIsDetecting(false);
      }
    },
    [loadModels]
  );

  return { detectFace, getFaceLandmarks, isDetecting, loadModels };
}