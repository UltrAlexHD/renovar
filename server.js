require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 🏷 **Precios de las cuentas**
const precios = {
    "Netflix Básico": 102, "Netflix Estándar": 185, "Netflix Premium": 299, "Netflix Ultra Premium": 517,
    "Disney Básico": 76, "Disney Premium": 185, 
    "Spotify 1 Mes": 92, "Spotify 2 Meses": 154, "Spotify 3 Meses": 216,
    "Amazon Video": 55, "Max": 71, 
    "Apple TV 1 Mes": 71, "Apple TV 3 Meses": 133,
    "Paramount+": 66, "Vix": 50, 
    "YouTube Premium 1 Mes": 92, "YouTube Premium 2 Meses": 154, "YouTube Premium 3 Meses": 216,
    "Canva": 87, "FILMITY": 97, "FILMITY ESTRENOS CINE": 154
};

// 🏷 **Alias de cuentas**
const aliasCuentas = {
    "Netflix": "Netflix Básico",
    "Disney": "Disney Básico",
    "Spotify": "Spotify 1 Mes",
    "Amazon": "Amazon Video",
    "HBO Max": "Max",
    "Apple TV": "Apple TV 1 Mes",
    "Paramount": "Paramount+",
    "YouTube": "YouTube Premium 1 Mes",
    "Filmity": "FILMITY"
};

// 📌 **Página de pago en Render**
app.get('/pago', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pago.html'));
});

// 📌 **Redirección a Stripe**
app.get('/checkout', async (req, res) => {
    let { nip, cuenta } = req.query;
    cuenta = aliasCuentas[cuenta] || cuenta;

    if (!nip || !cuenta) return res.send("⚠️ Error: Faltan parámetros (nip o cuenta)");
    if (!precios[cuenta]) return res.send("⚠️ Error: Cuenta no válida");

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

        res.redirect(session.url);
    } catch (err) {
        res.send(`⚠️ Error: ${err.message}`);
    }
});

// 📌 **Webhook de Stripe para actualizar InfinityFree**
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

// 📌 **Iniciar servidor**
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
