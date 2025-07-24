import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { withAppCheck } from "../../core/middleware/withAppCheck";

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

export const generarMenu = onRequest(
  { secrets: [GEMINI_API_KEY] },
  withAppCheck(async (req, res) => {
    try {
      const key = GEMINI_API_KEY.value();
      const { posiblesProductos, requerimientos } = req.body;
      if (!posiblesProductos || !requerimientos) {
        return res.status(400).send("Faltan datos");
      }

      const prompt = `
Eres un chef experto y nutricionista.  
Te enviaré los alimentos que tengo en casa y las necesidades nutricionales que necesito cubrir en cada comida (desayuno, almuerzo, merienda).  

Estos son los **únicos alimentos que puedes usar**, ya que no tengo otros.  
Los alimentos vienen en este formato:  

\`\`\`ts
interface ProductoSeleccionado {
  id: number;
  nombre: string;
  cantidad_g: number; // gramos que tengo disponibles
  proteinas: number; // gramos de proteína en esos cantidad_g
  carbohidratos: number; // gramos de carbohidrato en esos cantidad_g
  grasas: number; // gramos de grasa en esos cantidad_g
  calorias: number; // calorías en esos cantidad_g
}

interface ResultadoFinal {
  proteinas: ProductoSeleccionado[]; 
  carbohidratos: ProductoSeleccionado[];
  complementos: ProductoSeleccionado[];
  frutas: ProductoSeleccionado[];
  vegetales: ProductoSeleccionado[];
}
\`\`\`

También te envío las necesidades nutricionales de cada comida:  

\`\`\`ts
interface Nutricion {
  calorias: number;
  proteinas: number;
  carbohidratos: number;
  grasas: number;
}

interface NecesidadNutricionales {
  desayuno: Nutricion;
  almuerzo: Nutricion;
  merienda: Nutricion;
}
\`\`\`

**Tu tarea:**  
- Crear una receta para cada comida (desayuno, almuerzo, merienda).  
- Cada receta solo puede usar ingredientes de la lista que te doy con las cantidades que tengo.  
- Las recetas deben alcanzar las necesidades nutricionales que te mando, permitiendo un margen de error del ±10% en cada macronutriente y calorias.  
- Las recetas deben ser reales, ricas y bien detalladas.   

**Reglas para cada comida:**  
- **Desayuno:** usa proteína + carbohidrato + complemento + fruta (la fruta puede ser comida o en jugo).  
- **Almuerzo y merienda:** usa proteína + carbohidrato + complemento + vegetal (puedes añadir fruta si lo consideras necesario para un juego, pero prefiero que recomiendes agua).  

**Formato de respuesta (JSON sin comentarios ni explicaciones):**  

\`\`\`json
{
  "desayuno": {
    "titulo": "Nombre del plato",
    "descripcion": "Descripción y si se recomienda bebida o jugo",
    "preparacion": 0,
    "coccion": 0,
    "ingredientes": ["{cantidad}{unidad} de {producto}", "38g de mantequilla", "150g de Banano", "..."],
    "instrucciones": ["Paso 1...", "Paso 2..."],
    "nutricion": {
      "calorias": 0,
      "proteinas": 0,
      "carbohidratos": 0,
      "grasas": 0
    }
  },
  "almuerzo": { ... },
  "merienda": { ... },
  "cumpleNecesidades": true
}
\`\`\`

Si no puedes cumplir las necesidades nutricionales, pon en el json "cumpleNecesidades": false

Listado de productos disponibles:  
\`\`\`json
${JSON.stringify(posiblesProductos, null, 2)}
\`\`\`

Necesidades nutricionales:  
\`\`\`json
${JSON.stringify(requerimientos, null, 2)}
\`\`\`

Devuelve solo el JSON solicitado.
      `.trim();

      const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": key
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const result = await resp.json();
      const texto = result.candidates?.[0]?.content?.parts?.[0]?.text;
      const jsonRespuesta = texto ? JSON.parse(texto.replace(/```json|```/g, '').trim()) : null;

      return res.status(200).json(jsonRespuesta);
    } catch (e) {
      return res.status(500).send(e);
    }
  })
);
