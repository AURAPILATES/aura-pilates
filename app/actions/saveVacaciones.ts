"use server";
import fs from "fs";
import path from "path";

type Persona = {
  nombre: string;
  inicioContrato: string;
  jornadaDias: number;
  diasTotales: number;
  vacaciones: string[];
  enfermedad?: string[];
  familiar?: string[];
  otros?: string[];
};

export async function saveVacacionesAction(personas: Persona[]) {
  const filePath = path.join(process.cwd(), "data/vacaciones.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  data.personas = personas;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
