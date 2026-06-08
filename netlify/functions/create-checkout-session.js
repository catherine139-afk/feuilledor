const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

function parseEuroPrice(price) {
  const match = String(price || "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return 0;
  return Math.round(parseFloat(match[1].replace(",", ".")) * 100);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { items } = JSON.parse(event.body || "{}");

    if (!Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Le panier est vide." })
      };
    }

    const line_items = items.map((item) => {

      const unitAmount = parseEuroPrice(item.price);

      if (!unitAmount) {
        throw new Error(`Prix invalide pour ${item.name}`);
      }

      const details = [
        item.color ? `Couleur: ${item.color}` : null,
        item.shape ? `Forme: ${item.shape}` : null,
        item.length ? `Longueur: ${item.length}` : null,
        item.personalisation ? `Personnalisation: ${item.personalisation}` : null
      ]
      .filter(Boolean)
      .join(" · ");

      return {
        quantity: item.quantity || 1,
        price_data: {
          currency: "eur",
          unit_amount: unitAmount,
          product_data: {
            name: item.name,
            description: details
          }
        }
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items,

      success_url:
        `${process.env.SITE_URL}/?payment=success`,

      cancel_url:
        `${process.env.SITE_URL}/?payment=cancel`,

      billing_address_collection: "auto",

      phone_number_collection: {
        enabled: true
      },

      shipping_address_collection: {
        allowed_countries: [
          "FR",
          "BE",
          "DE",
          "LU",
          "NL",
          "ES",
          "IT",
          "PT",
          "AT",
          "IE"
        ]
      },

      allow_promotion_codes: true
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: session.url
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: error.message
      })
    };

  }
};
