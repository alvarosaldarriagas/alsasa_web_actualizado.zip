const fullText = "a1099 sector el estadio habitaciones :3 banos :2 valor: $520.000.000 área: 87 mt2 ubicación: sector estadio, edificio med 70 cerca a iglesia de lourdes nueva florida piso 5 - apto 501 edificio de 12 niveles ascensor parqueadero cubierto n°14 habitaciones 3 balcón y baño en la habitación principal baño social completo estudio cocina abierta zona de ropas balcones 2 5 años de construcción unidad independiente zonas comunes parqueadero de visitantes terraza común con asador y baño está libre de gravamen estrato 4 predial $755.000 trimestral administración $380.000";

let beds = '-';
let bedsMatch = fullText.match(/(?:alcobas?|habitaci[óo]n(?:es)?|habs?)[\s:]+(\d+)\b/);
if (!bedsMatch) bedsMatch = fullText.match(/(\d+)\s{1,3}(?:alcobas?|habitaci[óo]n(?:es)?|habs?)\b/);
if (bedsMatch) beds = bedsMatch[1];

let baths = '-';
let bathsMatch = fullText.match(/ba[ñn]os?[\s:]+(\d+)\b/);
if (!bathsMatch) bathsMatch = fullText.match(/(\d+)\s{1,3}ba[ñn]os?\b/);
if (bathsMatch) {
    baths = bathsMatch[1];
} else if (fullText.match(/ba[ñn]o\b/)) {
    baths = '1';
}

console.log("Beds:", beds, "Baths:", baths);
