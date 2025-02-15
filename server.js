require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Precios de las cuentas
const precios = {
    "Netflix Básico": 102, "Netflix Estándar": 185, "Netflix Premium": 299,
    "Disney Básico": 76, "Disney Premium": 185, "Spotify 1 Mes": 92,
    "Amazon Video": 55, "Max": 71, "Apple TV 1 Mes": 71,
    "Paramount+": 66, "Vix": 50, "YouTube Premium 1 Mes": 92,
    "Canva": 87, "FILMITY": 97
};

// 📌 **Ruta para crear sesión de pago en Stripe**
app.get('/checkout', async (req, res) => {
    const { nip, cuenta } = req.query;
    
    if (!nip || !cuenta) return res.status(400).json({ error: "Faltan parámetros (nip o cuenta)" });
    if (!precios[cuenta]) return res.status(400).json({ error: "Cuenta no válida" });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'oxxo', 'google_pay', 'apple_pay'],
            line_items: [{
                price_data: {
                    currency: 'mxn',
                    product_data: { name: cuenta },
                    unit_amount: precios[cuenta] * 100
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${process.env.SUCCESS_URL}?nip=${nip}`,
            cancel_url: process.env.CANCEL_URL
        });

        res.json({ checkoutUrl: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📌 **Webhook de Stripe para procesar pagos exitosos**
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    let event;
    try {
        event = JSON.parse(req.body);
    } catch (err) {
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const successUrl = new URL(session.success_url);
        const nip = successUrl.searchParams.get('nip');

        if (nip) {
            try {
                await fetch(`${process.env.UPDATE_NIP_URL}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nip })
                });
                console.log(`✅ NIP ${nip} renovado correctamente.`);
            } catch (error) {
                console.error("❌ Error al actualizar NIP en la base de datos:", error);
            }
        }
    }

    res.sendStatus(200);
});

// 📌 **Iniciar servidor en puerto dinámico para Render**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
