// src/supabase/getProductosParaMenu.ts
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import fetch from "node-fetch";
import { withAppCheck } from "../../core/middleware/withAppCheck";

const SUPABASE_KEY = defineSecret("SUPABASE_KEY");
const SUPABASE_URL = "https://ewofgtwxbakwwzofdlbq.supabase.co";

type ComidaFlag = 'desayuno' | 'almuerzo' | 'merienda';

interface Nutricion {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

interface Producto {
  id: number;
  nombre: string;
  cantidad_actual_g: number;
  categoria_id: number;
  proteinas_g: number;
  grasas_g: number;
  carbohidratos_g: number;
  calorias: number;
  es_complemento: boolean;
  desayuno: boolean;
  almuerzo: boolean;
  merienda: boolean;
}

interface Params {
  desayuno: Nutricion;
  almuerzo: Nutricion;
  merienda: Nutricion;
}

export const getPosiblesProductos = onRequest(
  { secrets: [SUPABASE_KEY] },
  withAppCheck(async (req, res) => {
    try {
      const key = SUPABASE_KEY.value();
      const params: Params = req.body;
      if (!params || !params.desayuno || !params.almuerzo || !params.merienda) {
        return res.status(400).send("Faltan parámetros nutricionales");
      }

      // Paso 2: obtener todos los productos
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/productos?select=*`,
        { headers: { apikey: key } }
      );
      if (!resp.ok) throw new Error("Error leyendo productos");
      let productos: Producto[] = await resp.json();

      // Función para ordenar por flags y aleatoriedad
      const ordenarPool = (pool: Producto[], prioridad: ComidaFlag[]) => {
        return pool
          .slice()
          .sort((a, b) => {
            if (a[prioridad[0]] !== b[prioridad[0]]) return a[prioridad[0]] ? -1 : 1;
            if (a[prioridad[1]] !== b[prioridad[1]]) return a[prioridad[1]] ? -1 : 1;
            if (a[prioridad[2]] !== b[prioridad[2]]) return a[prioridad[2]] ? -1 : 1;
            return Math.random() - 0.5;
          });
      };

      // Función genérica de selección
      function seleccionarProteinaOCarbo(
        pool: Producto[],
        catId: number,
        reqCantidad: number,
        macroKey: keyof Producto,
        minItems: number
      ) {
        let acumulado = 0;
        const seleccion: any[] = [];
        for (const p of pool.filter(p => p.categoria_id === catId)) {
          if (acumulado >= reqCantidad && seleccion.length >= minItems) break;
          const gramosNecesarios = (reqCantidad * 100) / Number(p[macroKey]);
          const gramos = Math.min(p.cantidad_actual_g, gramosNecesarios);
          const aporte = (gramos * Number(p[macroKey])) / 100;
          acumulado += aporte;
          seleccion.push({
            id: p.id,
            nombre: p.nombre,
            cantidad_g: gramos,
            proteinas: (gramos * p.proteinas_g) / 100,
            carbohidratos: (gramos * p.carbohidratos_g) / 100,
            grasas: (gramos * p.grasas_g) / 100,
            calorias: (gramos * p.calorias) / 100,
          });
        }
        const usados = new Set(seleccion.map(s => s.id));
        const restantes = pool.filter(p => !usados.has(p.id));
        return { seleccion, restantes };
      }

      // Función genérica para frutas/veg/complementos
      function seleccionarConTope(
        pool: Producto[],
        catId: number,
        maxItems: number,
        pesoIdeal: number
      ) {
        const seleccion: any[] = [];
        for (const p of pool.filter(p => p.categoria_id === catId)) {
          if (seleccion.length >= maxItems) break;
          const gramos = Math.min(p.cantidad_actual_g, pesoIdeal);
          seleccion.push({
            id: p.id,
            nombre: p.nombre,
            cantidad_g: gramos,
            proteinas: (gramos * p.proteinas_g) / 100,
            carbohidratos: (gramos * p.carbohidratos_g) / 100,
            grasas: (gramos * p.grasas_g) / 100,
            calorias: (gramos * p.calorias) / 100,
          });
        }
        const usados = new Set(seleccion.map(s => s.id));
        const restantes = pool.filter(p => !usados.has(p.id));
        return { seleccion, restantes };
      }

      let pool = productos;

      // Pasos para cada comida
      const comidas: Array<keyof Params> = ["desayuno", "almuerzo", "merienda"];
      const prioridades: Record<string, ["desayuno" | "merienda" | "almuerzo", "desayuno" | "merienda" | "almuerzo", "desayuno" | "merienda" | "almuerzo"]> = {
        desayuno: ["desayuno", "merienda", "almuerzo"],
        almuerzo: ["almuerzo", "merienda", "desayuno"],
        merienda: ["merienda", "almuerzo", "desayuno"],
      };

      const resultadoFinal = {
        proteinas: [] as any[],
        carbohidratos: [] as any[],
        complementos: [] as any[],
        frutas: [] as any[],
        vegetales: [] as any[],
      };
      
      for (const comida of comidas) {
        pool = ordenarPool(pool, prioridades[comida]);
      
        const { seleccion: protSel, restantes: pool1 } = seleccionarProteinaOCarbo(
          pool, 1, params[comida].proteinas, "proteinas_g", 3
        );
        resultadoFinal.proteinas.push(...protSel);
      
        const { seleccion: carbSel, restantes: pool2 } = seleccionarProteinaOCarbo(
          pool1, 2, params[comida].carbohidratos, "carbohidratos_g", 3
        );
        resultadoFinal.carbohidratos.push(...carbSel);
      
        const grasasSum = protSel.concat(carbSel).reduce((sum, i) => sum + i.grasas, 0);
        const calSum = protSel.concat(carbSel).reduce((sum, i) => sum + i.calorias, 0);
        const grasasFalt = Math.max(0, params[comida].grasas - grasasSum);
        const calFalt = Math.max(0, params[comida].calorias - calSum);
      
        const { seleccion: compSel, restantes: pool3 } = (() => {
          let sel: any[] = [];
          for (const p of pool2.filter(p => p.categoria_id === 5)) {
            if (sel.length >= 5) break;
            const gCal = (calFalt * 100) / (p.calorias || 1);
            const gGra = (grasasFalt * 100) / (p.grasas_g || 1);
            const gReq = Math.max(gCal, gGra);
            const gramos = gReq > 0 ? Math.min(gReq, p.cantidad_actual_g) : 250;
            if (gramos > 0) {
              sel.push({
                id: p.id,
                nombre: p.nombre,
                cantidad_g: gramos,
                proteinas: (gramos * p.proteinas_g) / 100,
                carbohidratos: (gramos * p.carbohidratos_g) / 100,
                grasas: (gramos * p.grasas_g) / 100,
                calorias: (gramos * p.calorias) / 100,
              });
            }
          }
          const usados = new Set(sel.map(s => s.id));
          return { seleccion: sel, restantes: pool2.filter(p => !usados.has(p.id)) };
        })();
        resultadoFinal.complementos.push(...compSel);
      
        if (comida === "desayuno") {
          const { seleccion: frutaSel } = seleccionarConTope(pool3, 3, 3, 150);
          resultadoFinal.frutas.push(...frutaSel);
        } else {
          const { seleccion: vegetalSel } = seleccionarConTope(pool3, 4, 3, 250);
          resultadoFinal.vegetales.push(...vegetalSel);
        }
      
        const usados = new Set([
          ...protSel, ...carbSel, ...compSel,
          ...(comida === "desayuno" ? [] : []), // ya agregamos vegetales y frutas aparte
        ].map((x: any) => x.id));
        pool = pool.filter(p => !usados.has(p.id));
      }

      return res.status(200).json(resultadoFinal);
    } catch (e) {
      return res.status(500).send((e as Error).message);
    }
  })
);
