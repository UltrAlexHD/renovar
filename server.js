require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

// 🏷 **Alias de cuentas (para que coincidan con la base de datos)**
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

// 📌 **Ruta para crear sesión de pago en Stripe**
app.get('/checkout', async (req, res) => {
    let { nip, cuenta } = req.query;
    
    // Si la cuenta tiene un alias, se cambia al nombre correcto
    cuenta = aliasCuentas[cuenta] || cuenta;

    if (!nip || !cuenta) return res.status(400).json({ error: "Faltan parámetros (nip o cuenta)" });
    if (!precios[cuenta]) return res.status(400).json({ error: "Cuenta no válida" });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'oxxo', 'link'], // Métodos habilitados en Stripe
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

        res.redirect(session.url); // Redirigir directamente a Stripe para el pago
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
