
const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function parseEuroPrice(price) {
  const match = String(price || "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;
  return Math.round(Number(match[1].replace(",", ".")) * 100);
}

function clean(value) {
  return String(value || "").trim();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY manquant dans Vercel.");
    }

    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Le panier est vide." });
    }

    const line_items = items.map((item) => {
      const unitAmount = parseEuroPrice(item.price);

      if (!unitAmount) {
        throw new Error(`Prix invalide pour ${clean(item.name) || "un article"}.`);
      }

      const quantity = Math.max(1, Number(item.quantity || item.qty || 1));

      const details = [
        item.color ? `Couleur : ${clean(item.color)}` : null,
        item.shape ? `Forme : ${clean(item.shape)}` : null,
        item.length ? `Longueur : ${clean(item.length)}` : null,
        item.personalisation ? `Personnalisation : ${clean(item.personalisation)}` : null
      ].filter(Boolean).join(" · ");

      return {
        quantity,
        price_data: {
          currency: "eur",
          unit_amount: unitAmount,
          product_data: {
            name: clean(item.name) || "Produit Feuille d’Or",
            description: details || undefined,
            metadata: {
              product_id: clean(item.id),
              variant_id: clean(item.variantId),
              color: clean(item.color),
              shape: clean(item.shape),
              length: clean(item.length),
              personalisation: clean(item.personalisation)
            }
          }
        }
      };
    });

    const siteUrl =
      process.env.SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
      "https://catherine139-afk.github.io/feuilledor";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${siteUrl}/?payment=success`,
      cancel_url: `${siteUrl}/?payment=cancel`,
      billing_address_collection: "auto",
      phone_number_collection: {
        enabled: true
      },
      shipping_address_collection: {
        allowed_countries: [
          "FR", "BE", "DE", "LU", "NL", "ES", "IT", "PT", "AT", "IE"
        ]
      },
      allow_promotion_codes: true
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
