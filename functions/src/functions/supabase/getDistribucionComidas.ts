import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import fetch from "node-fetch";
import { withAppCheck } from "../../core/middleware/withAppCheck";

const SUPABASE_KEY = defineSecret('SUPABASE_KEY');
const SUPABASE_URL = 'https://ewofgtwxbakwwzofdlbq.supabase.co';

export const getDistribucionComidas = onRequest(
  { secrets: [SUPABASE_KEY] },
  withAppCheck(async (req, res) => {
    try {
      const key = SUPABASE_KEY.value();
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/distribucion_calorias?select=*`,
        {
          headers: {
            apikey: key,
          }
        }
      );

      if (!response.ok) {
        return res.status(response.status).send(response.statusText);
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).send(err);
    }
  })
);
