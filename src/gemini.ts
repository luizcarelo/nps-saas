
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });

const MODEL_ID = 'gemini-2.5-flash'; // rápido e econômico
// Alternativas: 'gemini-1.5-flash' ou modelos mais robustos conforme caso

export async function analyzeNpsEntry(input: {
  score: number; // 0..10
  comment: string; // texto livre do usuário
  userId?: string;
  accountId?: string;
}) {
  const prompt = [
    {
      role: 'user',
      parts: [
        {
          text:
`Você é um analista de CX.
Com base na nota NPS (${input.score}) e no comentário abaixo, produza um JSON bem-formado com:
- resumo: string (até 280 chars)
- sentimento: "positivo" | "neutro" | "negativo"
- urgencia: "baixa" | "media" | "alta"
- temas: string[] (ex.: ["preço","suporte","qualidade","UX","performance"])
- acao_sugerida: string (próximo passo objetivo)
- followup: string (mensagem curta para responder ao cliente)

Comentário:
${input.comment}

Responda APENAS com JSON válido.`}
      ]
    }
  ];

  const response = await ai.models.generateContent({
    model: MODEL_ID,
    contents: prompt
  });

  // O SDK expõe .text com o conteúdo; faça parsing do JSON retornado
  const text = response.text;
  const parsed = JSON.parse(text);

  return {
    ...parsed,
    score: input.score,
    userId: input.userId,
    accountId: input.accountId,
    createdAt: new Date().toISOString()
  };
}
``
