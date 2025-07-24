import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import fetch from "node-fetch";
import { withAppCheck } from "../../core/middleware/withAppCheck";

const SUPABASE_KEY = defineSecret('SUPABASE_KEY');

export const getRangosNutricionales = onRequest(
  { secrets: [SUPABASE_KEY] },
  withAppCheck(async (req, res) => {
    const key = SUPABASE_KEY.value();

    // Leer parámetros de la query
    const objetivoId = req.query.objetivo_id;
    const columna = req.query.columna;

    // Validaciones simples
    if (!objetivoId) return res.status(400).send("Missing 'objetivo_id' query param");
    if (!columna) return res.status(400).send("Missing 'columna' query param");

    // Solo permitir columnas válidas para evitar inyección
    const columnasValidas = ['valor_minimo', 'valor_moderado', 'valor_maximo'];
    if (!columnasValidas.includes(columna as string)) {
      return res.status(400).send("Invalid 'columna' param. Must be one of: valor_minimo, valor_moderado, valor_maximo");
    }

    // Construir URL de Supabase con filtro por objetivo_id
    // Seleccionamos tipo_macro y la columna solicitada
    const url = `https://ewofgtwxbakwwzofdlbq.supabase.co/rest/v1/rangos_nutricionales?objetivo_id=eq.${objetivoId}&select=tipo_macro,${columna}`;

    const resp = await fetch(url, {
      headers: {
        apikey: key,
        'Content-Type': 'application/json'
      }
    });

    if (!resp.ok) {
      return res.status(resp.status).send(resp.statusText);
    }

    const data = await resp.json();

    // Retornar directamente el array con tipo_macro y valor pedido
    return res.status(200).json(data);
  })
);
