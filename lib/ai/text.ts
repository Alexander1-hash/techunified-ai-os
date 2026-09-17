import OpenAI from "openai";

const DEFAULT_MODEL = "gpt-5.6-luna";

export type TextAIRequest = {
  prompt: string;
  model?: string;
  system?: string;
};

export type TextAIResult = {
  text: string;
  model: string;
};

export async function runTextAI(
  request: TextAIRequest
): Promise<TextAIResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("AI provider configuration is missing");
  }

  const prompt = request.prompt.trim();

  if (!prompt) {
    throw new Error("AI prompt is required");
  }

  const model =
    request.model?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL;

  const openai = new OpenAI({
    apiKey,
  });

  const input = [];

  if (request.system?.trim()) {
    input.push({
      role: "developer" as const,
      content: request.system.trim(),
    });
  }

  input.push({
    role: "user" as const,
    content: prompt,
  });

  const response = await openai.responses.create({
    model,
    input,
  });

  return {
    text: response.output_text,
    model,
  };
    }
