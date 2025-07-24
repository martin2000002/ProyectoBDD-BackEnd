import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import fetch from "node-fetch";
import { withAppCheck } from "../../core/middleware/withAppCheck";

const SUPABASE_KEY = defineSecret('SUPABASE_KEY');

export const getObjetivos = onRequest(
  { secrets: [SUPABASE_KEY] },
  withAppCheck(async (req, res) => {
    const key = SUPABASE_KEY.value();
    const resp = await fetch('https://ewofgtwxbakwwzofdlbq.supabase.co/rest/v1/objetivos', {
      headers: { apikey: key }
    });

    if (!resp.ok) return res.status(resp.status).send(resp.statusText);
    return res.status(200).json(await resp.json());
  })
);
