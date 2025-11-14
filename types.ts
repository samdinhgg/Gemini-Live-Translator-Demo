export interface BoundingBox {
  x: number;      // percentage from left
  y: number;      // percentage from top
  width: number;  // percentage
  height: number; // percentage
}

export interface TranslatedText {
  originalText: string;
  translatedText: string;
  bounds: BoundingBox;
}
