import cors from "cors";
import { admin } from "../admin";

const corsHandler = cors({ origin: 'https://proyectobdd-nutricion.web.app' });

export function withAppCheck(handler: (req: any, res: any) => Promise<any> | any) {
  return (req: any, res: any) => {
    return corsHandler(req, res, async () => {
      const token = req.header("X-Firebase-AppCheck");
      if (!token) {
        return res.status(403).send("App Check token missing");
      }

      try {
        await admin.appCheck().verifyToken(token);
        return handler(req, res);
      } catch (error) {
        return res.status(403).send("Invalid App Check token");
      }
    });
  };
}
