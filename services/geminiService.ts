import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

export const getSmartLocationInsights = async (locationName: string): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return "AI insights unavailable (Missing API Key)";

  try {
    const ai = getAI();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a 1-sentence interesting fact or travel tip about going to ${locationName}. Keep it short and helpful for a ride-hailing passenger.`,
    });
    return response.text || "Enjoy your ride!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Enjoy your safe and comfortable ride.";
  }
};

export const getAIChatResponse = async (userMessage: string, context: string): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return "I am an AI assistant. How can I help?";

  try {
    const ai = getAI();
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}. User says: "${userMessage}". Reply as a helpful ride-hailing support assistant named Mowasla AI. Keep it brief.`,
    });
    return response.text || "I'm having trouble connecting. Please try again.";
  } catch (_error) {
    console.error("Gemini Chat Error:", _error);
    return "Service temporarily unavailable.";
  }
};

/**
 * Verifies if the provided National ID number exists within the provided ID Card image.
 * Uses Gemini Vision for high-accuracy OCR and validation.
 */
export const verifyIdentityDocument = async (base64Image: string, enteredIdNumber: string): Promise<{ isValid: boolean; reason?: string }> => {
  if (!process.env.GEMINI_API_KEY) return { isValid: true, reason: "Bypassed: No API Key" };

  try {
    const ai = getAI();
    // Clean base64 string
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

    // Using responseSchema for robust JSON extraction as per guidelines
    // Upgraded to gemini-3-pro-preview for complex reasoning/OCR task
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview', 
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: `Strictly analyze this identity document image (Egyptian National ID). 
            Does the specific number sequence "${enteredIdNumber}" appear clearly on this document?
            The ID might use Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩) or Western Arabic numerals (0123456789).
            1. Check for visual matches of the digits.
            2. Ignore small OCR errors (like 0 vs O) but ensure the sequence matches.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: {
              type: Type.BOOLEAN,
              description: "Whether the ID number matches the one in the image."
            },
            reason: {
              type: Type.STRING,
              description: "A short explanation for the verification result."
            }
          },
          required: ["match", "reason"],
          propertyOrdering: ["match", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    return { 
      isValid: result.match === true, 
      reason: result.reason || "ID verification failed." 
    };

  } catch (error) {
    console.error("Identity Verification Error:", error);
    return { isValid: false, reason: "AI Service unavailable. Please retake a clear photo." };
  }
};

/**
 * AI Pricing Assistant
 * Suggests a fair trip price based on distance, duration, and traffic.
 */
export const getRidePriceSuggestion = async (
  distanceKm: number,
  durationMin: number,
  traffic: 'low' | 'medium' | 'high' = 'medium'
): Promise<{ suggested_price: number; min_price: number; max_price: number; confidence: string } | null> => {
  if (!process.env.GEMINI_API_KEY) return null;

  try {
    const ai = getAI();
    // Upgraded to gemini-3.1-pro-preview for logic/pricing calculation task
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `You are an AI pricing assistant for an Egyptian ride-hailing app similar to InDrive.

Goal: Suggest a fair trip price that balances driver profit and rider acceptance.

Pricing base:
- Base fare: 8 EGP
- Price per km: 3.25 EGP
- Price per minute: 0.5 EGP
- Minimum fare: 25 EGP

Rules:
- Calculate suggested price based on the inputs provided.
- Round to nearest 5 EGP.
- Apply minimum fare (25 EGP).
- Provide a price range (+/- 15%).
- Confidence depends on traffic impact (High traffic lowers confidence due to variability).

Input:
- Distance: ${distanceKm} km
- Duration: ${durationMin} minutes
- Traffic level: ${traffic}
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggested_price: { type: Type.NUMBER },
            min_price: { type: Type.NUMBER },
            max_price: { type: Type.NUMBER },
            confidence: { type: Type.STRING }
          },
          required: ["suggested_price", "min_price", "max_price", "confidence"],
          propertyOrdering: ["suggested_price", "min_price", "max_price", "confidence"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Price Error:", error);
    return null;
  }
};