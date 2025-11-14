import { GoogleGenAI, Type } from "@google/genai";
import type { TranslatedText } from '../types';
import { LANGUAGES } from "../languages";

// Fix: Adhere to Gemini API guidelines by using process.env.API_KEY directly and assuming it's set.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const responseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            originalText: {
                type: Type.STRING,
                description: "The original text detected in the image.",
            },
            translatedText: {
                type: Type.STRING,
                description: "The English translation of the original text.",
            },
            bounds: {
                type: Type.OBJECT,
                description: "The bounding box of the text as percentages.",
                properties: {
                    x: { type: Type.NUMBER, description: "Percentage from the left edge." },
                    y: { type: Type.NUMBER, description: "Percentage from the top edge." },
                    width: { type: Type.NUMBER, description: "Width as a percentage." },
                    height: { type: Type.NUMBER, description: "Height as a percentage." },
                },
                required: ["x", "y", "width", "height"],
            },
        },
        required: ["originalText", "translatedText", "bounds"],
    },
};

const languageMap = new Map(LANGUAGES.map(lang => [lang.code, lang.name]));
const getLangName = (code: string) => languageMap.get(code) || code.toUpperCase();

// TODO: SVG is not supported, and needs a middle function to convert SVG to jpg/PNG prior detection and translation. Problem may raise: SVG has no fixed size, it's hard or impossible to return correct boundaries.
export const translateTextInImage = async (
    base64Image: string,
    sourceLang: string,
    targetLang: string
): Promise<TranslatedText[]> => {
    const sourceLangName = getLangName(sourceLang);
    const targetLangName = getLangName(targetLang);

    const prompt = `Analyze the image to find all distinct text blocks. The original text is in ${sourceLangName}. For each block, provide:
1. The original text detected.
2. A translation of the text into ${targetLangName}.
3. The bounding box coordinates (x, y, width, height) as percentages of the total image dimensions. 'x' is the percentage from the left edge, and 'y' is the percentage from the top edge.
Ensure your response strictly adheres to the provided JSON schema. If no text is found, return an empty array.`;
    
    const match = base64Image.match(/^data:(.+);base64,(.+)$/);
    if (!match || match.length !== 3) {
        const errorMessage = "Invalid base64 image data URL format.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }
    
    const mimeType = match[1];
    const data = match[2];

    const imagePart = {
        inlineData: {
            mimeType: mimeType,
            data: data,
        },
    };

    const textPart = {
        text: prompt,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        // It's possible the model returns an empty string for no text
        if (!jsonText) {
            return [];
        }
        const parsedResponse = JSON.parse(jsonText);
        return parsedResponse as TranslatedText[];
    } catch (error) {
        console.error("Error in Gemini API call:", error);
        throw new Error("Failed to get translation from Gemini API.");
    }
};
