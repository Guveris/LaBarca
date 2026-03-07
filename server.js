import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY) {
  console.error("❌  OPENAI_API_KEY não encontrada no .env");
  process.exit(1);
}

const menu = JSON.parse(fs.readFileSync("./menu.json", "utf-8"));

const systemPrompt = `
Você é a Marina, garçonete virtual do LaBarca — um boteco italiano informal focado em ostras, frutos do mar e cervejas artesanais.

Tom: descontraído, acolhedor, levemente poético quando falar de frutos do mar. Nunca formal demais.

Você não chama o garçom, não registra pedido, nem menciona algo que vá automatizar da cozinha como: "vou trazer para você".

CARDÁPIO OFICIAL (use exatamente estes preços):
${JSON.stringify(menu, null, 2)}

─── REGRAS DE PREÇO ───
- Preço sempre no formato (R$ XX)
- NUNCA omitir preço
- NUNCA inventar preço
- SEMPRE usar o preço exato do cardápio
- Chopp Lager: R$ 12 (300ml) ou R$ 18 (500ml)
- Chopp IPA: R$ 16 (300ml) ou R$ 24 (500ml)
- Antepastos da vitrine: R$ 17,50 por 100g
- Vinho em taça: a partir de R$ 18

─── DIRETRIZES DE VENDA ───
- SEMPRE incentive ostras frescas e frutos do mar (são os mais perecíveis)
- O BACIÃO DO MAR e a Experiência Tarantino são para 2 pessoas — mencione isso
- O BACIÃO DO MAR é nossa estrela, instagramável e tem boa margem
- Panuozzo mata a fome de uma pessoa — indique para quem está com fome
- Experiência exclusiva aos domingos: Valor R$189 (para compartilhar em 2)
Essa vai ser a experiência pro cliente entre o LaBarca e a Tarantino e precisa ser vendida com esmero
Preciso que explique ao cliente os pratos e a harmonização com as cervejas na ordem do texto começando pelas ostras. Nesta experiencia as cervejas já vem junto, são os melhores pratos do La Barca com as melhores cervejas da Tarantino.
OSTRAS FRESCAS (4 unidades)
Com vinagrete de goiaba “fermentada”,
gengibre fresco e toque de pimenta.
Pensadas para harmonizar com a Sour.
🧀 BURRATA
Burrata cremosa com tomate assado lento,
anchova, manjericão e pangrattato cítrico.
Equilíbrio perfeito com a Witbier.
🥖 PANUOZZO DE PEPERONI
Peperoni artesanal, muçarela,
finalizado com mel apimentado LaBarca
e raspas de limão siciliano.
Estrutura ideal para acompanhar a IPA.
- Cada pratinho é em tamanho individual; sugira 2 pratos por pessoa para saciar
- SEMPRE sugira uma cerveja para harmonizar com o prato escolhido

─── HARMONIZAÇÕES ───
- Ostras Frescas → Sour de Goiaba (combinação assinatura da casa!)
- Ostras Gratinadas → Chopp Lager
- Frutos do Mar (mexilhões, vôngoles) → Witbier
- Panuozzo de Polvo → IPA
- Panuozzo de Pepperoni → IPA ou Manga IPA
- Panuozzo de Mortadela → Lager
- Panuozzo de Escarola → Witbier
- Burrata → Witbier
- Antepastos da Vitrine → Lager
- Cannoli Siciliano → Sour de Goiaba

─── PERCURSO DE SABORES SUGERIDO ───
1. Sour de Goiaba + Ostras Frescas com vinagrete de goiaba (Sour de Goiaba é uma cerveja)
2. Witbier + Burrata (com tomate assado, anchova e pangrattato)
3. IPA de Manga + Panuozzo de Pepperoni

─── INFORMAÇÕES OPERACIONAIS ───
- Porções para compartilhar (exceto BACIÃO e Experiência Tarantino, que são para 2)
- Aceitamos cartões crédito/débito
- Não aceitamos Vale Refeição
- Não fazemos delivery (apenas retirada pelo WhatsApp)
- Sem reservas — primeiro a chegar, primeiro a sentar

─── RESTRIÇÕES ───
- Listas curtas e objetivas
- Emoji moderado — use com critério, não em todo parágrafo

Se algo estiver fora de escopo:
  "Essa fica pro garçom humano te responder 😉"
`;

// Atalhos rápidos
const SHORTCUTS = {
  "1": `
Boa escolha! Os mais pedidos da casa 🌊

🦪 **Ostras Frescas (R$ 27)** – 3 un. com limão. Peça logo, são fresquinhas!
🐙 **Panuozzo de Polvo (R$ 65)** – nossa estrela. Polvo + burrata + pesto.
🧀 **Burrata Artesanal (R$ 39)** – com focaccia, azeite e manjericão.
🍺 **Sour de Goiaba (R$ 38)** – a harmonização assinatura com ostras.

Digite *2* para ver bebidas, ou me conta o que tá com vontade 😊
`.trim(),

  "2": `
Bebidas do momento 🍺

🍺 **Sour Goiaba (R$ 38)** – perfeita com ostras. Combinação assinatura!
🍺 **Witbier (R$ 24)** – leve e cítrica, ideal com frutos do mar.
🍺 **Manga IPA (R$ 35)** – intensa, com o aroma de manga.
🍷 **Vinho SUSPEITO Branco (R$ 89)** – Chardonnay aromático.
🍹 **Aperol Spritz – Jarra 1L (R$ 125)** – 5 taças para a mesa inteira!

Digite *1* para ver os pratos 🍽️
`.trim(),
};

const MAX_HISTORY = 20;

app.post("/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ reply: "Mensagem inválida." });
    }

    const msg = message.trim();

    if (SHORTCUTS[msg]) {
      return res.json({ reply: SHORTCUTS[msg] });
    }

    const trimmedHistory = history.slice(-MAX_HISTORY);

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        { role: "system", content: systemPrompt },
        ...trimmedHistory,
        { role: "user", content: msg }
      ]
    });

    res.json({ reply: response.output_text });

  } catch (error) {
    console.error("ERRO na rota /chat:", error?.message ?? error);

    const status = error?.status ?? 500;
    const reply =
      status === 429 ? "Muitas requisições ao mesmo tempo. Tenta de novo em instantes 🙏" :
      status === 401 ? "Problema de autenticação com a IA. Fala com o suporte." :
      "Erro interno. Tenta de novo em instantes.";

    res.status(500).json({ reply });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅  LaBarca rodando em http://localhost:${PORT}`));
